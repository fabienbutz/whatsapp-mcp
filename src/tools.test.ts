import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. Zod schemas (duplicated from index.ts to test independently without
//    triggering side-effects from whatsapp-client.ts / MCP server startup)
// ---------------------------------------------------------------------------

const reactSchema = z.object({
  messageId: z.string(),
  chatId: z.string(),
  emoji: z.string(),
});

const replySchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  message: z.string(),
});

const deleteMessageSchema = z.object({
  messageId: z.string(),
  chatId: z.string(),
  forEveryone: z.boolean().default(true),
});

const editMessageSchema = z.object({
  messageId: z.string(),
  chatId: z.string(),
  newText: z.string(),
});

const typingIndicatorSchema = z.object({
  chatId: z.string(),
  action: z.enum(['typing', 'recording', 'stop']),
});

// ---------------------------------------------------------------------------
// 2. Zod schema validation tests
// ---------------------------------------------------------------------------

describe('Zod schemas', () => {
  describe('reactSchema', () => {
    it('accepts valid input', () => {
      const result = reactSchema.parse({
        messageId: 'msg_123',
        chatId: '4915123456789@c.us',
        emoji: '👍',
      });
      expect(result).toEqual({
        messageId: 'msg_123',
        chatId: '4915123456789@c.us',
        emoji: '👍',
      });
    });

    it('rejects missing messageId', () => {
      expect(() =>
        reactSchema.parse({ chatId: '123@c.us', emoji: '👍' })
      ).toThrow();
    });

    it('rejects missing emoji', () => {
      expect(() =>
        reactSchema.parse({ messageId: 'msg_1', chatId: '123@c.us' })
      ).toThrow();
    });

    it('rejects non-string emoji', () => {
      expect(() =>
        reactSchema.parse({ messageId: 'msg_1', chatId: '123@c.us', emoji: 42 })
      ).toThrow();
    });
  });

  describe('replySchema', () => {
    it('accepts valid input', () => {
      const result = replySchema.parse({
        chatId: '123@c.us',
        messageId: 'msg_1',
        message: 'Hello',
      });
      expect(result.message).toBe('Hello');
    });

    it('rejects missing message', () => {
      expect(() =>
        replySchema.parse({ chatId: '123@c.us', messageId: 'msg_1' })
      ).toThrow();
    });
  });

  describe('deleteMessageSchema', () => {
    it('defaults forEveryone to true', () => {
      const result = deleteMessageSchema.parse({
        messageId: 'msg_1',
        chatId: '123@c.us',
      });
      expect(result.forEveryone).toBe(true);
    });

    it('respects explicit forEveryone=false', () => {
      const result = deleteMessageSchema.parse({
        messageId: 'msg_1',
        chatId: '123@c.us',
        forEveryone: false,
      });
      expect(result.forEveryone).toBe(false);
    });

    it('rejects non-boolean forEveryone', () => {
      expect(() =>
        deleteMessageSchema.parse({
          messageId: 'msg_1',
          chatId: '123@c.us',
          forEveryone: 'yes',
        })
      ).toThrow();
    });
  });

  describe('editMessageSchema', () => {
    it('accepts valid input', () => {
      const result = editMessageSchema.parse({
        messageId: 'msg_1',
        chatId: '123@c.us',
        newText: 'edited text',
      });
      expect(result.newText).toBe('edited text');
    });

    it('rejects missing newText', () => {
      expect(() =>
        editMessageSchema.parse({ messageId: 'msg_1', chatId: '123@c.us' })
      ).toThrow();
    });
  });

  describe('typingIndicatorSchema', () => {
    it('accepts typing action', () => {
      const result = typingIndicatorSchema.parse({
        chatId: '123@c.us',
        action: 'typing',
      });
      expect(result.action).toBe('typing');
    });

    it('accepts recording action', () => {
      const result = typingIndicatorSchema.parse({
        chatId: '123@c.us',
        action: 'recording',
      });
      expect(result.action).toBe('recording');
    });

    it('accepts stop action', () => {
      const result = typingIndicatorSchema.parse({
        chatId: '123@c.us',
        action: 'stop',
      });
      expect(result.action).toBe('stop');
    });

    it('rejects invalid action', () => {
      expect(() =>
        typingIndicatorSchema.parse({ chatId: '123@c.us', action: 'dancing' })
      ).toThrow();
    });

    it('rejects missing action', () => {
      expect(() =>
        typingIndicatorSchema.parse({ chatId: '123@c.us' })
      ).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Handler logic tests (mock WhatsApp client)
// ---------------------------------------------------------------------------

// Minimal mock that mirrors the client methods used by the 5 new handlers
function createMockClient() {
  return {
    isClientReady: vi.fn(() => true),
    react: vi.fn(async () => ({ success: true })),
    replyToMessage: vi.fn(async () => ({ success: true, messageId: 'reply_1' })),
    deleteMessage: vi.fn(async () => ({ success: true })),
    editMessage: vi.fn(async () => ({ success: true })),
    setTypingState: vi.fn(async () => ({ success: true })),
  };
}

// Replicates the handler switch-case logic from index.ts without importing it
async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: ReturnType<typeof createMockClient>,
): Promise<string> {
  switch (name) {
    case 'whatsapp_react': {
      const parsed = reactSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.react(parsed.messageId, parsed.chatId, parsed.emoji);
        return JSON.stringify({ ...result, emoji: parsed.emoji, messageId: parsed.messageId });
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to react to message' });
      }
    }
    case 'whatsapp_reply': {
      const parsed = replySchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.replyToMessage(parsed.chatId, parsed.messageId, parsed.message);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to reply to message' });
      }
    }
    case 'whatsapp_delete_message': {
      const parsed = deleteMessageSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.deleteMessage(parsed.messageId, parsed.chatId, parsed.forEveryone);
        return JSON.stringify({ ...result, messageId: parsed.messageId, forEveryone: parsed.forEveryone });
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to delete message' });
      }
    }
    case 'whatsapp_edit_message': {
      const parsed = editMessageSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.editMessage(parsed.messageId, parsed.chatId, parsed.newText);
        return JSON.stringify({ ...result, messageId: parsed.messageId });
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to edit message' });
      }
    }
    case 'whatsapp_typing_indicator': {
      const parsed = typingIndicatorSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.setTypingState(parsed.chatId, parsed.action);
        return JSON.stringify({ ...result, chatId: parsed.chatId, action: parsed.action });
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to set typing indicator' });
      }
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

describe('Tool handlers', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  // -- whatsapp_react -------------------------------------------------------

  describe('whatsapp_react', () => {
    it('calls client.react and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_react', {
          messageId: 'msg_1',
          chatId: '123@c.us',
          emoji: '❤️',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(result.emoji).toBe('❤️');
      expect(client.react).toHaveBeenCalledWith('msg_1', '123@c.us', '❤️');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_react', {
          messageId: 'msg_1',
          chatId: '123@c.us',
          emoji: '👍',
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.react).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.react.mockRejectedValue(new Error('Message not found'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_react', {
          messageId: 'msg_1',
          chatId: '123@c.us',
          emoji: '👍',
        }, client),
      );
      expect(result.error).toBe('Message not found');
    });

    it('throws ZodError on invalid input', async () => {
      await expect(
        handleToolCall('whatsapp_react', { messageId: 'msg_1' }, client),
      ).rejects.toThrow();
    });
  });

  // -- whatsapp_reply -------------------------------------------------------

  describe('whatsapp_reply', () => {
    it('calls client.replyToMessage and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_reply', {
          chatId: '123@c.us',
          messageId: 'msg_1',
          message: 'Thanks!',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('reply_1');
      expect(client.replyToMessage).toHaveBeenCalledWith('123@c.us', 'msg_1', 'Thanks!');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_reply', {
          chatId: '123@c.us',
          messageId: 'msg_1',
          message: 'Hi',
        }, client),
      );
      expect(result.error).toContain('not connected');
    });

    it('returns error on client failure', async () => {
      client.replyToMessage.mockRejectedValue(new Error('Send failed'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_reply', {
          chatId: '123@c.us',
          messageId: 'msg_1',
          message: 'Hi',
        }, client),
      );
      expect(result.error).toBe('Send failed');
    });
  });

  // -- whatsapp_delete_message ----------------------------------------------

  describe('whatsapp_delete_message', () => {
    it('calls client.deleteMessage with forEveryone=true by default', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_delete_message', {
          messageId: 'msg_1',
          chatId: '123@c.us',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(result.forEveryone).toBe(true);
      expect(client.deleteMessage).toHaveBeenCalledWith('msg_1', '123@c.us', true);
    });

    it('passes forEveryone=false when specified', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_delete_message', {
          messageId: 'msg_1',
          chatId: '123@c.us',
          forEveryone: false,
        }, client),
      );
      expect(result.forEveryone).toBe(false);
      expect(client.deleteMessage).toHaveBeenCalledWith('msg_1', '123@c.us', false);
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_delete_message', {
          messageId: 'msg_1',
          chatId: '123@c.us',
        }, client),
      );
      expect(result.error).toContain('not connected');
    });
  });

  // -- whatsapp_edit_message ------------------------------------------------

  describe('whatsapp_edit_message', () => {
    it('calls client.editMessage and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_edit_message', {
          messageId: 'msg_1',
          chatId: '123@c.us',
          newText: 'corrected text',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_1');
      expect(client.editMessage).toHaveBeenCalledWith('msg_1', '123@c.us', 'corrected text');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_edit_message', {
          messageId: 'msg_1',
          chatId: '123@c.us',
          newText: 'new',
        }, client),
      );
      expect(result.error).toContain('not connected');
    });

    it('returns error on client failure', async () => {
      client.editMessage.mockRejectedValue(new Error('Edit window expired'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_edit_message', {
          messageId: 'msg_1',
          chatId: '123@c.us',
          newText: 'new',
        }, client),
      );
      expect(result.error).toBe('Edit window expired');
    });
  });

  // -- whatsapp_typing_indicator --------------------------------------------

  describe('whatsapp_typing_indicator', () => {
    it('calls setTypingState with typing', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_typing_indicator', {
          chatId: '123@c.us',
          action: 'typing',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(result.action).toBe('typing');
      expect(client.setTypingState).toHaveBeenCalledWith('123@c.us', 'typing');
    });

    it('calls setTypingState with recording', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_typing_indicator', {
          chatId: '123@c.us',
          action: 'recording',
        }, client),
      );
      expect(result.action).toBe('recording');
      expect(client.setTypingState).toHaveBeenCalledWith('123@c.us', 'recording');
    });

    it('calls setTypingState with stop', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_typing_indicator', {
          chatId: '123@c.us',
          action: 'stop',
        }, client),
      );
      expect(result.action).toBe('stop');
      expect(client.setTypingState).toHaveBeenCalledWith('123@c.us', 'stop');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_typing_indicator', {
          chatId: '123@c.us',
          action: 'typing',
        }, client),
      );
      expect(result.error).toContain('not connected');
    });

    it('throws ZodError on invalid action', async () => {
      await expect(
        handleToolCall('whatsapp_typing_indicator', {
          chatId: '123@c.us',
          action: 'invalid',
        }, client),
      ).rejects.toThrow();
    });
  });

  // -- unknown tool ---------------------------------------------------------

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_nonexistent', {}, client),
      );
      expect(result.error).toContain('Unknown tool');
    });
  });
});
