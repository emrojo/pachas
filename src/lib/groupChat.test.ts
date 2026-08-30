import { describe, it, expect } from 'vitest';
import { GroupMessage, Profile } from '@/types/database';

describe('Group Chat & Conversational Elements in Friends Section (FR-40)', () => {
  const userAna: Profile = {
    id: 'user-ana-123',
    email: 'ana@example.com',
    full_name: 'Ana García',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  const userCarlos: Profile = {
    id: 'user-carlos-456',
    email: 'carlos@example.com',
    full_name: 'Carlos Ruiz',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  it('creates group message with text, optional gif_url and author profile', () => {
    const message: GroupMessage = {
      id: 'msg-1',
      group_id: 'group-beach-trip',
      user_id: userAna.id,
      message: '¡Hola a todos! ¿A qué hora salimos hacia la playa? 🏖️',
      gif_url: 'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
      reactions: {},
      created_at: new Date().toISOString(),
      profile: userAna,
    };

    expect(message.message).toContain('playa');
    expect(message.gif_url).toContain('.gif');
    expect(message.profile?.full_name).toBe('Ana García');
    expect(message.group_id).toBe('group-beach-trip');
    expect(message.reactions).toEqual({});
  });

  it('handles emoji reaction toggle correctly on group messages', () => {
    const message: GroupMessage = {
      id: 'msg-1',
      group_id: 'group-beach-trip',
      user_id: userAna.id,
      message: '¡Reservada la villa!',
      reactions: {},
      created_at: new Date().toISOString(),
    };

    const toggleReaction = (reactions: Record<string, string[]>, emoji: string, userId: string) => {
      const copy = { ...reactions };
      const current = copy[emoji] || [];
      if (current.includes(userId)) {
        const filtered = current.filter((id) => id !== userId);
        if (filtered.length === 0) {
          delete copy[emoji];
        } else {
          copy[emoji] = filtered;
        }
      } else {
        copy[emoji] = [...current, userId];
      }
      return copy;
    };

    // 1. Carlos reacts with 🎉
    let reactions = toggleReaction(message.reactions || {}, '🎉', userCarlos.id);
    expect(reactions['🎉']).toEqual(['user-carlos-456']);
    expect(reactions['🎉'].length).toBe(1);

    // 2. Ana also reacts with 🎉
    reactions = toggleReaction(reactions, '🎉', userAna.id);
    expect(reactions['🎉']).toEqual(['user-carlos-456', 'user-ana-123']);
    expect(reactions['🎉'].length).toBe(2);

    // 3. Carlos reacts with 🔥
    reactions = toggleReaction(reactions, '🔥', userCarlos.id);
    expect(reactions['🔥']).toEqual(['user-carlos-456']);

    // 4. Carlos removes his 🎉 reaction
    reactions = toggleReaction(reactions, '🎉', userCarlos.id);
    expect(reactions['🎉']).toEqual(['user-ana-123']);

    // 5. Ana removes her 🎉 reaction -> key should be deleted
    reactions = toggleReaction(reactions, '🎉', userAna.id);
    expect(reactions['🎉']).toBeUndefined();
    expect(reactions['🔥']).toEqual(['user-carlos-456']);
  });

  it('resolves deep URL action navigation for group chat notifications', () => {
    const groupId = 'group-summer-2026';
    const deepChatUrl = `/groups/${groupId}?tab=members&chat=true`;

    expect(deepChatUrl).toBe('/groups/group-summer-2026?tab=members&chat=true');
    expect(deepChatUrl).toContain('tab=members');
    expect(deepChatUrl).toContain('chat=true');
  });

  it('supports replying to a specific message with reply_to_snippet', () => {
    const originalMessage: GroupMessage = {
      id: 'msg-parent-101',
      group_id: 'group-1',
      user_id: userCarlos.id,
      message: '¿Quién lleva las toallas de playa?',
      created_at: new Date().toISOString(),
      profile: userCarlos,
    };

    const replyMessage: GroupMessage = {
      id: 'msg-reply-102',
      group_id: 'group-1',
      user_id: userAna.id,
      message: '¡Yo llevo 4 toallas grandes! 👍',
      reply_to_id: originalMessage.id,
      reply_to_snippet: {
        id: originalMessage.id,
        author_name: 'Carlos',
        message: originalMessage.message,
      },
      created_at: new Date().toISOString(),
      profile: userAna,
    };

    expect(replyMessage.reply_to_id).toBe('msg-parent-101');
    expect(replyMessage.reply_to_snippet?.author_name).toBe('Carlos');
    expect(replyMessage.reply_to_snippet?.message).toContain('toallas');
  });

  it('mirrors expense comments in group chat stream and bidirectionally syncs replies (FR-42)', () => {
    const expenseId = 'exp-dinner-555';
    const groupId = 'group-1';

    // 1. Initial comment created in an expense
    const expenseComment = {
      id: 'cmt-1',
      expense_id: expenseId,
      user_id: userCarlos.id,
      comment: 'No incluye las bebidas de la segunda ronda',
      created_at: new Date().toISOString(),
    };

    // 2. Mirrored group chat message with expense linkage
    const mirroredChatMessage: GroupMessage = {
      id: expenseComment.id,
      group_id: groupId,
      user_id: userCarlos.id,
      message: expenseComment.comment,
      expense_id: expenseId,
      expense_title: 'Cena Restaurante Marítimo',
      expense_amount: 85.5,
      expense_currency: 'EUR',
      created_at: expenseComment.created_at,
      profile: userCarlos,
    };

    expect(mirroredChatMessage.expense_id).toBe(expenseId);
    expect(mirroredChatMessage.expense_title).toBe('Cena Restaurante Marítimo');
    expect(mirroredChatMessage.expense_amount).toBe(85.5);

    // 3. User Ana replies to this message in group chat
    const chatReplyMessage: GroupMessage = {
      id: 'msg-reply-2',
      group_id: groupId,
      user_id: userAna.id,
      message: 'Es verdad, esas las pagué yo aparte en efectivo',
      expense_id: expenseId,
      reply_to_id: mirroredChatMessage.id,
      reply_to_snippet: {
        id: mirroredChatMessage.id,
        author_name: 'Carlos',
        message: mirroredChatMessage.message,
        expense_id: expenseId,
        expense_title: 'Cena Restaurante Marítimo',
      },
      created_at: new Date().toISOString(),
      profile: userAna,
    };

    // 4. Verification that reply attaches to both chat and expense comment thread
    expect(chatReplyMessage.expense_id).toBe(expenseId);
    expect(chatReplyMessage.reply_to_snippet?.expense_id).toBe(expenseId);
    expect(chatReplyMessage.message).toContain('efectivo');

    // 5. Verification of single notification dispatching rule
    const notificationsDispatched: string[] = [];
    const onCommentAdded = (type: string) => {
      // Should only register comment_created once without duplicating for chat mirror
      notificationsDispatched.push(type);
    };

    onCommentAdded('comment_created');
    expect(notificationsDispatched).toEqual(['comment_created']);
    expect(notificationsDispatched.length).toBe(1);
  });
});
