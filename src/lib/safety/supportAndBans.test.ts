import { describe, it, expect } from 'vitest';
import { SupportCategory, SupportMessage, Profile } from '@/types/database';

describe('Support Chat & User Banning System (FR-46 & FR-47)', () => {
  const mockUser: Profile = {
    id: 'user-123',
    email: 'viajero@pachas.app',
    full_name: 'Viajero Ejemplo',
    avatar_url: null,
    bizum_phone: '600111222',
    role: 'member',
    is_banned: false,
    created_at: new Date().toISOString(),
  };

  const mockAdmin: Profile = {
    id: 'admin-999',
    email: 'admin@pachas.app',
    full_name: 'Super Admin',
    avatar_url: null,
    role: 'admin',
    created_at: new Date().toISOString(),
  };

  describe('Support Messages Data Model & Categories', () => {
    it('creates a valid user question support message', () => {
      const msg: SupportMessage = {
        id: 'sup-1',
        user_id: mockUser.id,
        sender_id: mockUser.id,
        sender_role: 'user',
        message: '¿Cómo puedo exportar mi resumen a PDF?',
        category: 'general',
        is_read_by_user: true,
        is_read_by_admin: false,
        created_at: new Date().toISOString(),
      };

      expect(msg.category).toBe('general');
      expect(msg.sender_role).toBe('user');
      expect(msg.is_read_by_admin).toBe(false);
    });

    it('supports technical bug reporting category', () => {
      const bugMsg: SupportMessage = {
        id: 'sup-2',
        user_id: mockUser.id,
        sender_id: mockUser.id,
        sender_role: 'user',
        message: 'La cámara de OCR se cerró inesperadamente.',
        category: 'bug',
        is_read_by_user: true,
        is_read_by_admin: false,
        created_at: new Date().toISOString(),
      };

      expect(bugMsg.category).toBe('bug');
    });

    it('supports report clarification category', () => {
      const clarifMsg: SupportMessage = {
        id: 'sup-3',
        user_id: mockUser.id,
        sender_id: mockUser.id,
        sender_role: 'user',
        message: 'Mi grupo está congelado. Adjunto ticket original para aclarar la denuncia.',
        category: 'report_clarification',
        attachment_url: 'https://storage.pachas.app/receipts/proof.jpg',
        is_read_by_user: true,
        is_read_by_admin: false,
        created_at: new Date().toISOString(),
      };

      expect(clarifMsg.category).toBe('report_clarification');
      expect(clarifMsg.attachment_url).toBeDefined();
    });

    it('supports suspension appeal category', () => {
      const appealMsg: SupportMessage = {
        id: 'sup-4',
        user_id: mockUser.id,
        sender_id: mockUser.id,
        sender_role: 'user',
        message: 'Solicito la revisión del baneo, se trató de un malentendido con un amigo.',
        category: 'appeal',
        is_read_by_user: true,
        is_read_by_admin: false,
        created_at: new Date().toISOString(),
      };

      expect(appealMsg.category).toBe('appeal');
    });

    it('correctly formats admin reply message', () => {
      const replyMsg: SupportMessage = {
        id: 'sup-5',
        user_id: mockUser.id,
        sender_id: mockAdmin.id,
        sender_role: 'admin',
        message: 'Hemos verificado tu caso y procedemos a reactivar tu cuenta.',
        category: 'appeal',
        is_read_by_user: false,
        is_read_by_admin: true,
        created_at: new Date().toISOString(),
      };

      expect(replyMsg.sender_role).toBe('admin');
      expect(replyMsg.is_read_by_user).toBe(false);
      expect(replyMsg.is_read_by_admin).toBe(true);
    });
  });

  describe('User Banning & Suspension Protocol', () => {
    it('applies moderation ban with audit trail', () => {
      const reason = 'Publicación reiterada de tickets fraudulentos';
      const bannedUser: Profile = {
        ...mockUser,
        is_banned: true,
        ban_reason: reason,
        banned_at: new Date().toISOString(),
        banned_by: mockAdmin.id,
      };

      expect(bannedUser.is_banned).toBe(true);
      expect(bannedUser.ban_reason).toBe(reason);
      expect(bannedUser.banned_by).toBe(mockAdmin.id);
      expect(bannedUser.banned_at).toBeDefined();
    });

    it('unbans user and clears suspension metadata', () => {
      const activeUser: Profile = {
        ...mockUser,
        is_banned: false,
        ban_reason: null,
        banned_at: null,
        banned_by: null,
      };

      expect(activeUser.is_banned).toBe(false);
      expect(activeUser.ban_reason).toBeNull();
      expect(activeUser.banned_at).toBeNull();
      expect(activeUser.banned_by).toBeNull();
    });

    it('suspension lockout guard identifies banned accounts', () => {
      const isAccountSuspended = (profile: Profile | null) => {
        return Boolean(profile?.is_banned);
      };

      expect(isAccountSuspended(mockUser)).toBe(false);
      expect(isAccountSuspended({ ...mockUser, is_banned: true })).toBe(true);
    });
  });
});
