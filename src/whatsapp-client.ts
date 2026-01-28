import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// MCP uses stdout ONLY for JSON-RPC - redirect ALL other output to stderr
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
  // Only allow JSON-RPC messages (start with '{')
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  if (str.trim().startsWith('{') || str.trim().startsWith('Content-Length')) {
    return originalStdoutWrite(chunk, encoding, callback);
  }
  // Redirect everything else to stderr
  return process.stderr.write(chunk, encoding, callback);
};

// Also redirect console.log to stderr
console.log = (...args) => {
  console.error(...args);
};

// Generate QR code as base64 data URL (compact but scannable)
async function generateQRCodeBase64(text: string): Promise<string> {
  return await QRCode.toDataURL(text, { width: 120, margin: 1 });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_FOLDER = join(__dirname, '..', '.wwebjs_auth');
const QR_IMAGE_PATH = join(__dirname, '..', 'qr-code.png');
const CONTACTS_FILE = join(__dirname, '..', 'contacts.json');

export interface WhatsAppContact {
  id: string;
  name: string;
  pushname: string;
  isMyContact: boolean;
  isGroup: boolean;
}

export interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  timestamp: number;
  lastMessage?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  contactId?: string;
}

interface StoredContact {
  name?: string;
  notify?: string;
}

interface StoredMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  pushName?: string;
}

const LOG_BUFFER: string[] = [];
const MAX_LOG_ENTRIES = 200;

export function log(...args: unknown[]): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  const entry = `[${timestamp}] ${message}`;
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_LOG_ENTRIES) {
    LOG_BUFFER.shift();
  }
  console.error(entry);
}

export function getLogs(limit = 50): string[] {
  return LOG_BUFFER.slice(-limit);
}

class WhatsAppClientWrapper {
  private client: InstanceType<typeof Client> | null = null;
  private isReady = false;
  private qrCode: string | null = null;
  private qrImagePath: string | null = null;
  private contacts: Map<string, StoredContact> = new Map();
  private messages: Map<string, StoredMessage[]> = new Map(); // chatId -> messages

  constructor() {
    // Load contacts from file on startup
    this.loadContactsFromFile();
  }

  private loadContactsFromFile(): void {
    try {
      if (existsSync(CONTACTS_FILE)) {
        const data = readFileSync(CONTACTS_FILE, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, StoredContact>;
        this.contacts = new Map(Object.entries(parsed));
        log(`Loaded ${this.contacts.size} contacts from cache`);
      }
    } catch (err) {
      log(`Failed to load contacts: ${err}`);
    }
  }

  private saveContactsToFile(): void {
    try {
      const obj = Object.fromEntries(this.contacts);
      writeFileSync(CONTACTS_FILE, JSON.stringify(obj, null, 2));
      log(`Saved ${this.contacts.size} contacts to: ${CONTACTS_FILE}`);
    } catch (err) {
      log('Failed to save contacts to file:', err);
    }
  }

  async initialize(): Promise<void> {
    log('Initializing WhatsApp client (whatsapp-web.js)...');

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: AUTH_FOLDER,
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
        ],
      },
      // Use cached WhatsApp Web version for compatibility
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1032570163-alpha.html',
      },
    });

    this.client.on('qr', async (qr: string) => {
      this.qrCode = qr;
      this.qrImagePath = QR_IMAGE_PATH;

      try {
        await QRCode.toFile(QR_IMAGE_PATH, qr, { width: 300, margin: 2 });
        log(`QR Code saved to: ${QR_IMAGE_PATH}`);
        log('Scan with WhatsApp to authenticate!');
      } catch (err) {
        log('Failed to save QR code:', err);
      }
    });

    this.client.on('authenticated', () => {
      log('Authenticated successfully');
      this.qrCode = null;
      // Trigger ready check after authentication
      this.checkReadyAfterAuth();
    });

    this.client.on('auth_failure', (msg: string) => {
      log('Authentication failure:', msg);
    });

    this.client.on('ready', async () => {
      this.isReady = true;
      this.qrCode = null;
      log('EVENT: ready - WhatsApp client is ready!');
      await this.syncContacts();
    });

    this.client.on('disconnected', (reason: string) => {
      log('EVENT: disconnected -', reason);
      this.isReady = false;
    });

    // Additional event listeners for debugging
    this.client.on('loading_screen', (percent: number, message: string) => {
      log(`EVENT: loading_screen - ${percent}% ${message}`);
    });

    this.client.on('change_state', (state: string) => {
      log(`EVENT: change_state - ${state}`);
      if (state === 'CONNECTED' && !this.isReady) {
        this.isReady = true;
        this.qrCode = null;
        log('Client ready (via change_state event)!');
        this.syncContacts();
      }
    });

    (this.client as any).on('remote_session_saved', () => {
      log('EVENT: remote_session_saved');
    });

    this.client.on('message', async (msg: any) => {
      const chatId = msg.from;
      if (!chatId) return;

      // Learn about contacts from messages
      if (!this.contacts.has(chatId)) {
        const contact = await msg.getContact();
        const name = contact?.pushname || contact?.name || chatId.split('@')[0];
        this.contacts.set(chatId, { notify: name });
        log(`Learned contact from message: ${name}`);
        this.saveContactsToFile();
      }

      // Store the message
      const storedMsg: StoredMessage = {
        id: msg.id._serialized || msg.id.id || '',
        from: chatId,
        to: 'me',
        body: msg.body || '[Media]',
        timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
        fromMe: false,
        pushName: msg._data?.notifyName || undefined,
      };

      const chatMessages = this.messages.get(chatId) || [];
      if (!chatMessages.find(m => m.id === storedMsg.id)) {
        chatMessages.push(storedMsg);
        if (chatMessages.length > 1000) {
          chatMessages.shift();
        }
        this.messages.set(chatId, chatMessages);
      }
    });

    this.client.on('message_create', async (msg: any) => {
      // Handle outgoing messages
      if (!msg.fromMe) return;

      const chatId = msg.to;
      if (!chatId) return;

      const storedMsg: StoredMessage = {
        id: msg.id._serialized || msg.id.id || '',
        from: 'me',
        to: chatId,
        body: msg.body || '[Media]',
        timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
        fromMe: true,
      };

      const chatMessages = this.messages.get(chatId) || [];
      if (!chatMessages.find(m => m.id === storedMsg.id)) {
        chatMessages.push(storedMsg);
        if (chatMessages.length > 1000) {
          chatMessages.shift();
        }
        this.messages.set(chatId, chatMessages);
      }
    });

    // Start the client
    try {
      await this.client.initialize();
    } catch (err) {
      log('Failed to initialize client:', err);
      // Start polling fallback for ready state
      this.startReadyPolling();
    }

    // Start polling fallback regardless (in case ready event doesn't fire)
    this.startReadyPolling();
  }

  private readyPollingStarted = false;
  private authReceived = false;

  private async checkReadyAfterAuth(): Promise<void> {
    // Prevent multiple calls
    if (this.authReceived) {
      log('Auth already received, skipping duplicate');
      return;
    }
    this.authReceived = true;
    log('Auth received, waiting for ready event...');

    // Don't actively poll - just wait for the ready event
    // The ready event should fire after auth is complete
    // Only set a long timeout fallback
    setTimeout(async () => {
      if (!this.isReady) {
        log('Ready event timeout after 60s, forcing ready...');
        this.isReady = true;
        this.qrCode = null;
        // Wait a bit more before trying to sync
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.syncContacts();
      }
    }, 60000);
  }

  private startReadyPolling(): void {
    if (this.readyPollingStarted || this.isReady) return;
    this.readyPollingStarted = true;

    log('Starting ready state polling...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5s intervals

    const pollInterval = setInterval(async () => {
      attempts++;

      if (this.isReady) {
        log('Ready state confirmed, stopping polling');
        clearInterval(pollInterval);
        return;
      }

      if (attempts >= maxAttempts) {
        log('Ready polling timeout reached (5 min)');
        clearInterval(pollInterval);
        return;
      }

      // Just log status, don't try to force anything
      if (attempts % 10 === 0) {
        log(`Waiting for ready... attempt ${attempts}, auth=${this.authReceived}`);
      }

      try {
        if (this.client) {
          const state = await this.client.getState();

          if (state === 'CONNECTED') {
            this.isReady = true;
            this.qrCode = null;
            log('Client ready (state=CONNECTED)!');
            clearInterval(pollInterval);
            await this.syncContacts();
            return;
          }
        }
      } catch (err) {
        // Ignore errors during polling
      }
    }, 5000);
  }

  private async syncContacts(): Promise<void> {
    if (!this.client) {
      log('syncContacts called but client is null!');
      return;
    }

    try {
      log('Syncing contacts...');
      log(`Client exists: ${!!this.client}, isReady: ${this.isReady}`);

      const contacts = await this.client.getContacts();
      log(`getContacts() returned ${contacts?.length || 0} items`);

      let validCount = 0;
      for (const contact of contacts) {
        // Filter out invalid contacts
        if (!contact.id || !contact.id._serialized) continue;

        const id = contact.id._serialized;
        // Skip status broadcast
        if (id === 'status@broadcast') continue;

        this.contacts.set(id, {
          name: contact.name || undefined,
          notify: contact.pushname || undefined,
        });
        validCount++;
      }

      log(`Synced ${validCount} contacts from getContacts()`);

      // Fallback: Also get contacts from chats
      if (validCount === 0) {
        log('No contacts from getContacts(), trying getChats()...');
        try {
          const chats = await this.client.getChats();
          log(`getChats() returned ${chats?.length || 0} chats`);

          for (const chat of chats) {
            if (!chat.id || !chat.id._serialized) continue;
            const id = chat.id._serialized;
            if (id === 'status@broadcast') continue;

            if (!this.contacts.has(id)) {
              this.contacts.set(id, {
                name: chat.name || undefined,
                notify: chat.name || undefined,
              });
              validCount++;
            }
          }
          log(`Added ${validCount} contacts from chats`);
        } catch (chatErr) {
          log('getChats() failed:', chatErr);
        }
      }

      this.saveContactsToFile();
    } catch (err: any) {
      log('Failed to sync contacts:', err?.message || err?.name || err);
      if (err?.stack) {
        log('Stack:', err.stack.split('\n')[1]);
      }
    }
  }

  getStatus(): { ready: boolean; qrCode: string | null; qrImagePath: string | null; contactCount: number } {
    return {
      ready: this.isReady,
      qrCode: this.qrCode,
      qrImagePath: this.qrImagePath,
      contactCount: this.contacts.size,
    };
  }

  async getQRCodeBase64(): Promise<string | null> {
    if (!this.qrCode) return null;
    return await generateQRCodeBase64(this.qrCode);
  }

  isClientReady(): boolean {
    return this.isReady && this.client !== null;
  }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.includes('@')) return cleaned;
    return `${cleaned}@c.us`;
  }

  async getChats(limit = 20): Promise<WhatsAppChat[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    try {
      const chats = await this.client.getChats();
      return chats.slice(0, limit).map((chat: any) => ({
        id: chat.id._serialized,
        name: chat.name || chat.id._serialized.split('@')[0],
        isGroup: chat.isGroup,
        unreadCount: chat.unreadCount || 0,
        timestamp: chat.timestamp || Date.now(),
        lastMessage: chat.lastMessage?.body,
      }));
    } catch (err) {
      log('Failed to get chats:', err);
      return [];
    }
  }

  async getContacts(): Promise<WhatsAppContact[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    // Refresh contacts if empty
    if (this.contacts.size === 0) {
      await this.syncContacts();
    }

    const contacts: WhatsAppContact[] = [];

    for (const [id, contact] of this.contacts) {
      contacts.push({
        id,
        name: contact.name || '',
        pushname: contact.notify || '',
        isMyContact: !!contact.name,
        isGroup: id.endsWith('@g.us'),
      });
    }

    return contacts;
  }

  async findContactByName(name: string): Promise<string | null> {
    // Refresh contacts if empty
    if (this.contacts.size === 0 && this.client && this.isReady) {
      await this.syncContacts();
    }

    const searchLower = name.toLowerCase();

    for (const [id, contact] of this.contacts) {
      const contactName = contact.name?.toLowerCase() || '';
      const notify = contact.notify?.toLowerCase() || '';

      if (contactName.includes(searchLower) || notify.includes(searchLower)) {
        return id;
      }
    }

    return null;
  }

  async getMessages(chatId: string, limit = 100): Promise<StoredMessage[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    // Return cached messages
    const messages = this.messages.get(chatId) || [];
    return messages.slice(-limit);
  }

  async fetchMessages(chatId: string, limit = 50): Promise<StoredMessage[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    try {
      log(`Fetching messages for ${chatId}, limit=${limit}`);
      const chat = await this.client.getChatById(chatId);
      log(`Got chat: ${chat?.name || 'unknown'}`);
      const messages = await chat.fetchMessages({ limit });
      log(`fetchMessages returned ${messages?.length || 0} messages`);

      const storedMessages: StoredMessage[] = [];

      for (const msg of messages) {
        const storedMsg: StoredMessage = {
          id: msg.id._serialized || msg.id.id || '',
          from: msg.fromMe ? 'me' : chatId,
          to: msg.fromMe ? chatId : 'me',
          body: msg.body || '[Media]',
          timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
          fromMe: msg.fromMe,
          pushName: (msg as any)._data?.notifyName || undefined,
        };

        storedMessages.push(storedMsg);

        // Also update cache
        const chatMessages = this.messages.get(chatId) || [];
        if (!chatMessages.find(m => m.id === storedMsg.id)) {
          chatMessages.push(storedMsg);
        }
        this.messages.set(chatId, chatMessages);
      }

      // Sort by timestamp
      storedMessages.sort((a, b) => a.timestamp - b.timestamp);

      log(`Fetched ${storedMessages.length} messages for ${chatId}`);
      return storedMessages;
    } catch (err: any) {
      log(`Failed to fetch messages: ${err?.message || err}`);
      if (err?.stack) {
        log('Stack:', err.stack.split('\n').slice(0, 3).join(' | '));
      }
      return [];
    }
  }

  async getMessagesByContactName(name: string, limit = 100): Promise<{ contactId: string; contactName: string; messages: StoredMessage[]; totalStored: number } | null> {
    const contactId = await this.findContactByName(name);
    if (!contactId) {
      return null;
    }

    // Fetch messages on-demand
    const fetchedMessages = await this.fetchMessages(contactId, limit);

    const contact = this.contacts.get(contactId);
    const contactName = contact?.name || contact?.notify || contactId.split('@')[0];
    const allMessages = this.messages.get(contactId) || [];

    // Sort and dedupe
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    return {
      contactId,
      contactName,
      messages: allMessages.slice(-limit),
      totalStored: allMessages.length,
    };
  }

  async getMessagesByPhoneNumber(phone: string, limit = 100): Promise<{ contactId: string; contactName: string; messages: StoredMessage[]; totalStored: number } | null> {
    const jid = this.formatPhoneNumber(phone);
    let chatId = jid;

    // Search for contact by phone number
    const cleanedPhone = phone.replace(/\D/g, '');
    for (const [id] of this.contacts) {
      if (id.startsWith(cleanedPhone) && id.endsWith('@c.us')) {
        chatId = id;
        break;
      }
    }

    // Fetch messages on-demand
    const fetchedMessages = await this.fetchMessages(chatId, limit);

    const contact = this.contacts.get(chatId);
    const contactName = contact?.name || contact?.notify || phone;
    const allMessages = this.messages.get(chatId) || [];

    // Sort and dedupe
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    return {
      contactId: chatId,
      contactName,
      messages: allMessages.slice(-limit),
      totalStored: allMessages.length,
    };
  }

  getRecentMessages(limit = 20): { chatId: string; chatName: string; messages: StoredMessage[] }[] {
    const result: { chatId: string; chatName: string; messages: StoredMessage[] }[] = [];

    for (const [chatId, messages] of this.messages) {
      if (messages.length === 0) continue;

      const contact = this.contacts.get(chatId);
      const chatName = contact?.name || contact?.notify || chatId.split('@')[0];

      result.push({
        chatId,
        chatName,
        messages: messages.slice(-5), // Last 5 messages per chat
      });
    }

    // Sort by most recent message
    result.sort((a, b) => {
      const aTime = a.messages[a.messages.length - 1]?.timestamp || 0;
      const bTime = b.messages[b.messages.length - 1]?.timestamp || 0;
      return bTime - aTime;
    });

    return result.slice(0, limit);
  }

  async sendMessage(recipient: string, message: string): Promise<SendResult> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    const jid = this.formatPhoneNumber(recipient);
    log(`Sending message to ${jid}: "${message.substring(0, 50)}..."`);

    try {
      // sendSeen: false fixes "Cannot read properties of undefined (reading 'markedUnread')" error
      const result = await this.client.sendMessage(jid, message, { sendSeen: false });
      log(`Message sent successfully, id: ${result?.id?._serialized || 'unknown'}`);

      return {
        success: true,
        messageId: result?.id?._serialized || undefined,
      };
    } catch (err: any) {
      log(`Failed to send message: ${err?.message || err}`);
      throw err;
    }
  }

  async sendMessageToContact(name: string, message: string): Promise<SendResult> {
    log(`sendMessageToContact called: name="${name}", message="${message.substring(0, 50)}..."`);
    if (!this.client || !this.isReady) {
      log('sendMessageToContact: client not ready');
      throw new Error('WhatsApp client not ready');
    }

    const contactId = await this.findContactByName(name);
    log(`Found contactId: ${contactId}`);
    if (!contactId) {
      throw new Error(`Contact "${name}" not found. Available contacts: ${this.contacts.size}`);
    }

    try {
      log(`Sending message to contact ${contactId}...`);
      // sendSeen: false fixes "Cannot read properties of undefined (reading 'markedUnread')" error
      const result = await this.client.sendMessage(contactId, message, { sendSeen: false });
      log(`Message sent to contact, id: ${result?.id?._serialized || 'unknown'}`);

      return {
        success: true,
        messageId: result?.id?._serialized || undefined,
        contactId,
      };
    } catch (err: any) {
      log(`Failed to send to contact: ${err?.message || err}`);
      if (err?.stack) {
        log(`Stack: ${err.stack.split('\n').slice(0, 2).join(' | ')}`);
      }
      throw err;
    }
  }

  async searchMessages(query: string, chatId?: string, limit = 50): Promise<{ chatId: string; chatName: string; messages: StoredMessage[] }[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    const results: { chatId: string; chatName: string; messages: StoredMessage[] }[] = [];
    const searchLower = query.toLowerCase();

    if (chatId) {
      // Search in specific chat
      const messages = this.messages.get(chatId) || [];
      const matches = messages.filter(m => m.body.toLowerCase().includes(searchLower));

      if (matches.length > 0) {
        const contact = this.contacts.get(chatId);
        results.push({
          chatId,
          chatName: contact?.name || contact?.notify || chatId.split('@')[0],
          messages: matches.slice(-limit),
        });
      }
    } else {
      // Search in all chats
      for (const [cId, messages] of this.messages) {
        const matches = messages.filter(m => m.body.toLowerCase().includes(searchLower));

        if (matches.length > 0) {
          const contact = this.contacts.get(cId);
          results.push({
            chatId: cId,
            chatName: contact?.name || contact?.notify || cId.split('@')[0],
            messages: matches.slice(-Math.floor(limit / Math.max(results.length + 1, 1))),
          });
        }
      }
    }

    return results.slice(0, 20); // Max 20 chats
  }

  async destroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        log('Error destroying client:', err);
      }
      this.client = null;
      this.isReady = false;
    }
  }

  async requestHistorySync(): Promise<void> {
    // In whatsapp-web.js, we use fetchMessages instead
    log('History sync requested. Use fetchMessages for on-demand loading.');
  }

  async fetchMoreMessages(chatId: string, count = 50): Promise<{ fetched: boolean; messageCount: number; newMessages: number }> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    const beforeCount = this.messages.get(chatId)?.length || 0;
    log(`Fetching more messages for ${chatId}, current count: ${beforeCount}`);

    try {
      const chat = await this.client.getChatById(chatId);

      // Call syncHistory multiple times to load more older messages from phone
      log('Calling syncHistory to load older messages from phone...');
      for (let i = 0; i < 3; i++) {
        try {
          const result = await chat.syncHistory();
          log(`syncHistory attempt ${i + 1}: ${result}`);
          // Wait for messages to be loaded
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (syncErr: any) {
          log(`syncHistory attempt ${i + 1} error: ${syncErr?.message || syncErr}`);
          break; // Stop if error
        }
      }

      // Now fetch messages with higher limit
      const newLimit = Math.max(beforeCount + count, 100);
      log(`Fetching with limit=${newLimit}`);

      const messages = await chat.fetchMessages({ limit: newLimit });
      log(`fetchMessages returned ${messages?.length || 0} messages`);

      let newCount = 0;
      for (const msg of messages) {
        const storedMsg: StoredMessage = {
          id: msg.id._serialized || msg.id.id || '',
          from: msg.fromMe ? 'me' : chatId,
          to: msg.fromMe ? chatId : 'me',
          body: msg.body || '[Media]',
          timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
          fromMe: msg.fromMe,
          pushName: (msg as any)._data?.notifyName || undefined,
        };

        const chatMessages = this.messages.get(chatId) || [];
        if (!chatMessages.find(m => m.id === storedMsg.id)) {
          chatMessages.push(storedMsg);
          newCount++;
        }
        this.messages.set(chatId, chatMessages);
      }

      // Sort by timestamp
      const allMessages = this.messages.get(chatId) || [];
      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      this.messages.set(chatId, allMessages);

      const afterCount = allMessages.length;
      log(`Fetched ${newCount} new messages, total now: ${afterCount}`);

      return {
        fetched: newCount > 0,
        messageCount: afterCount,
        newMessages: newCount,
      };
    } catch (err: any) {
      log(`Failed to fetch more messages: ${err?.message || err}`);
      return { fetched: false, messageCount: beforeCount, newMessages: 0 };
    }
  }

  async resetAuth(): Promise<void> {
    // Destroy current connection
    await this.destroy();

    // Clear contacts and messages
    this.contacts.clear();
    this.messages.clear();
    this.readyPollingStarted = false;
    this.qrCode = null;

    // Delete auth folder
    const fs = await import('fs/promises');
    try {
      await fs.rm(AUTH_FOLDER, { recursive: true, force: true });
      log('Auth folder deleted');
    } catch (err) {
      log('Failed to delete auth folder:', err);
    }

    // Delete contacts cache
    try {
      await fs.unlink(CONTACTS_FILE);
      log('Contacts cache deleted');
    } catch (err) {
      // Ignore if doesn't exist
    }

    // Reinitialize
    log('Reinitializing WhatsApp client...');
    await this.initialize();
  }
}

export const whatsappClient = new WhatsAppClientWrapper();
