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
interface StoredMessage {
    id: string;
    from: string;
    to: string;
    body: string;
    timestamp: number;
    fromMe: boolean;
    pushName?: string;
    hasMedia?: boolean;
    mediaType?: string;
}
export declare function log(...args: unknown[]): void;
export declare function getLogs(limit?: number): string[];
declare class WhatsAppClientWrapper {
    private client;
    private isReady;
    private qrCode;
    private qrImagePath;
    private contacts;
    private messages;
    constructor();
    private loadContactsFromFile;
    private saveContactsToFile;
    initialize(): Promise<void>;
    private readyPollingStarted;
    private authReceived;
    private checkReadyAfterAuth;
    private startReadyPolling;
    private syncContacts;
    getStatus(): Promise<{
        ready: boolean;
        browserAlive: boolean;
        qrCode: string | null;
        qrImagePath: string | null;
        contactCount: number;
    }>;
    getQRCodeBase64(): Promise<string | null>;
    isClientReady(): boolean;
    private formatPhoneNumber;
    getChats(limit?: number): Promise<WhatsAppChat[]>;
    getContacts(): Promise<WhatsAppContact[]>;
    findContactByName(name: string): Promise<string | null>;
    getMessages(chatId: string, limit?: number): Promise<StoredMessage[]>;
    fetchMessages(chatId: string, limit?: number): Promise<StoredMessage[]>;
    getMessagesByContactName(name: string, limit?: number): Promise<{
        contactId: string;
        contactName: string;
        messages: StoredMessage[];
        totalStored: number;
    } | null>;
    getMessagesByPhoneNumber(phone: string, limit?: number): Promise<{
        contactId: string;
        contactName: string;
        messages: StoredMessage[];
        totalStored: number;
    } | null>;
    getRecentMessages(limit?: number): {
        chatId: string;
        chatName: string;
        messages: StoredMessage[];
    }[];
    sendMessage(recipient: string, message: string): Promise<SendResult>;
    sendMessageToContact(name: string, message: string): Promise<SendResult>;
    searchMessages(query: string, chatId?: string, limit?: number): Promise<{
        chatId: string;
        chatName: string;
        messages: StoredMessage[];
    }[]>;
    downloadMedia(messageId: string, chatId: string): Promise<{
        data: string;
        mimetype: string;
        filename?: string;
    } | null>;
    sendImage(recipient: string, imageData: string, caption?: string, isUrl?: boolean): Promise<SendResult>;
    sendDocument(recipient: string, documentData: string, filename?: string, isUrl?: boolean): Promise<SendResult>;
    getAudioMessages(chatId: string, limit?: number): Promise<StoredMessage[]>;
    react(messageId: string, chatId: string, emoji: string): Promise<{
        success: boolean;
    }>;
    replyToMessage(chatId: string, messageId: string, message: string): Promise<SendResult>;
    deleteMessage(messageId: string, chatId: string, forEveryone?: boolean): Promise<{
        success: boolean;
    }>;
    editMessage(messageId: string, chatId: string, newText: string): Promise<{
        success: boolean;
    }>;
    setTypingState(chatId: string, action: 'typing' | 'recording' | 'stop'): Promise<{
        success: boolean;
    }>;
    listGroups(limit?: number): Promise<WhatsAppChat[]>;
    getGroupInfo(chatId: string): Promise<object>;
    createGroup(name: string, participants: string[]): Promise<{
        groupId: string;
    }>;
    addGroupParticipants(chatId: string, participants: string[]): Promise<{
        success: boolean;
    }>;
    removeGroupParticipants(chatId: string, participants: string[]): Promise<{
        success: boolean;
    }>;
    setGroupSubject(chatId: string, subject: string): Promise<{
        success: boolean;
    }>;
    setGroupDescription(chatId: string, description: string): Promise<{
        success: boolean;
    }>;
    leaveGroup(chatId: string): Promise<{
        success: boolean;
    }>;
    getGroupInviteLink(chatId: string): Promise<{
        inviteLink: string;
    }>;
    destroy(): Promise<void>;
    reconnect(): Promise<{
        success: boolean;
        message: string;
    }>;
    requestHistorySync(): Promise<void>;
    fetchMoreMessages(chatId: string, count?: number): Promise<{
        fetched: boolean;
        messageCount: number;
        newMessages: number;
    }>;
    resetAuth(): Promise<void>;
}
export declare const whatsappClient: WhatsAppClientWrapper;
export {};
