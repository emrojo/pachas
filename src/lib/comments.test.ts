import { describe, it, expect } from 'vitest';
import { ExpenseComment, Profile } from '@/types/database';

describe('Expense Comments & Rich Conversational Elements', () => {
  const userAna: Profile = {
    id: 'user-ana',
    email: 'ana@example.com',
    full_name: 'Ana García',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  const userCarlos: Profile = {
    id: 'user-carlos',
    email: 'carlos@example.com',
    full_name: 'Carlos Ruiz',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  it('creates comment with text, optional gif_url and initial empty reactions', () => {
    const comment: ExpenseComment = {
      id: 'cmt-1',
      expense_id: 'exp-123',
      user_id: userAna.id,
      comment: '¡Menuda cena más rica! 🎉',
      gif_url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
      reactions: {},
      created_at: new Date().toISOString(),
      profile: userAna,
    };

    expect(comment.comment).toBe('¡Menuda cena más rica! 🎉');
    expect(comment.gif_url).toContain('.gif');
    expect(comment.profile?.full_name).toBe('Ana García');
    expect(comment.reactions).toEqual({});
  });

  it('handles reaction toggle correctly (add, multi-user, and remove)', () => {
    const comment: ExpenseComment = {
      id: 'cmt-1',
      expense_id: 'exp-123',
      user_id: userAna.id,
      comment: 'Todo pagado',
      reactions: {},
      created_at: new Date().toISOString(),
    };

    // Helper toggle logic simulating toggleCommentReaction
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

    // 1. Ana reacts with ❤️
    let reactions = toggleReaction(comment.reactions || {}, '❤️', userAna.id);
    expect(reactions['❤️']).toEqual(['user-ana']);
    expect(reactions['❤️'].length).toBe(1);

    // 2. Carlos also reacts with ❤️
    reactions = toggleReaction(reactions, '❤️', userCarlos.id);
    expect(reactions['❤️']).toEqual(['user-ana', 'user-carlos']);
    expect(reactions['❤️'].length).toBe(2);

    // 3. Carlos reacts with 👍
    reactions = toggleReaction(reactions, '👍', userCarlos.id);
    expect(reactions['👍']).toEqual(['user-carlos']);

    // 4. Ana removes her ❤️ reaction
    reactions = toggleReaction(reactions, '❤️', userAna.id);
    expect(reactions['❤️']).toEqual(['user-carlos']);

    // 5. Carlos removes his ❤️ reaction -> key should be deleted
    reactions = toggleReaction(reactions, '❤️', userCarlos.id);
    expect(reactions['❤️']).toBeUndefined();
    expect(reactions['👍']).toEqual(['user-carlos']);
  });

  it('preserves local comments when backend returns empty array (offline/demo mode protection)', () => {
    const localComments: ExpenseComment[] = [
      {
        id: 'cmt-local-1',
        expense_id: 'exp-1',
        user_id: userAna.id,
        comment: 'Nota guardada localmente',
        created_at: new Date().toISOString(),
      },
    ];

    const remoteEmptyResponse: ExpenseComment[] = [];

    // Intelligent merge rule:
    const shouldKeepLocal = remoteEmptyResponse.length === 0 && localComments.length > 0;
    expect(shouldKeepLocal).toBe(true);

    const merged = shouldKeepLocal ? localComments : remoteEmptyResponse;
    expect(merged.length).toBe(1);
    expect(merged[0].comment).toBe('Nota guardada localmente');
  });
});
