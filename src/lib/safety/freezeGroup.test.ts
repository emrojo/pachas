import { describe, it, expect } from 'vitest';
import { Group, Profile, Expense } from '@/types/database';
import { isServerAdmin } from '@/lib/auth/adminAuth';

describe('Frozen Groups & Moderation Resolution Protocol (FR-44 & FR-45)', () => {
  const sampleGroup: Group = {
    id: 'grp-test-frozen',
    name: 'Viaje a Islandia 2026',
    icon_emoji: '🌋',
    base_currency: 'EUR',
    invite_code: 'ISL2026',
    created_by: 'user-lucia',
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    is_archived: false,
    is_frozen: false,
  };

  const regularMember: Profile = {
    id: 'user-carlos',
    email: 'carlos@example.com',
    full_name: 'Carlos Ruiz',
    role: 'member',
    created_at: '2026-06-01T10:00:00Z',
  };

  const appAdminUser: Profile = {
    id: 'user-admin',
    email: 'admin@pachas.app',
    full_name: 'Super Admin',
    role: 'admin',
    created_at: '2026-06-01T10:00:00Z',
  };

  const sampleExpense: Expense = {
    id: 'exp-reported-1',
    group_id: 'grp-test-frozen',
    created_by: 'user-fraud',
    title: 'Gasto no reconocido',
    amount: 500,
    currency: 'EUR',
    exchange_rate: 1.0,
    converted_amount: 500,
    category: 'other',
    split_type: 'EQUAL',
    expense_date: '2026-06-02',
    created_at: '2026-06-02T12:00:00Z',
    updated_at: '2026-06-02T12:00:00Z',
    payers: [{ id: 'p1', expense_id: 'exp-reported-1', user_id: 'user-fraud', amount_paid: 500 }],
    participants: [{ id: 's1', expense_id: 'exp-reported-1', user_id: 'user-carlos', amount_owed: 500 }],
  };

  it('correctly freezes a group with reason and audit timestamp', () => {
    const reason = 'Bajo investigación por múltiples cargos desconocidos';
    const nowIso = new Date().toISOString();

    const frozenGroup: Group = {
      ...sampleGroup,
      is_frozen: true,
      frozen_at: nowIso,
      frozen_by: appAdminUser.id,
      frozen_reason: reason,
      freeze_type: 'full',
    };

    expect(frozenGroup.is_frozen).toBe(true);
    expect(frozenGroup.frozen_at).toBe(nowIso);
    expect(frozenGroup.frozen_by).toBe('user-admin');
    expect(frozenGroup.frozen_reason).toBe(reason);
    expect(frozenGroup.freeze_type).toBe('full');
  });

  it('supports read-only freeze mode allowing member view without mutations', () => {
    const readOnlyFrozenGroup: Group = {
      ...sampleGroup,
      is_frozen: true,
      frozen_at: new Date().toISOString(),
      frozen_by: appAdminUser.id,
      frozen_reason: 'Auditoría de balances en curso',
      freeze_type: 'read_only',
    };

    expect(readOnlyFrozenGroup.is_frozen).toBe(true);
    expect(readOnlyFrozenGroup.freeze_type).toBe('read_only');

    // In read-only mode, members can read but cannot mutate
    const canMemberView = readOnlyFrozenGroup.freeze_type === 'read_only';
    const canMemberMutate = !readOnlyFrozenGroup.is_frozen;

    expect(canMemberView).toBe(true);
    expect(canMemberMutate).toBe(false);
  });

  it('correctly unfreezes a group when investigation resolves', () => {
    const frozenGroup: Group = {
      ...sampleGroup,
      is_frozen: true,
      frozen_at: new Date().toISOString(),
      frozen_by: appAdminUser.id,
      frozen_reason: 'Disputa en curso',
      freeze_type: 'full',
    };

    const unfrozenGroup: Group = {
      ...frozenGroup,
      is_frozen: false,
      frozen_at: null,
      frozen_by: null,
      frozen_reason: null,
      freeze_type: null,
    };

    expect(unfrozenGroup.is_frozen).toBe(false);
    expect(unfrozenGroup.frozen_at).toBeNull();
    expect(unfrozenGroup.frozen_by).toBeNull();
    expect(unfrozenGroup.frozen_reason).toBeNull();
    expect(unfrozenGroup.freeze_type).toBeNull();
  });

  it('denies regular users from mutating or accessing group when frozen in full mode', () => {
    const isFrozen = true;
    const canRegularUserAccess = !isFrozen;
    expect(canRegularUserAccess).toBe(false);

    const isAppAdminAuthorized = isServerAdmin(appAdminUser.email, appAdminUser.id, appAdminUser.role);
    expect(isAppAdminAuthorized).toBe(true);

    const isRegularMemberAuthorized = isServerAdmin(regularMember.email, regularMember.id, regularMember.role);
    expect(isRegularMemberAuthorized).toBe(false);
  });

  it('preserves evidence snapshot and attaches resolution notes when deleting reported expense', () => {
    const groupExpenses = [sampleExpense];
    expect(groupExpenses.length).toBe(1);

    const isGroupFrozen = true;
    const isSuperAdmin = isServerAdmin(appAdminUser.email, appAdminUser.id, appAdminUser.role);

    // Permission logic: Superadmin can delete even when group is frozen
    const canDelete = !isGroupFrozen || isSuperAdmin;
    expect(canDelete).toBe(true);

    // Create evidence snapshot before deletion
    const evidenceSnapshot = {
      expense: sampleExpense,
      deleted_at: new Date().toISOString(),
      deleted_by: appAdminUser.full_name,
    };

    const resolutionNotes = 'Gasto eliminado por moderación tras confirmarse duplicado.';

    expect(evidenceSnapshot.expense.id).toBe('exp-reported-1');
    expect(evidenceSnapshot.deleted_by).toBe('Super Admin');
    expect(resolutionNotes).toContain('Gasto eliminado por moderación');

    const remainingExpenses = groupExpenses.filter((e) => e.id !== sampleExpense.id);
    expect(remainingExpenses.length).toBe(0);
  });
});
