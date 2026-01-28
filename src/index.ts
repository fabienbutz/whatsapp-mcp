#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { whatsappClient, getLogs, log } from './whatsapp-client.js';
import { transcribeAudio, isTranscriptionAvailable } from './transcription.js';

const tools: Tool[] = [
  {
    name: 'whatsapp_status',
    description: 'Get the current WhatsApp connection status and contact count.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'whatsapp_get_qr_code',
    description: 'Get the QR code for WhatsApp authentication as an image. Use this when WhatsApp is not authenticated to display the QR code for scanning.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'whatsapp_send_message',
    description: 'Send a WhatsApp message to a phone number. Phone numbers should be in international format without + (e.g., 4915123456789 for German numbers).',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Phone number in international format (e.g., 4915123456789)'
        },
        message: {
          type: 'string',
          description: 'The message text to send'
        }
      },
      required: ['recipient', 'message']
    }
  },
  {
    name: 'whatsapp_send_to_contact',
    description: 'Send a WhatsApp message to a contact by name. Searches your contacts and sends to the first match.',
    inputSchema: {
      type: 'object',
      properties: {
        contactName: {
          type: 'string',
          description: 'The name of the contact to send to (partial match supported)'
        },
        message: {
          type: 'string',
          description: 'The message text to send'
        }
      },
      required: ['contactName', 'message']
    }
  },
  {
    name: 'whatsapp_list_contacts',
    description: 'List all WhatsApp contacts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return (default: 50)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_find_contact',
    description: 'Search for a contact by name and return their WhatsApp ID.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name to search for (partial match supported)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'whatsapp_get_messages',
    description: 'Get messages from a specific chat by contact name or phone number. Fetches messages on-demand from WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        contactName: {
          type: 'string',
          description: 'The name of the contact to get messages from'
        },
        phoneNumber: {
          type: 'string',
          description: 'Phone number in international format (e.g., 4915123456789). Use this if contact name search fails.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of messages to return (default: 100, max: 1000)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_get_recent_messages',
    description: 'Get recent messages from all chats. Shows the last few messages from each active conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of chats to return (default: 20)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_sync_history',
    description: 'Request a history sync. In whatsapp-web.js, messages are fetched on-demand via chat.fetchMessages().',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'whatsapp_fetch_more_messages',
    description: 'Fetch more messages for a specific chat. Uses on-demand loading from WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        contactName: {
          type: 'string',
          description: 'The name of the contact to fetch more messages for'
        },
        phoneNumber: {
          type: 'string',
          description: 'Phone number in international format (e.g., 4915123456789)'
        },
        count: {
          type: 'number',
          description: 'Number of messages to fetch (default: 50)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_search_messages',
    description: 'Search for messages containing a specific query. Can search in a specific chat or across all chats.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find in messages'
        },
        chatId: {
          type: 'string',
          description: 'Optional: Limit search to a specific chat ID'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'whatsapp_logs',
    description: 'Get recent server logs. Useful for debugging connection issues, sync status, and errors.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of log entries to return (default: 50, max: 200)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_reset_auth',
    description: 'Reset WhatsApp authentication. Use this to force a new QR code scan, which will sync all contacts fresh. Useful when contacts are missing.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'whatsapp_download_media',
    description: 'Download media (image, video, audio, document) from a WhatsApp message. Returns base64 encoded data.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the message containing the media'
        },
        chatId: {
          type: 'string',
          description: 'The chat ID where the message is located (e.g., 4915123456789@c.us)'
        }
      },
      required: ['messageId', 'chatId']
    }
  },
  {
    name: 'whatsapp_send_image',
    description: 'Send an image to a WhatsApp contact. Can send from URL or base64 data.',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Phone number in international format (e.g., 4915123456789) or contact name'
        },
        imageUrl: {
          type: 'string',
          description: 'URL of the image to send (use this OR imageBase64)'
        },
        imageBase64: {
          type: 'string',
          description: 'Base64 encoded image data (use this OR imageUrl)'
        },
        caption: {
          type: 'string',
          description: 'Optional caption for the image'
        }
      },
      required: ['recipient']
    }
  },
  {
    name: 'whatsapp_send_document',
    description: 'Send a document/file to a WhatsApp contact. Can send from URL or base64 data.',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Phone number in international format (e.g., 4915123456789) or contact name'
        },
        documentUrl: {
          type: 'string',
          description: 'URL of the document to send (use this OR documentBase64)'
        },
        documentBase64: {
          type: 'string',
          description: 'Base64 encoded document data (use this OR documentUrl)'
        },
        filename: {
          type: 'string',
          description: 'Filename for the document (e.g., report.pdf)'
        }
      },
      required: ['recipient']
    }
  },
  {
    name: 'whatsapp_transcribe_audio',
    description: 'Transcribe a voice message or audio file from WhatsApp using OpenAI Whisper. Requires OPENAI_API_KEY to be configured.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the audio/voice message to transcribe'
        },
        chatId: {
          type: 'string',
          description: 'The chat ID where the message is located (e.g., 4915123456789@c.us)'
        },
        contactName: {
          type: 'string',
          description: 'Alternative: Contact name to find the chat (will transcribe the latest audio message)'
        }
      },
      required: []
    }
  }
];

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'whatsapp_status': {
      const status = whatsappClient.getStatus();
      const currentDate = new Date().toISOString().split('T')[0];
      if (status.ready) {
        return JSON.stringify({
          status: 'connected',
          message: 'WhatsApp is connected and ready',
          currentDate,
          contactCount: status.contactCount,
          hint: status.contactCount === 0
            ? 'Contacts are empty. Use whatsapp_list_contacts to sync them.'
            : undefined
        });
      } else if (status.qrCode) {
        return JSON.stringify({
          status: 'waiting_for_scan',
          currentDate,
          message: 'QR code is ready! Use whatsapp_get_qr_code to display it and scan with WhatsApp.',
          action: 'Call whatsapp_get_qr_code to see the QR code image'
        });
      } else {
        return JSON.stringify({
          status: 'initializing',
          currentDate,
          message: 'WhatsApp client is initializing. This may take 30-120 seconds for Puppeteer to start. Please wait and check again.'
        });
      }
    }

    case 'whatsapp_get_qr_code': {
      const status = whatsappClient.getStatus();
      if (status.ready) {
        return JSON.stringify({ error: 'WhatsApp is already connected. No QR code needed.' });
      }
      if (!status.qrCode) {
        return JSON.stringify({ error: 'No QR code available yet. Wait a moment and try again.' });
      }
      const qrBase64 = await whatsappClient.getQRCodeBase64();
      if (qrBase64) {
        // Return as image for Claude to display
        return JSON.stringify({
          message: 'Scan this QR code with WhatsApp (Settings → Linked Devices → Link a Device)',
          qrCodeDataUrl: qrBase64
        });
      }
      return JSON.stringify({ error: 'Failed to generate QR code' });
    }

    case 'whatsapp_send_message': {
      log('TOOL whatsapp_send_message called with args:', JSON.stringify(args));
      const { recipient, message } = args as { recipient: string; message: string };
      if (!recipient || !message) {
        log('ERROR: recipient or message missing');
        return JSON.stringify({ error: 'recipient and message are required' });
      }
      if (!whatsappClient.isClientReady()) {
        log('ERROR: WhatsApp client not ready');
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await whatsappClient.sendMessage(recipient, message);
        log('sendMessage result:', JSON.stringify(result));
        return JSON.stringify(result);
      } catch (err: any) {
        log('sendMessage error:', err?.message || err);
        return JSON.stringify({ error: err?.message || 'Failed to send message' });
      }
    }

    case 'whatsapp_send_to_contact': {
      log('TOOL whatsapp_send_to_contact called with args:', JSON.stringify(args));
      const { contactName, message } = args as { contactName: string; message: string };
      if (!contactName || !message) {
        log('ERROR: contactName or message missing');
        return JSON.stringify({ error: 'contactName and message are required' });
      }
      if (!whatsappClient.isClientReady()) {
        log('ERROR: WhatsApp client not ready');
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await whatsappClient.sendMessageToContact(contactName, message);
        log('sendMessageToContact result:', JSON.stringify(result));
        return JSON.stringify(result);
      } catch (err: any) {
        log('sendMessageToContact error:', err?.message || err);
        return JSON.stringify({ error: err?.message || 'Failed to send message' });
      }
    }

    case 'whatsapp_list_contacts': {
      const { limit = 50 } = args as { limit?: number };
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      const contacts = await whatsappClient.getContacts();
      return JSON.stringify(contacts.slice(0, limit));
    }

    case 'whatsapp_find_contact': {
      const { name } = args as { name: string };
      if (!name) {
        return JSON.stringify({ error: 'name is required' });
      }
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      const contactId = await whatsappClient.findContactByName(name);
      if (contactId) {
        return JSON.stringify({ found: true, contactId, name });
      } else {
        return JSON.stringify({ found: false, message: `No contact found matching "${name}"` });
      }
    }

    case 'whatsapp_get_messages': {
      const { contactName, phoneNumber, limit = 100 } = args as { contactName?: string; phoneNumber?: string; limit?: number };
      if (!contactName && !phoneNumber) {
        return JSON.stringify({ error: 'Either contactName or phoneNumber is required' });
      }
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }

      const actualLimit = Math.min(limit, 1000);
      let result;

      if (phoneNumber) {
        result = await whatsappClient.getMessagesByPhoneNumber(phoneNumber, actualLimit);
      } else if (contactName) {
        result = await whatsappClient.getMessagesByContactName(contactName, actualLimit);
      }

      if (result) {
        const currentDate = new Date().toISOString().split('T')[0];
        return JSON.stringify({
          currentDate,
          ...result,
          note: 'Messages fetched on-demand from WhatsApp.'
        });
      } else {
        return JSON.stringify({ error: `Contact "${contactName || phoneNumber}" not found` });
      }
    }

    case 'whatsapp_get_recent_messages': {
      const { limit = 20 } = args as { limit?: number };
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      const messages = whatsappClient.getRecentMessages(limit);
      const currentDate = new Date().toISOString().split('T')[0];
      return JSON.stringify({ currentDate, chats: messages });
    }

    case 'whatsapp_sync_history': {
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      await whatsappClient.requestHistorySync();
      return JSON.stringify({
        success: true,
        message: 'In whatsapp-web.js, messages are fetched on-demand. Use whatsapp_get_messages to load messages for a specific chat.'
      });
    }

    case 'whatsapp_fetch_more_messages': {
      const { contactName, phoneNumber, count = 50 } = args as { contactName?: string; phoneNumber?: string; count?: number };
      if (!contactName && !phoneNumber) {
        return JSON.stringify({ error: 'Either contactName or phoneNumber is required' });
      }
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }

      let chatId: string | null = null;

      if (phoneNumber) {
        chatId = phoneNumber.replace(/\D/g, '') + '@c.us';
      } else if (contactName) {
        chatId = await whatsappClient.findContactByName(contactName);
      }

      if (!chatId) {
        return JSON.stringify({ error: `Contact "${contactName || phoneNumber}" not found` });
      }

      const result = await whatsappClient.fetchMoreMessages(chatId, count);
      return JSON.stringify({
        success: result.fetched,
        chatId,
        messageCount: result.messageCount,
        newMessages: result.newMessages,
        message: result.fetched
          ? `Fetched ${result.newMessages} new messages. Total: ${result.messageCount} messages.`
          : 'No additional messages found. You may have reached the end of the chat history.'
      });
    }

    case 'whatsapp_search_messages': {
      const { query, chatId, limit = 50 } = args as { query: string; chatId?: string; limit?: number };
      if (!query) {
        return JSON.stringify({ error: 'query is required' });
      }
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }

      const results = await whatsappClient.searchMessages(query, chatId, limit);
      const totalMatches = results.reduce((sum, r) => sum + r.messages.length, 0);

      return JSON.stringify({
        query,
        totalMatches,
        chats: results,
        note: 'Search is performed on cached messages. Use whatsapp_get_messages first to load messages for a chat.'
      });
    }

    case 'whatsapp_logs': {
      const { limit = 50 } = args as { limit?: number };
      const logs = getLogs(Math.min(limit, 200));
      return JSON.stringify({ entries: logs, total: logs.length });
    }

    case 'whatsapp_reset_auth': {
      await whatsappClient.resetAuth();
      return JSON.stringify({
        success: true,
        message: 'Authentication reset. Use whatsapp_get_qr_code to scan a new QR code. This will sync all contacts fresh.'
      });
    }

    case 'whatsapp_download_media': {
      const { messageId, chatId } = args as { messageId: string; chatId: string };
      if (!messageId || !chatId) {
        return JSON.stringify({ error: 'messageId and chatId are required' });
      }
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }

      try {
        const media = await whatsappClient.downloadMedia(messageId, chatId);
        if (!media) {
          return JSON.stringify({ error: 'Media not found or message has no media' });
        }
        return JSON.stringify({
          success: true,
          mimetype: media.mimetype,
          filename: media.filename,
          dataSize: media.data.length,
          data: media.data, // base64 encoded
        });
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to download media' });
      }
    }

    case 'whatsapp_send_image': {
      const { recipient, imageUrl, imageBase64, caption } = args as {
        recipient: string;
        imageUrl?: string;
        imageBase64?: string;
        caption?: string;
      };

      if (!recipient) {
        return JSON.stringify({ error: 'recipient is required' });
      }
      if (!imageUrl && !imageBase64) {
        return JSON.stringify({ error: 'Either imageUrl or imageBase64 is required' });
      }
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }

      try {
        // Check if recipient is a name or phone number
        let recipientId = recipient;
        if (!/^\d+$/.test(recipient.replace(/\D/g, '').slice(0, 5))) {
          // Looks like a name, try to find contact
          const contactId = await whatsappClient.findContactByName(recipient);
          if (contactId) {
            recipientId = contactId;
          }
        }

        const result = await whatsappClient.sendImage(
          recipientId,
          imageUrl || imageBase64!,
          caption,
          !!imageUrl
        );
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to send image' });
      }
    }

    case 'whatsapp_send_document': {
      const { recipient, documentUrl, documentBase64, filename } = args as {
        recipient: string;
        documentUrl?: string;
        documentBase64?: string;
        filename?: string;
      };

      if (!recipient) {
        return JSON.stringify({ error: 'recipient is required' });
      }
      if (!documentUrl && !documentBase64) {
        return JSON.stringify({ error: 'Either documentUrl or documentBase64 is required' });
      }
      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }

      try {
        // Check if recipient is a name or phone number
        let recipientId = recipient;
        if (!/^\d+$/.test(recipient.replace(/\D/g, '').slice(0, 5))) {
          const contactId = await whatsappClient.findContactByName(recipient);
          if (contactId) {
            recipientId = contactId;
          }
        }

        const result = await whatsappClient.sendDocument(
          recipientId,
          documentUrl || documentBase64!,
          filename,
          !!documentUrl
        );
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to send document' });
      }
    }

    case 'whatsapp_transcribe_audio': {
      const { messageId, chatId, contactName } = args as {
        messageId?: string;
        chatId?: string;
        contactName?: string;
      };

      if (!whatsappClient.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }

      if (!isTranscriptionAvailable()) {
        return JSON.stringify({
          error: 'Transcription not available. Set OPENAI_API_KEY in your MCP server config or .env file.',
          hint: 'Add "env": {"OPENAI_API_KEY": "your-key"} to your MCP server configuration.'
        });
      }

      try {
        let targetChatId = chatId;
        let targetMessageId = messageId;

        // If contact name provided, find the chat and get latest audio
        if (contactName && !chatId) {
          const foundChatId = await whatsappClient.findContactByName(contactName);
          if (!foundChatId) {
            return JSON.stringify({ error: `Contact "${contactName}" not found` });
          }
          targetChatId = foundChatId;
        }

        if (!targetChatId) {
          return JSON.stringify({ error: 'Either chatId or contactName is required' });
        }

        // If no specific message, get the latest audio message
        if (!targetMessageId) {
          const audioMessages = await whatsappClient.getAudioMessages(targetChatId, 20);
          if (audioMessages.length === 0) {
            return JSON.stringify({ error: 'No audio messages found in this chat' });
          }
          // Get the most recent audio message
          const latestAudio = audioMessages[audioMessages.length - 1];
          targetMessageId = latestAudio.id;
          log(`Found latest audio message: ${targetMessageId}`);
        }

        // Download the audio
        const media = await whatsappClient.downloadMedia(targetMessageId, targetChatId);
        if (!media) {
          return JSON.stringify({ error: 'Failed to download audio message' });
        }

        // Check if it's actually audio
        if (!media.mimetype.startsWith('audio/')) {
          return JSON.stringify({ error: `Message is not audio (type: ${media.mimetype})` });
        }

        // Transcribe
        const result = await transcribeAudio(media.data, media.mimetype);
        if (!result) {
          return JSON.stringify({ error: 'Transcription failed' });
        }

        return JSON.stringify({
          success: true,
          messageId: targetMessageId,
          chatId: targetChatId,
          text: result.text,
          language: result.language,
        });
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Transcription failed' });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function main() {
  const server = new Server(
    {
      name: 'whatsapp-mcp-server',
      version: '0.9.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Special handling for QR code - return as image
      if (name === 'whatsapp_get_qr_code') {
        const status = whatsappClient.getStatus();
        if (status.ready) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: 'WhatsApp is already connected. No QR code needed.' }) }]
          };
        }
        if (!status.qrCode) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: 'No QR code available yet. Wait a moment and try again.' }) }]
          };
        }
        const qrBase64 = await whatsappClient.getQRCodeBase64();
        if (qrBase64) {
          // Extract just the base64 data (remove "data:image/png;base64," prefix)
          const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
          const qrFilePath = new URL('../qr-code.png', import.meta.url).pathname;
          return {
            content: [
              { type: 'text', text: `Scan this QR code with WhatsApp:\n(Settings → Linked Devices → Link a Device)\n\nOr open file: file://${qrFilePath}` },
              { type: 'image', data: base64Data, mimeType: 'image/png' }
            ]
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Failed to generate QR code' }) }],
          isError: true
        };
      }

      const result = await handleToolCall(name, args || {});
      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true
      };
    }
  });

  // Initialize WhatsApp client
  console.error('Starting WhatsApp MCP Server (whatsapp-web.js)...');
  whatsappClient.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp:', err);
  });

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('WhatsApp MCP Server is running');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down...');
    await whatsappClient.destroy();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
