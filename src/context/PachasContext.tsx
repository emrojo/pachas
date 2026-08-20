'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Group,
  GroupMember,
  Expense,
  Settlement,
  Profile,
  MemberBalance,
  SimplifiedDebt,
  SplitType,
  ExpenseCategory,
  PaymentMethod,
} from '@/types/database';
import {
  DEMO_CURRENT_USER,
  DEMO_GROUPS,
  DEMO_MEMBERS,
  DEMO_EXPENSES,
  DEMO_SETTLEMENTS,
  DEMO_USERS,
} from '@/lib/demoData';
import { calculateBalances, simplifyDebts } from '@/lib/algorithms/simplifyDebts';
import { calculateSplits } from '@/lib/algorithms/splitCalculations';
import { createClient } from '@/lib/supabase/client';
import { isUserAdmin, isDemoModeAllowed } from '@/lib/authConfig';

export interface CreateExpenseInput {
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  category: ExpenseCategory;
  expenseDate: string;
  receiptUrl?: string | null;
  notes?: string;
  splitType: SplitType;
  payers: { userId: string; amountPaid: number }[];
  selectedParticipantIds: string[];
  splitCustomInputs?: Record<string, { exact?: number; percentage?: number; shares?: number }>;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
}

interface PachasContextType {
  currentUser: Profile;
  setCurrentUser: (user: Profile) => void;
  isCurrentUserAdmin: boolean;
  isDemoMode: boolean;
  groups: Group[];
  isLoading: boolean;
  createGroup: (name: string, description: string, emoji: string, currency: string, coverImageUrl?: string | null) => Promise<Group>;
  updateGroup: (groupId: string, data: Partial<Group>) => Promise<Group>;
  getGroup: (id: string) => Group | undefined;
  getGroupMembers: (groupId: string) => GroupMember[];
  getGroupExpenses: (groupId: string) => Expense[];
  getGroupSettlements: (groupId: string) => Settlement[];
  getGroupBalances: (groupId: string) => MemberBalance[];
  getGroupDebts: (groupId: string) => SimplifiedDebt[];
  addExpense: (input: CreateExpenseInput) => Promise<Expense>;
  importExpenses: (groupId: string, inputs: CreateExpenseInput[]) => Promise<Expense[]>;
  lastImportBatch: { groupId: string; expenseIds: string[]; count: number } | null;
  undoLastImport: (groupId: string) => Promise<number>;
  updateExpense: (groupId: string, expenseId: string, input: CreateExpenseInput) => Promise<Expense>;
  deleteExpense: (groupId: string, expenseId: string) => Promise<void>;
  recordSettlement: (
    groupId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => Promise<Settlement>;
  archiveGroup: (groupId: string) => Promise<Group>;
  restoreGroup: (groupId: string) => Promise<Group>;
  joinGroup: (inviteCode: string) => Promise<Group | null>;
  addMemberByEmail: (groupId: string, email: string) => Promise<boolean>;
  addMemberToGroup: (groupId: string, userId: string) => Promise<boolean>;
  removeMemberFromGroup: (groupId: string, userId: string) => Promise<boolean>;
  availableUsers: Profile[];
  createLocalUser: (data: {
    full_name: string;
    email: string;
    bizum_phone?: string;
    avatar_url?: string;
    autoSwitch?: boolean;
    addToGroupIds?: string[];
  }) => Promise<Profile>;
  deleteLocalUser: (userId: string) => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  logout: () => Promise<void>;
}

const PachasContext = createContext<PachasContextType | null>(null);

const STORAGE_KEYS = {
  USER: 'pachas_user_v1',
  USERS: 'pachas_available_users_v1',
  GROUPS: 'pachas_groups_v1',
  MEMBERS: 'pachas_members_v1',
  EXPENSES: 'pachas_expenses_v1',
  SETTLEMENTS: 'pachas_settlements_v1',
};

export const PachasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, _setCurrentUser] = useState<Profile>(DEMO_CURRENT_USER);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>(DEMO_USERS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [expenses, setExpenses] = useState<Record<string, Expense[]>>({});
  const [settlements, setSettlements] = useState<Record<string, Settlement[]>>({});
  const [lastImportBatch, setLastImportBatch] = useState<{
    groupId: string;
    expenseIds: string[];
    count: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to change current user and persist immediately to localStorage
  const setCurrentUser = (user: Profile) => {
    _setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to persist current user to localStorage:', e);
    }
  };

  // Initialize data from localStorage or demo defaults
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      const savedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      const savedGroups = localStorage.getItem(STORAGE_KEYS.GROUPS);
      const savedMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      const savedSettlements = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);

      let currentUsersList = DEMO_USERS;
      if (savedUsers) {
        try {
          currentUsersList = JSON.parse(savedUsers);
          setAvailableUsers(currentUsersList);
        } catch (e) {}
      }

      if (savedUser) {
        try {
          const parsedUser: Profile = JSON.parse(savedUser);
          const fresh = currentUsersList.find((u) => u.id === parsedUser.id) || parsedUser;
          _setCurrentUser(fresh);
        } catch (e) {}
      }

      if (savedGroups) {
        setGroups(JSON.parse(savedGroups));
      } else {
        setGroups(DEMO_GROUPS);
      }

      if (savedMembers) {
        setMembers(JSON.parse(savedMembers));
      } else {
        setMembers(DEMO_MEMBERS);
      }

      if (savedExpenses) {
        setExpenses(JSON.parse(savedExpenses));
      } else {
        setExpenses(DEMO_EXPENSES);
      }

      if (savedSettlements) {
        setSettlements(JSON.parse(savedSettlements));
      } else {
        setSettlements(DEMO_SETTLEMENTS);
      }
    } catch (e) {
      console.error('Failed to parse cached data:', e);
      setGroups(DEMO_GROUPS);
      setMembers(DEMO_MEMBERS);
      setExpenses(DEMO_EXPENSES);
      setSettlements(DEMO_SETTLEMENTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save changes to localStorage
  const saveState = (
    newGroups?: Group[],
    newMembers?: Record<string, GroupMember[]>,
    newExpenses?: Record<string, Expense[]>,
    newSettlements?: Record<string, Settlement[]>
  ) => {
    if (newGroups) {
      setGroups(newGroups);
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(newGroups));
    }
    if (newMembers) {
      setMembers(newMembers);
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(newMembers));
    }
    if (newExpenses) {
      setExpenses(newExpenses);
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(newExpenses));
    }
    if (newSettlements) {
      setSettlements(newSettlements);
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(newSettlements));
    }
  };

  const getGroup = (id: string) => groups.find((g) => g.id === id);
  const getGroupMembers = (groupId: string) => members[groupId] || [];
  const getGroupExpenses = (groupId: string) => expenses[groupId] || [];
  const getGroupSettlements = (groupId: string) => settlements[groupId] || [];

  const getGroupBalances = (groupId: string): MemberBalance[] => {
    const grpMembers = getGroupMembers(groupId);
    const grpExpenses = getGroupExpenses(groupId);
    const grpSettlements = getGroupSettlements(groupId);
    return calculateBalances(grpMembers, grpExpenses, grpSettlements);
  };

  const getGroupDebts = (groupId: string): SimplifiedDebt[] => {
    const grp = getGroup(groupId);
    const balances = getGroupBalances(groupId);
    return simplifyDebts(balances, grp?.base_currency || 'EUR');
  };

  const createGroup = async (
    name: string,
    description: string,
    emoji: string,
    currency: string,
    coverImageUrl?: string | null
  ): Promise<Group> => {
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name,
      description,
      icon_emoji: emoji || '🏖️',
      cover_image_url: coverImageUrl || null,
      base_currency: currency || 'EUR',
      invite_code: Math.random().toString(36).substring(2, 8).toLowerCase(),
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const initialMember: GroupMember = {
      id: `gm-${Date.now()}`,
      group_id: newGroup.id,
      user_id: currentUser.id,
      role: 'admin',
      joined_at: new Date().toISOString(),
      profile: currentUser,
    };

    const updatedGroups = [newGroup, ...groups];
    const updatedMembers = { ...members, [newGroup.id]: [initialMember] };
    const updatedExpenses = { ...expenses, [newGroup.id]: [] };
    const updatedSettlements = { ...settlements, [newGroup.id]: [] };

    saveState(updatedGroups, updatedMembers, updatedExpenses, updatedSettlements);
    return newGroup;
  };

  const updateGroup = async (groupId: string, data: Partial<Group>): Promise<Group> => {
    const existing = groups.find((g) => g.id === groupId);
    if (!existing) {
      throw new Error('Grupo no encontrado');
    }

    const updatedGroup: Group = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    const updatedGroups = groups.map((g) => (g.id === groupId ? updatedGroup : g));
    saveState(updatedGroups);
    return updatedGroup;
  };

  const archiveGroup = async (groupId: string): Promise<Group> => {
    return updateGroup(groupId, {
      is_archived: true,
      archived_at: new Date().toISOString(),
    });
  };

  const restoreGroup = async (groupId: string): Promise<Group> => {
    return updateGroup(groupId, {
      is_archived: false,
      archived_at: null,
    });
  };

  const joinGroup = async (inviteCode: string): Promise<Group | null> => {
    const targetGroup = groups.find(
      (g) => g.invite_code.toLowerCase() === inviteCode.trim().toLowerCase()
    );
    if (!targetGroup) return null;

    if (targetGroup.is_archived) {
      throw new Error('Este grupo ha sido archivado por el administrador y no admite nuevos miembros.');
    }

    const grpMembers = members[targetGroup.id] || [];
    const isAlreadyMember = grpMembers.some((m) => m.user_id === currentUser.id);

    if (!isAlreadyMember) {
      const newMember: GroupMember = {
        id: `gm-${Date.now()}`,
        group_id: targetGroup.id,
        user_id: currentUser.id,
        role: 'member',
        joined_at: new Date().toISOString(),
        profile: currentUser,
      };

      const updatedMembers = {
        ...members,
        [targetGroup.id]: [...grpMembers, newMember],
      };
      saveState(undefined, updatedMembers);
    }

    return targetGroup;
  };

  const removeMemberFromGroup = async (groupId: string, userId: string): Promise<boolean> => {
    const grpMembers = members[groupId] || [];
    const updated = grpMembers.filter((m) => m.user_id !== userId);
    const updatedMembers = {
      ...members,
      [groupId]: updated,
    };
    saveState(undefined, updatedMembers);
    return true;
  };

  const addMemberToGroup = async (groupId: string, userId: string): Promise<boolean> => {
    const grpMembers = members[groupId] || [];
    const targetUser = availableUsers.find((u) => u.id === userId);
    if (!targetUser) return false;

    if (grpMembers.some((m) => m.user_id === userId)) {
      return false; // Already in group
    }

    const newMember: GroupMember = {
      id: `gm-${Date.now()}-${userId}`,
      group_id: groupId,
      user_id: targetUser.id,
      role: 'member',
      joined_at: new Date().toISOString(),
      profile: targetUser,
    };

    const updatedMembers = {
      ...members,
      [groupId]: [...grpMembers, newMember],
    };
    saveState(undefined, updatedMembers);
    return true;
  };

  const addMemberByEmail = async (groupId: string, emailOrName: string): Promise<boolean> => {
    const grpMembers = members[groupId] || [];
    const normalized = emailOrName.trim().toLowerCase();

    // Find profile in availableUsers (which includes all demo and custom created users)
    let targetUser = availableUsers.find(
      (u) =>
        u.email.toLowerCase() === normalized ||
        u.full_name.toLowerCase() === normalized ||
        u.full_name.toLowerCase().includes(normalized) ||
        u.id.toLowerCase() === normalized
    );

    if (!targetUser) {
      targetUser = {
        id: `user-${Date.now()}`,
        email: normalized.includes('@') ? normalized : `${normalized}@pachas.com`,
        full_name: emailOrName.split('@')[0],
        created_at: new Date().toISOString(),
      };
      // Register in availableUsers so they are recognized everywhere
      const updatedUsers = [...availableUsers, targetUser];
      setAvailableUsers(updatedUsers);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    }

    if (grpMembers.some((m) => m.user_id === targetUser?.id || m.profile?.email?.toLowerCase() === targetUser?.email.toLowerCase())) {
      return false; // Already in group
    }

    const newMember: GroupMember = {
      id: `gm-${Date.now()}`,
      group_id: groupId,
      user_id: targetUser.id,
      role: 'member',
      joined_at: new Date().toISOString(),
      profile: targetUser,
    };

    const updatedMembers = {
      ...members,
      [groupId]: [...grpMembers, newMember],
    };
    saveState(undefined, updatedMembers);
    return true;
  };

  const addExpense = async (input: CreateExpenseInput): Promise<Expense> => {
    const grpMembers = getGroupMembers(input.groupId);
    const memberProfiles = new Map(grpMembers.map((m) => [m.user_id, m.profile]));

    const exchangeRate = input.exchangeRate || 1.0;
    const convertedAmount = Math.round((input.amount / exchangeRate) * 100) / 100;

    // Calculate splits on the original expense currency
    const { results } = calculateSplits(
      input.amount,
      input.splitType,
      input.selectedParticipantIds,
      input.splitCustomInputs,
      input.currency
    );

    const expenseId = `exp-${Date.now()}`;

    // Convert participants owed amounts to the group's base currency with cent balancing
    const origTotal = input.amount > 0 ? input.amount : 1;
    let distributedBaseCents = 0;
    const totalBaseCents = Math.round(convertedAmount * 100);

    const convertedParticipants = results.map((r, idx) => {
      let participantBaseAmount = 0;
      if (idx === results.length - 1) {
        participantBaseAmount = (totalBaseCents - distributedBaseCents) / 100;
      } else {
        const cents = Math.round(((r.amountOwed / origTotal) * convertedAmount) * 100);
        distributedBaseCents += cents;
        participantBaseAmount = cents / 100;
      }

      return {
        id: `part-${expenseId}-${idx}`,
        expense_id: expenseId,
        user_id: r.userId,
        amount_owed: participantBaseAmount,
        percentage: r.percentage,
        shares: r.shares,
        profile: memberProfiles.get(r.userId),
      };
    });

    const newExpense: Expense = {
      id: expenseId,
      group_id: input.groupId,
      created_by: currentUser.id,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      exchange_rate: exchangeRate,
      converted_amount: convertedAmount,
      category: input.category,
      expense_date: input.expenseDate,
      receipt_url: input.receiptUrl || null,
      notes: input.notes || null,
      split_type: input.splitType,
      latitude: input.latitude !== undefined ? input.latitude : null,
      longitude: input.longitude !== undefined ? input.longitude : null,
      location_name: input.locationName || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      creator: currentUser,
      payers: input.payers.map((p, idx) => ({
        id: `p-${expenseId}-${idx}`,
        expense_id: expenseId,
        user_id: p.userId,
        amount_paid: p.amountPaid,
        profile: memberProfiles.get(p.userId),
      })),
      participants: convertedParticipants,
    };

    const currentExpenses = expenses[input.groupId] || [];
    const updatedExpenses = {
      ...expenses,
      [input.groupId]: [newExpense, ...currentExpenses],
    };

    saveState(undefined, undefined, updatedExpenses);
    return newExpense;
  };

  const importExpenses = async (groupId: string, inputs: CreateExpenseInput[]): Promise<Expense[]> => {
    const grpMembers = getGroupMembers(groupId);
    const memberProfiles = new Map(grpMembers.map((m) => [m.user_id, m.profile]));
    const createdExpenses: Expense[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const exchangeRate = input.exchangeRate || 1.0;
      const convertedAmount = Math.round((input.amount / exchangeRate) * 100) / 100;

      const { results } = calculateSplits(
        input.amount,
        input.splitType,
        input.selectedParticipantIds,
        input.splitCustomInputs,
        input.currency
      );

      const expenseId = `exp-imp-${Date.now()}-${i}`;
      const origTotal = input.amount > 0 ? input.amount : 1;
      let distributedBaseCents = 0;
      const totalBaseCents = Math.round(convertedAmount * 100);

      const convertedParticipants = results.map((r, idx) => {
        let participantBaseAmount = 0;
        if (idx === results.length - 1) {
          participantBaseAmount = (totalBaseCents - distributedBaseCents) / 100;
        } else {
          const cents = Math.round(((r.amountOwed / origTotal) * convertedAmount) * 100);
          distributedBaseCents += cents;
          participantBaseAmount = cents / 100;
        }

        return {
          id: `part-${expenseId}-${idx}`,
          expense_id: expenseId,
          user_id: r.userId,
          amount_owed: participantBaseAmount,
          percentage: r.percentage,
          shares: r.shares,
          profile: memberProfiles.get(r.userId),
        };
      });

      const newExpense: Expense = {
        id: expenseId,
        group_id: groupId,
        created_by: currentUser.id,
        title: input.title,
        amount: input.amount,
        currency: input.currency,
        exchange_rate: exchangeRate,
        converted_amount: convertedAmount,
        category: input.category,
        expense_date: input.expenseDate,
        receipt_url: input.receiptUrl || null,
        notes: input.notes || null,
        split_type: input.splitType,
        latitude: input.latitude !== undefined ? input.latitude : null,
        longitude: input.longitude !== undefined ? input.longitude : null,
        location_name: input.locationName || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        creator: currentUser,
        payers: input.payers.map((p, idx) => ({
          id: `p-${expenseId}-${idx}`,
          expense_id: expenseId,
          user_id: p.userId,
          amount_paid: p.amountPaid,
          profile: memberProfiles.get(p.userId),
        })),
        participants: convertedParticipants,
      };

      createdExpenses.push(newExpense);
    }

    const currentExpenses = expenses[groupId] || [];
    const updatedExpenses = {
      ...expenses,
      [groupId]: [...createdExpenses, ...currentExpenses],
    };

    setLastImportBatch({
      groupId,
      expenseIds: createdExpenses.map((e) => e.id),
      count: createdExpenses.length,
    });

    saveState(undefined, undefined, updatedExpenses);
    return createdExpenses;
  };

  const undoLastImport = async (groupId: string): Promise<number> => {
    if (!lastImportBatch || lastImportBatch.groupId !== groupId) return 0;

    const currentExpenses = expenses[groupId] || [];
    const toRemoveSet = new Set(lastImportBatch.expenseIds);
    const filtered = currentExpenses.filter((e) => !toRemoveSet.has(e.id));
    const count = lastImportBatch.count;

    const updatedExpenses = {
      ...expenses,
      [groupId]: filtered,
    };

    setLastImportBatch(null);
    saveState(undefined, undefined, updatedExpenses);
    return count;
  };

  const updateExpense = async (
    groupId: string,
    expenseId: string,
    input: CreateExpenseInput
  ): Promise<Expense> => {
    const currentExpenses = expenses[groupId] || [];
    const existing = currentExpenses.find((e) => e.id === expenseId);
    if (!existing) {
      throw new Error('Gasto no encontrado');
    }

    if (existing.created_by !== currentUser.id) {
      throw new Error('No puedes editar este gasto porque fue creado por otro amigo.');
    }

    const grpMembers = getGroupMembers(groupId);
    const memberProfiles = new Map(grpMembers.map((m) => [m.user_id, m.profile]));

    const exchangeRate = input.exchangeRate || 1.0;
    const convertedAmount = Math.round((input.amount / exchangeRate) * 100) / 100;

    // Calculate splits on the original expense currency
    const { results } = calculateSplits(
      input.amount,
      input.splitType,
      input.selectedParticipantIds,
      input.splitCustomInputs,
      input.currency
    );

    // Convert participants owed amounts to the group's base currency with cent balancing
    const origTotal = input.amount > 0 ? input.amount : 1;
    let distributedBaseCents = 0;
    const totalBaseCents = Math.round(convertedAmount * 100);

    const convertedParticipants = results.map((r, idx) => {
      let participantBaseAmount = 0;
      if (idx === results.length - 1) {
        participantBaseAmount = (totalBaseCents - distributedBaseCents) / 100;
      } else {
        const cents = Math.round(((r.amountOwed / origTotal) * convertedAmount) * 100);
        distributedBaseCents += cents;
        participantBaseAmount = cents / 100;
      }

      return {
        id: `part-${expenseId}-${idx}`,
        expense_id: expenseId,
        user_id: r.userId,
        amount_owed: participantBaseAmount,
        percentage: r.percentage,
        shares: r.shares,
        profile: memberProfiles.get(r.userId),
      };
    });

    const updatedExpense: Expense = {
      ...existing,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      exchange_rate: exchangeRate,
      converted_amount: convertedAmount,
      category: input.category,
      expense_date: input.expenseDate,
      receipt_url: input.receiptUrl !== undefined ? input.receiptUrl : existing.receipt_url,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      split_type: input.splitType,
      latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
      longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
      location_name: input.locationName !== undefined ? input.locationName : existing.location_name,
      updated_at: new Date().toISOString(),
      payers: input.payers.map((p, idx) => ({
        id: `p-${expenseId}-${idx}`,
        expense_id: expenseId,
        user_id: p.userId,
        amount_paid: p.amountPaid,
        profile: memberProfiles.get(p.userId),
      })),
      participants: convertedParticipants,
    };

    const updatedList = currentExpenses.map((e) => (e.id === expenseId ? updatedExpense : e));
    const updatedExpenses = {
      ...expenses,
      [groupId]: updatedList,
    };
    saveState(undefined, undefined, updatedExpenses);
    return updatedExpense;
  };

  const deleteExpense = async (groupId: string, expenseId: string) => {
    const currentExpenses = expenses[groupId] || [];
    const existing = currentExpenses.find((e) => e.id === expenseId);
    if (existing && existing.created_by !== currentUser.id) {
      throw new Error('No puedes eliminar este gasto porque fue creado por otro amigo.');
    }
    const filtered = currentExpenses.filter((e) => e.id !== expenseId);
    const updatedExpenses = {
      ...expenses,
      [groupId]: filtered,
    };
    saveState(undefined, undefined, updatedExpenses);
  };

  const recordSettlement = async (
    groupId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ): Promise<Settlement> => {
    const grp = getGroup(groupId);
    const grpMembers = getGroupMembers(groupId);
    const fromProfile = grpMembers.find((m) => m.user_id === fromUserId)?.profile;
    const toProfile = grpMembers.find((m) => m.user_id === toUserId)?.profile;

    const newSettlement: Settlement = {
      id: `settle-${Date.now()}`,
      group_id: groupId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount: Math.round(amount * 100) / 100,
      currency: grp?.base_currency || 'EUR',
      payment_method: paymentMethod,
      notes: notes || null,
      settled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      from_profile: fromProfile,
      to_profile: toProfile,
    };

    const currentSettlements = settlements[groupId] || [];
    const updatedSettlements = {
      ...settlements,
      [groupId]: [newSettlement, ...currentSettlements],
    };

    saveState(undefined, undefined, undefined, updatedSettlements);
    return newSettlement;
  };

  const isCurrentUserAdmin = isUserAdmin(currentUser, groups, members);
  const isDemoMode = isDemoModeAllowed();

  const createLocalUser = async (data: {
    full_name: string;
    email: string;
    bizum_phone?: string;
    avatar_url?: string;
    autoSwitch?: boolean;
    addToGroupIds?: string[];
  }): Promise<Profile> => {
    if (!isCurrentUserAdmin) {
      throw new Error('Permiso denegado: Solo los administradores del sistema pueden crear nuevos usuarios.');
    }

    const newProfile: Profile = {
      id: `user-custom-${Date.now()}`,
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      bizum_phone: data.bizum_phone?.trim() || null,
      avatar_url: data.avatar_url || null,
      role: 'member',
      created_at: new Date().toISOString(),
    };

    const updatedUsers = [...availableUsers, newProfile];
    setAvailableUsers(updatedUsers);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    // If addToGroupIds, register member in those groups
    if (data.addToGroupIds && data.addToGroupIds.length > 0) {
      const updatedMembers = { ...members };
      for (const gid of data.addToGroupIds) {
        const current = updatedMembers[gid] || [];
        if (!current.some((m) => m.user_id === newProfile.id)) {
          const newMember: GroupMember = {
            id: `gm-${Date.now()}-${gid}`,
            group_id: gid,
            user_id: newProfile.id,
            role: 'member',
            joined_at: new Date().toISOString(),
            profile: newProfile,
          };
          updatedMembers[gid] = [...current, newMember];
        }
      }
      setMembers(updatedMembers);
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(updatedMembers));
    }

    if (data.autoSwitch) {
      setCurrentUser(newProfile);
    }

    return newProfile;
  };

  const deleteLocalUser = async (userId: string): Promise<void> => {
    if (!isCurrentUserAdmin) {
      throw new Error('Permiso denegado: Solo los administradores del sistema pueden eliminar usuarios.');
    }

    const updatedUsers = availableUsers.filter((u) => u.id !== userId);
    setAvailableUsers(updatedUsers);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    if (currentUser.id === userId) {
      const fallback = updatedUsers[0] || DEMO_USERS[0];
      setCurrentUser(fallback);
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    const updated: Profile = {
      ...currentUser,
      ...data,
    };
    setCurrentUser(updated);

    // Update in availableUsers list too
    const updatedUsers = availableUsers.map((u) => (u.id === currentUser.id ? updated : u));
    setAvailableUsers(updatedUsers);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
  };

  const logout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out from Supabase:', e);
    } finally {
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
      } catch (e) {}
      _setCurrentUser(DEMO_CURRENT_USER);
    }
  };

  return (
    <PachasContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isCurrentUserAdmin,
        isDemoMode,
        availableUsers,
        createLocalUser,
        deleteLocalUser,
        groups,
        isLoading,
        createGroup,
        updateGroup,
        getGroup,
        getGroupMembers,
        getGroupExpenses,
        getGroupSettlements,
        getGroupBalances,
        getGroupDebts,
        addExpense,
        importExpenses,
        lastImportBatch,
        undoLastImport,
        updateExpense,
        deleteExpense,
        recordSettlement,
        archiveGroup,
        restoreGroup,
        joinGroup,
        addMemberByEmail,
        addMemberToGroup,
        removeMemberFromGroup,
        updateProfile,
        logout,
      }}
    >
      {children}
    </PachasContext.Provider>
  );
};

export const usePachas = () => {
  const context = useContext(PachasContext);
  if (!context) {
    throw new Error('usePachas must be used within a PachasProvider');
  }
  return context;
};
