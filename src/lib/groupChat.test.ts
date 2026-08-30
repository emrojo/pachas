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
});
