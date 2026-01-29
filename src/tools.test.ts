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

const listGroupsSchema = z.object({
  limit: z.number().optional().default(20),
});

const groupInfoSchema = z.object({
  chatId: z.string(),
});

const createGroupSchema = z.object({
  name: z.string(),
  participants: z.array(z.string()),
});

const groupParticipantsSchema = z.object({
  chatId: z.string(),
  participants: z.array(z.string()),
});

const groupSubjectSchema = z.object({
  chatId: z.string(),
  subject: z.string(),
});

const groupDescriptionSchema = z.object({
  chatId: z.string(),
  description: z.string(),
});

const leaveGroupSchema = z.object({
  chatId: z.string(),
});

const groupInviteLinkSchema = z.object({
  chatId: z.string(),
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

  describe('listGroupsSchema', () => {
    it('defaults limit to 20', () => {
      const result = listGroupsSchema.parse({});
      expect(result.limit).toBe(20);
    });

    it('accepts explicit limit', () => {
      const result = listGroupsSchema.parse({ limit: 50 });
      expect(result.limit).toBe(50);
    });

    it('rejects non-number limit', () => {
      expect(() => listGroupsSchema.parse({ limit: 'all' })).toThrow();
    });
  });

  describe('groupInfoSchema', () => {
    it('accepts valid input', () => {
      const result = groupInfoSchema.parse({ chatId: 'group1@g.us' });
      expect(result.chatId).toBe('group1@g.us');
    });

    it('rejects missing chatId', () => {
      expect(() => groupInfoSchema.parse({})).toThrow();
    });

    it('rejects non-string chatId', () => {
      expect(() => groupInfoSchema.parse({ chatId: 123 })).toThrow();
    });
  });

  describe('createGroupSchema', () => {
    it('accepts valid input', () => {
      const result = createGroupSchema.parse({
        name: 'New Group',
        participants: ['123@c.us', '456@c.us'],
      });
      expect(result.name).toBe('New Group');
      expect(result.participants).toEqual(['123@c.us', '456@c.us']);
    });

    it('rejects missing name', () => {
      expect(() =>
        createGroupSchema.parse({ participants: ['123@c.us'] })
      ).toThrow();
    });

    it('rejects missing participants', () => {
      expect(() =>
        createGroupSchema.parse({ name: 'Group' })
      ).toThrow();
    });

    it('rejects non-array participants', () => {
      expect(() =>
        createGroupSchema.parse({ name: 'Group', participants: '123@c.us' })
      ).toThrow();
    });
  });

  describe('groupParticipantsSchema', () => {
    it('accepts valid input', () => {
      const result = groupParticipantsSchema.parse({
        chatId: 'group1@g.us',
        participants: ['123@c.us'],
      });
      expect(result.chatId).toBe('group1@g.us');
      expect(result.participants).toEqual(['123@c.us']);
    });

    it('rejects missing chatId', () => {
      expect(() =>
        groupParticipantsSchema.parse({ participants: ['123@c.us'] })
      ).toThrow();
    });

    it('rejects missing participants', () => {
      expect(() =>
        groupParticipantsSchema.parse({ chatId: 'group1@g.us' })
      ).toThrow();
    });

    it('rejects non-array participants', () => {
      expect(() =>
        groupParticipantsSchema.parse({ chatId: 'group1@g.us', participants: '123@c.us' })
      ).toThrow();
    });
  });

  describe('groupSubjectSchema', () => {
    it('accepts valid input', () => {
      const result = groupSubjectSchema.parse({
        chatId: 'group1@g.us',
        subject: 'New Subject',
      });
      expect(result.subject).toBe('New Subject');
    });

    it('rejects missing subject', () => {
      expect(() =>
        groupSubjectSchema.parse({ chatId: 'group1@g.us' })
      ).toThrow();
    });

    it('rejects non-string subject', () => {
      expect(() =>
        groupSubjectSchema.parse({ chatId: 'group1@g.us', subject: 42 })
      ).toThrow();
    });
  });

  describe('groupDescriptionSchema', () => {
    it('accepts valid input', () => {
      const result = groupDescriptionSchema.parse({
        chatId: 'group1@g.us',
        description: 'A description',
      });
      expect(result.description).toBe('A description');
    });

    it('rejects missing description', () => {
      expect(() =>
        groupDescriptionSchema.parse({ chatId: 'group1@g.us' })
      ).toThrow();
    });

    it('rejects non-string description', () => {
      expect(() =>
        groupDescriptionSchema.parse({ chatId: 'group1@g.us', description: 123 })
      ).toThrow();
    });
  });

  describe('leaveGroupSchema', () => {
    it('accepts valid input', () => {
      const result = leaveGroupSchema.parse({ chatId: 'group1@g.us' });
      expect(result.chatId).toBe('group1@g.us');
    });

    it('rejects missing chatId', () => {
      expect(() => leaveGroupSchema.parse({})).toThrow();
    });

    it('rejects non-string chatId', () => {
      expect(() => leaveGroupSchema.parse({ chatId: 42 })).toThrow();
    });
  });

  describe('groupInviteLinkSchema', () => {
    it('accepts valid input', () => {
      const result = groupInviteLinkSchema.parse({ chatId: 'group1@g.us' });
      expect(result.chatId).toBe('group1@g.us');
    });

    it('rejects missing chatId', () => {
      expect(() => groupInviteLinkSchema.parse({})).toThrow();
    });

    it('rejects non-string chatId', () => {
      expect(() => groupInviteLinkSchema.parse({ chatId: 123 })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Handler logic tests (mock WhatsApp client)
// ---------------------------------------------------------------------------

// Minimal mock that mirrors the client methods used by the handlers
function createMockClient() {
  return {
    isClientReady: vi.fn(() => true),
    react: vi.fn(async () => ({ success: true })),
    replyToMessage: vi.fn(async () => ({ success: true, messageId: 'reply_1' })),
    deleteMessage: vi.fn(async () => ({ success: true })),
    editMessage: vi.fn(async () => ({ success: true })),
    setTypingState: vi.fn(async () => ({ success: true })),
    listGroups: vi.fn(async () => [{ id: 'group1@g.us', name: 'Test Group', isGroup: true, unreadCount: 0, timestamp: Date.now() }]),
    getGroupInfo: vi.fn(async () => ({ id: 'group1@g.us', name: 'Test Group', description: 'A test group', participants: [], owner: '123@c.us' })),
    createGroup: vi.fn(async () => ({ groupId: 'newgroup@g.us' })),
    addGroupParticipants: vi.fn(async () => ({ success: true })),
    removeGroupParticipants: vi.fn(async () => ({ success: true })),
    setGroupSubject: vi.fn(async () => ({ success: true })),
    setGroupDescription: vi.fn(async () => ({ success: true })),
    leaveGroup: vi.fn(async () => ({ success: true })),
    getGroupInviteLink: vi.fn(async () => ({ inviteLink: 'https://chat.whatsapp.com/abc123' })),
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
    case 'whatsapp_list_groups': {
      const parsed = listGroupsSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.listGroups(parsed.limit);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to list groups' });
      }
    }
    case 'whatsapp_group_info': {
      const parsed = groupInfoSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.getGroupInfo(parsed.chatId);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to get group info' });
      }
    }
    case 'whatsapp_create_group': {
      const parsed = createGroupSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.createGroup(parsed.name, parsed.participants);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to create group' });
      }
    }
    case 'whatsapp_group_add_participants': {
      const parsed = groupParticipantsSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.addGroupParticipants(parsed.chatId, parsed.participants);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to add participants' });
      }
    }
    case 'whatsapp_group_remove_participants': {
      const parsed = groupParticipantsSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.removeGroupParticipants(parsed.chatId, parsed.participants);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to remove participants' });
      }
    }
    case 'whatsapp_group_set_subject': {
      const parsed = groupSubjectSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.setGroupSubject(parsed.chatId, parsed.subject);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to set group subject' });
      }
    }
    case 'whatsapp_group_set_description': {
      const parsed = groupDescriptionSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.setGroupDescription(parsed.chatId, parsed.description);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to set group description' });
      }
    }
    case 'whatsapp_leave_group': {
      const parsed = leaveGroupSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.leaveGroup(parsed.chatId);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to leave group' });
      }
    }
    case 'whatsapp_group_invite_link': {
      const parsed = groupInviteLinkSchema.parse(args);
      if (!client.isClientReady()) {
        return JSON.stringify({ error: 'WhatsApp is not connected. Check status first.' });
      }
      try {
        const result = await client.getGroupInviteLink(parsed.chatId);
        return JSON.stringify(result);
      } catch (err: any) {
        return JSON.stringify({ error: err?.message || 'Failed to get invite link' });
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

  // -- whatsapp_list_groups --------------------------------------------------

  describe('whatsapp_list_groups', () => {
    it('calls client.listGroups and returns result', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_list_groups', {}, client),
      );
      expect(result).toBeInstanceOf(Array);
      expect(result[0].name).toBe('Test Group');
      expect(client.listGroups).toHaveBeenCalledWith(20);
    });

    it('passes explicit limit', async () => {
      await handleToolCall('whatsapp_list_groups', { limit: 50 }, client);
      expect(client.listGroups).toHaveBeenCalledWith(50);
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_list_groups', {}, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.listGroups).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.listGroups.mockRejectedValue(new Error('Network error'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_list_groups', {}, client),
      );
      expect(result.error).toBe('Network error');
    });
  });

  // -- whatsapp_group_info ---------------------------------------------------

  describe('whatsapp_group_info', () => {
    it('calls client.getGroupInfo and returns result', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_info', { chatId: 'group1@g.us' }, client),
      );
      expect(result.name).toBe('Test Group');
      expect(result.description).toBe('A test group');
      expect(client.getGroupInfo).toHaveBeenCalledWith('group1@g.us');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_info', { chatId: 'group1@g.us' }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.getGroupInfo).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.getGroupInfo.mockRejectedValue(new Error('Group not found'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_info', { chatId: 'group1@g.us' }, client),
      );
      expect(result.error).toBe('Group not found');
    });
  });

  // -- whatsapp_create_group -------------------------------------------------

  describe('whatsapp_create_group', () => {
    it('calls client.createGroup and returns result', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_create_group', {
          name: 'New Group',
          participants: ['123@c.us', '456@c.us'],
        }, client),
      );
      expect(result.groupId).toBe('newgroup@g.us');
      expect(client.createGroup).toHaveBeenCalledWith('New Group', ['123@c.us', '456@c.us']);
    });

    it('passes name and participants array correctly', async () => {
      await handleToolCall('whatsapp_create_group', {
        name: 'My Group',
        participants: ['789@c.us'],
      }, client);
      expect(client.createGroup).toHaveBeenCalledWith('My Group', ['789@c.us']);
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_create_group', {
          name: 'New Group',
          participants: ['123@c.us'],
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.createGroup).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.createGroup.mockRejectedValue(new Error('Insufficient permissions'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_create_group', {
          name: 'New Group',
          participants: ['123@c.us'],
        }, client),
      );
      expect(result.error).toBe('Insufficient permissions');
    });
  });

  // -- whatsapp_group_add_participants ---------------------------------------

  describe('whatsapp_group_add_participants', () => {
    it('calls client.addGroupParticipants and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_add_participants', {
          chatId: 'group1@g.us',
          participants: ['123@c.us', '456@c.us'],
        }, client),
      );
      expect(result.success).toBe(true);
      expect(client.addGroupParticipants).toHaveBeenCalledWith('group1@g.us', ['123@c.us', '456@c.us']);
    });

    it('passes chatId and participants correctly', async () => {
      await handleToolCall('whatsapp_group_add_participants', {
        chatId: 'group2@g.us',
        participants: ['789@c.us'],
      }, client);
      expect(client.addGroupParticipants).toHaveBeenCalledWith('group2@g.us', ['789@c.us']);
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_add_participants', {
          chatId: 'group1@g.us',
          participants: ['123@c.us'],
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.addGroupParticipants).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.addGroupParticipants.mockRejectedValue(new Error('Not an admin'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_add_participants', {
          chatId: 'group1@g.us',
          participants: ['123@c.us'],
        }, client),
      );
      expect(result.error).toBe('Not an admin');
    });
  });

  // -- whatsapp_group_remove_participants ------------------------------------

  describe('whatsapp_group_remove_participants', () => {
    it('calls client.removeGroupParticipants and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_remove_participants', {
          chatId: 'group1@g.us',
          participants: ['123@c.us'],
        }, client),
      );
      expect(result.success).toBe(true);
      expect(client.removeGroupParticipants).toHaveBeenCalledWith('group1@g.us', ['123@c.us']);
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_remove_participants', {
          chatId: 'group1@g.us',
          participants: ['123@c.us'],
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.removeGroupParticipants).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.removeGroupParticipants.mockRejectedValue(new Error('Not an admin'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_remove_participants', {
          chatId: 'group1@g.us',
          participants: ['123@c.us'],
        }, client),
      );
      expect(result.error).toBe('Not an admin');
    });
  });

  // -- whatsapp_group_set_subject --------------------------------------------

  describe('whatsapp_group_set_subject', () => {
    it('calls client.setGroupSubject and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_set_subject', {
          chatId: 'group1@g.us',
          subject: 'New Name',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(client.setGroupSubject).toHaveBeenCalledWith('group1@g.us', 'New Name');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_set_subject', {
          chatId: 'group1@g.us',
          subject: 'New Name',
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.setGroupSubject).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.setGroupSubject.mockRejectedValue(new Error('Subject too long'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_set_subject', {
          chatId: 'group1@g.us',
          subject: 'New Name',
        }, client),
      );
      expect(result.error).toBe('Subject too long');
    });
  });

  // -- whatsapp_group_set_description ----------------------------------------

  describe('whatsapp_group_set_description', () => {
    it('calls client.setGroupDescription and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_set_description', {
          chatId: 'group1@g.us',
          description: 'Updated description',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(client.setGroupDescription).toHaveBeenCalledWith('group1@g.us', 'Updated description');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_set_description', {
          chatId: 'group1@g.us',
          description: 'Updated description',
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.setGroupDescription).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.setGroupDescription.mockRejectedValue(new Error('Not an admin'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_set_description', {
          chatId: 'group1@g.us',
          description: 'Updated description',
        }, client),
      );
      expect(result.error).toBe('Not an admin');
    });
  });

  // -- whatsapp_leave_group --------------------------------------------------

  describe('whatsapp_leave_group', () => {
    it('calls client.leaveGroup and returns success', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_leave_group', {
          chatId: 'group1@g.us',
        }, client),
      );
      expect(result.success).toBe(true);
      expect(client.leaveGroup).toHaveBeenCalledWith('group1@g.us');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_leave_group', {
          chatId: 'group1@g.us',
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.leaveGroup).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.leaveGroup.mockRejectedValue(new Error('Cannot leave group'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_leave_group', {
          chatId: 'group1@g.us',
        }, client),
      );
      expect(result.error).toBe('Cannot leave group');
    });
  });

  // -- whatsapp_group_invite_link --------------------------------------------

  describe('whatsapp_group_invite_link', () => {
    it('calls client.getGroupInviteLink and returns result', async () => {
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_invite_link', {
          chatId: 'group1@g.us',
        }, client),
      );
      expect(result.inviteLink).toBe('https://chat.whatsapp.com/abc123');
      expect(client.getGroupInviteLink).toHaveBeenCalledWith('group1@g.us');
    });

    it('returns error when client not ready', async () => {
      client.isClientReady.mockReturnValue(false);
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_invite_link', {
          chatId: 'group1@g.us',
        }, client),
      );
      expect(result.error).toContain('not connected');
      expect(client.getGroupInviteLink).not.toHaveBeenCalled();
    });

    it('returns error on client failure', async () => {
      client.getGroupInviteLink.mockRejectedValue(new Error('Not an admin'));
      const result = JSON.parse(
        await handleToolCall('whatsapp_group_invite_link', {
          chatId: 'group1@g.us',
        }, client),
      );
      expect(result.error).toBe('Not an admin');
    });
  });
});
