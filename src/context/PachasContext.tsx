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
import {
  getSyncQueue,
  enqueueSyncAction,
  processSyncQueue,
  SyncAction,
} from '@/lib/sync/syncManager';
import { generateUUID } from '@/lib/id';


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
  currentUser: Profile | null;
  setCurrentUser: (user: Profile | null) => void;
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
  resetLocalDatabase: () => Promise<void>;
  isOnline: boolean;
  pendingSyncCount: number;
  syncPendingQueue: () => Promise<void>;
}

const PachasContext = createContext<PachasContextType | null>(null);

const STORAGE_KEYS = {
  USER: 'pachas_user_v2',
  USERS: 'pachas_available_users_v2',
  GROUPS: 'pachas_groups_v2',
  MEMBERS: 'pachas_members_v2',
  EXPENSES: 'pachas_expenses_v2',
  SETTLEMENTS: 'pachas_settlements_v2',
};

export const PachasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, _setCurrentUser] = useState<Profile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.USER);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Helper to change current user and persist immediately to localStorage
  const setCurrentUser = (user: Profile | null) => {
    _setCurrentUser(user);
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch (e) {
      console.error('Failed to persist current user to localStorage:', e);
    }
  };

  // Initialize data from Supabase or localStorage or demo defaults
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const demoAllowed = isDemoModeAllowed();

      try {
        let activeProfile: Profile | null = null;
        const supabase = createClient();

        // 1. Try checking auth with timeout protection (max 2500ms)
        const authPromise = async () => {
          try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) {
              const { data: dbProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .maybeSingle();

              return {
                id: authData.user.id,
                email: authData.user.email || '',
                full_name: dbProfile?.full_name || authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'Usuario',
                avatar_url: dbProfile?.avatar_url || authData.user.user_metadata?.avatar_url || null,
                bizum_phone: dbProfile?.bizum_phone || authData.user.user_metadata?.bizum_phone || null,
                role: dbProfile?.role || authData.user.user_metadata?.role || 'member',
                created_at: authData.user.created_at,
              };
            }
          } catch {}

          try {
            const meRes = await fetch('/api/auth/me');
            if (meRes.ok) {
              const meData = await meRes.json();
              if (meData?.user) return meData.user;
            }
          } catch {}

          return null;
        };

        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
        activeProfile = await Promise.race([authPromise(), timeoutPromise]);


        if (activeProfile) {
          if (isMounted) {
            _setCurrentUser(activeProfile);
          }

          // Fetch real groups where user is a member
          const { data: dbGroups } = await supabase.from('groups').select('*');
          if (dbGroups && isMounted) {
            setGroups(dbGroups);
          }

          // Fetch group members with profiles
          const { data: dbMembers } = await supabase
            .from('group_members')
            .select('*, profile:profiles(*)');

          if (dbMembers && isMounted) {
            const memberMap: Record<string, GroupMember[]> = {};
            const friendProfilesMap = new Map<string, Profile>();
            friendProfilesMap.set(activeProfile.id, activeProfile);

            dbMembers.forEach((m: any) => {
              if (!memberMap[m.group_id]) memberMap[m.group_id] = [];
              memberMap[m.group_id].push(m);
              if (m.profile) friendProfilesMap.set(m.profile.id, m.profile);
            });
            setMembers(memberMap);
            setAvailableUsers(Array.from(friendProfilesMap.values()));
          }

          // Fetch expenses with payers and participants
          try {
            const expRes = await fetch('/api/expenses');
            if (expRes.ok) {
              const expData = await expRes.json();
              if (expData.expenses && isMounted) {
                const expMap: Record<string, Expense[]> = {};
                expData.expenses.forEach((e: any) => {
                  if (!expMap[e.group_id]) expMap[e.group_id] = [];
                  expMap[e.group_id].push(e);
                });
                setExpenses(expMap);
              }
            }
          } catch {}

          // Fetch settlements
          try {
            const setRes = await fetch('/api/settlements');
            if (setRes.ok) {
              const setData = await setRes.json();
              if (setData.settlements && isMounted) {
                const setMap: Record<string, Settlement[]> = {};
                setData.settlements.forEach((s: any) => {
                  if (!setMap[s.group_id]) setMap[s.group_id] = [];
                  setMap[s.group_id].push(s);
                });
                setSettlements(setMap);
              }
            }
          } catch {}

          return;
        }
      } catch (err) {
        console.warn('Data fetch fallback to local storage:', err);
      }



      // If no Supabase user or in offline/demo mode, load from localStorage
      try {
        const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
        const savedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
        const savedGroups = localStorage.getItem(STORAGE_KEYS.GROUPS);
        const savedMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
        const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
        const savedSettlements = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);

        let currentUsersList = demoAllowed ? DEMO_USERS : [];
        if (savedUsers) {
          try {
            currentUsersList = JSON.parse(savedUsers);
            if (isMounted) setAvailableUsers(currentUsersList);
          } catch (e) {}
        } else if (demoAllowed && isMounted) {
          setAvailableUsers(DEMO_USERS);
        }

        if (savedUser && isMounted) {
          try {
            const parsedUser: Profile = JSON.parse(savedUser);
            const fresh = currentUsersList.find((u) => u.id === parsedUser.id) || parsedUser;
            _setCurrentUser(fresh);
          } catch (e) {
            _setCurrentUser(null);
          }
        } else if (isMounted) {
          _setCurrentUser(null);
        }

        if (savedGroups && isMounted) {
          setGroups(JSON.parse(savedGroups));
        } else if (demoAllowed && isMounted) {
          setGroups(DEMO_GROUPS);
        } else if (isMounted) {
          setGroups([]);
        }

        if (savedMembers && isMounted) {
          setMembers(JSON.parse(savedMembers));
        } else if (demoAllowed && isMounted) {
          setMembers(DEMO_MEMBERS);
        } else if (isMounted) {
          setMembers({});
        }

        if (savedExpenses && isMounted) {
          setExpenses(JSON.parse(savedExpenses));
        } else if (demoAllowed && isMounted) {
          setExpenses(DEMO_EXPENSES);
        } else if (isMounted) {
          setExpenses({});
        }

        if (savedSettlements && isMounted) {
          setSettlements(JSON.parse(savedSettlements));
        } else if (demoAllowed && isMounted) {
          setSettlements(DEMO_SETTLEMENTS);
        } else if (isMounted) {
          setSettlements({});
        }
      } catch (e) {
        console.error('Failed to parse cached data:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

  }, []);

  // Listen to network status and initialize pending count
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      setPendingSyncCount(getSyncQueue().length);

      const handleOnlineOrFocus = () => {
        setIsOnline(navigator.onLine);
        if (navigator.onLine) {
          syncPendingQueue();
        }
      };

      const handleOffline = () => {
        setIsOnline(false);
      };

      window.addEventListener('online', handleOnlineOrFocus);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('focus', handleOnlineOrFocus);
      document.addEventListener('visibilitychange', handleOnlineOrFocus);

      // Check on initial mount if there is any pending queue to sync immediately
      if (navigator.onLine && getSyncQueue().length > 0) {
        syncPendingQueue();
      }

      return () => {
        window.removeEventListener('online', handleOnlineOrFocus);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('focus', handleOnlineOrFocus);
        document.removeEventListener('visibilitychange', handleOnlineOrFocus);
      };
    }
  }, []);

  const syncPendingQueue = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const supabase = createClient();
      await processSyncQueue(supabase, (syncedItem: SyncAction) => {
        if (syncedItem.type === 'CREATE_EXPENSE' || syncedItem.type === 'UPDATE_EXPENSE') {
          const exp: Expense = syncedItem.payload;
          setExpenses((prev) => {
            const list = prev[exp.group_id] || [];
            const updated = list.map((e) =>
              e.id === exp.id ? { ...e, is_pending_sync: false } : e
            );
            localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify({ ...prev, [exp.group_id]: updated }));
            return {
              ...prev,
              [exp.group_id]: updated,
            };
          });
        } else if (syncedItem.type === 'DELETE_EXPENSE') {
          if (syncedItem.groupId) {
            setExpenses((prev) => {
              const list = prev[syncedItem.groupId!] || [];
              const updated = list.filter((e) => e.id !== syncedItem.entityId);
              localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify({ ...prev, [syncedItem.groupId!]: updated }));
              return {
                ...prev,
                [syncedItem.groupId!]: updated,
              };
            });
          }
        } else if (syncedItem.type === 'CREATE_SETTLEMENT') {
          const settle: Settlement = syncedItem.payload;
          setSettlements((prev) => {
            const list = prev[settle.group_id] || [];
            const updated = list.map((s) =>
              s.id === settle.id ? { ...s, is_pending_sync: false } : s
            );
            localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify({ ...prev, [settle.group_id]: updated }));
            return {
              ...prev,
              [settle.group_id]: updated,
            };
          });
        }
      });
      setPendingSyncCount(getSyncQueue().length);
    } catch (err) {
      console.warn('Sync pending queue warning:', err);
    }
  };





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
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para crear un grupo.');
    }

    const groupId = generateUUID();
    const newGroup: Group = {
      id: groupId,
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

    const memberId = generateUUID();
    const initialMember: GroupMember = {
      id: memberId,
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

    try {
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newGroup.id,
          name: newGroup.name,
          description: newGroup.description,
          icon_emoji: newGroup.icon_emoji,
          cover_image_url: newGroup.cover_image_url,
          base_currency: newGroup.base_currency,
          invite_code: newGroup.invite_code,
        }),
      });
    } catch (e) {
      console.warn('API createGroup fallback to local storage:', e);
    }

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

    try {
      const supabase = createClient();
      await supabase
        .from('groups')
        .update({
          name: updatedGroup.name,
          description: updatedGroup.description,
          icon_emoji: updatedGroup.icon_emoji,
          cover_image_url: updatedGroup.cover_image_url,
          base_currency: updatedGroup.base_currency,
          is_archived: updatedGroup.is_archived,
          archived_at: updatedGroup.archived_at,
          updated_at: updatedGroup.updated_at,
        })
        .eq('id', groupId);
    } catch (e) {
      console.warn('Supabase updateGroup sync warning:', e);
    }

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
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para unirte a un grupo.');
    }

    try {
      // 1. Try unified PostgreSQL join API route
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.group) {
        const group: Group = data.group;
        const groupMembers: GroupMember[] = data.members || [];

        const updatedMembers = {
          ...members,
          [group.id]: groupMembers,
        };

        const updatedGroups = groups.some((g) => g.id === group.id)
          ? groups.map((g) => (g.id === group.id ? group : g))
          : [group, ...groups];

        // Ensure all member profiles are added to availableUsers (friends)
        const userMap = new Map(availableUsers.map((u) => [u.id, u]));
        userMap.set(currentUser.id, currentUser);
        groupMembers.forEach((m) => {
          if (m.profile) userMap.set(m.profile.id, m.profile);
        });
        setAvailableUsers(Array.from(userMap.values()));

        saveState(updatedGroups, updatedMembers);
        return group;
      }
    } catch (e) {
      console.warn('API joinGroup fallback:', e);
    }

    // 2. Fallback to Supabase / Local storage search
    let targetGroup = groups.find(
      (g) => g.invite_code.toLowerCase() === inviteCode.trim().toLowerCase()
    );

    if (!targetGroup) {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('groups')
          .select('*')
          .ilike('invite_code', inviteCode.trim())
          .maybeSingle();
        if (data) targetGroup = data;
      } catch (e) {}
    }

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
      const updatedGroups = groups.some((g) => g.id === targetGroup.id)
        ? groups
        : [targetGroup, ...groups];

      saveState(updatedGroups, updatedMembers);

      try {
        const supabase = createClient();
        await supabase.from('group_members').upsert({
          id: newMember.id,
          group_id: targetGroup.id,
          user_id: currentUser.id,
          role: 'member',
        });
      } catch (e) {
        console.warn('Supabase joinGroup sync warning:', e);
      }
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
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para registrar un gasto.');
    }

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

    const expenseId = generateUUID();

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
        id: generateUUID(),
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
      payers: input.payers.map((p) => ({
        id: generateUUID(),
        expense_id: expenseId,
        user_id: p.userId,
        amount_paid: p.amountPaid,
        profile: memberProfiles.get(p.userId),
      })),
      participants: convertedParticipants,
      is_pending_sync: false,
    };

    let isSynced = false;

    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      try {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newExpense.id,
            groupId: newExpense.group_id,
            title: newExpense.title,
            amount: newExpense.amount,
            currency: newExpense.currency,
            exchangeRate: newExpense.exchange_rate,
            convertedAmount: newExpense.converted_amount,
            category: newExpense.category,
            expenseDate: newExpense.expense_date,
            receiptUrl: newExpense.receipt_url,
            notes: newExpense.notes,
            splitType: newExpense.split_type,
            latitude: newExpense.latitude,
            longitude: newExpense.longitude,
            locationName: newExpense.location_name,
            payers: newExpense.payers,
            participants: newExpense.participants,
          }),
        });

        if (res.ok) {
          isSynced = true;
          newExpense.is_pending_sync = false;
        }
      } catch (e) {
        console.warn('API addExpense fallback to queue:', e);
      }
    }

    if (!isSynced) {
      newExpense.is_pending_sync = true;
      enqueueSyncAction({
        type: 'CREATE_EXPENSE',
        entityId: newExpense.id,
        groupId: input.groupId,
        payload: newExpense,
      });
      setPendingSyncCount(getSyncQueue().length);
    }

    const currentExpenses = expenses[input.groupId] || [];
    const updatedExpenses = {
      ...expenses,
      [input.groupId]: [newExpense, ...currentExpenses],
    };

    saveState(undefined, undefined, updatedExpenses);
    return newExpense;
  };




  const importExpenses = async (groupId: string, inputs: CreateExpenseInput[]): Promise<Expense[]> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para importar gastos.');
    }

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
    const toRemove = new Set(lastImportBatch.expenseIds);
    const current = expenses[groupId] || [];
    const filtered = current.filter((e) => !toRemove.has(e.id));
    const count = current.length - filtered.length;

    const updatedExpenses = {
      ...expenses,
      [groupId]: filtered,
    };
    saveState(undefined, undefined, updatedExpenses);
    setLastImportBatch(null);
    return count;
  };

  const updateExpense = async (
    groupId: string,
    expenseId: string,
    input: CreateExpenseInput
  ): Promise<Expense> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para editar un gasto.');
    }

    const currentExpenses = expenses[groupId] || [];
    const existing = currentExpenses.find((e) => e.id === expenseId);
    if (!existing) {
      throw new Error('Gasto no encontrado');
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

    let isSynced = false;

    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      try {
        const res = await fetch(`/api/expenses/${encodeURIComponent(expenseId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: updatedExpense.title,
            amount: updatedExpense.amount,
            currency: updatedExpense.currency,
            exchangeRate: updatedExpense.exchange_rate,
            convertedAmount: updatedExpense.converted_amount,
            category: updatedExpense.category,
            expenseDate: updatedExpense.expense_date,
            receiptUrl: updatedExpense.receipt_url,
            notes: updatedExpense.notes,
            splitType: updatedExpense.split_type,
            latitude: updatedExpense.latitude,
            longitude: updatedExpense.longitude,
            locationName: updatedExpense.location_name,
            payers: updatedExpense.payers,
            participants: updatedExpense.participants,
          }),
        });

        if (res.ok) {
          isSynced = true;
          updatedExpense.is_pending_sync = false;
        }
      } catch (e) {
        console.warn('API updateExpense fallback to queue:', e);
      }
    }

    if (!isSynced) {
      updatedExpense.is_pending_sync = true;
      enqueueSyncAction({
        type: 'UPDATE_EXPENSE',
        entityId: updatedExpense.id,
        groupId,
        payload: updatedExpense,
      });
      setPendingSyncCount(getSyncQueue().length);
    }

    const updatedList = currentExpenses.map((e) => (e.id === expenseId ? updatedExpense : e));
    const updatedExpenses = {
      ...expenses,
      [groupId]: updatedList,
    };
    saveState(undefined, undefined, updatedExpenses);
    return updatedExpense;
  };

  const deleteExpense = async (groupId: string, expenseId: string) => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para eliminar un gasto.');
    }
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

    let isDeleted = false;
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      try {
        const res = await fetch(`/api/expenses/${encodeURIComponent(expenseId)}`, {
          method: 'DELETE',
        });
        if (res.ok) isDeleted = true;
      } catch (e) {
        console.warn('API deleteExpense fallback to queue:', e);
      }
    }

    if (!isDeleted) {
      enqueueSyncAction({
        type: 'DELETE_EXPENSE',
        entityId: expenseId,
        groupId,
        payload: null,
      });
      setPendingSyncCount(getSyncQueue().length);
    }
  };

  const recordSettlement = async (
    groupId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ): Promise<Settlement> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para saldar cuentas.');
    }

    const grp = getGroup(groupId);
    const grpMembers = getGroupMembers(groupId);
    const fromProfile = grpMembers.find((m) => m.user_id === fromUserId)?.profile;
    const toProfile = grpMembers.find((m) => m.user_id === toUserId)?.profile;

    const settlementId = generateUUID();
    const newSettlement: Settlement = {
      id: settlementId,
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
      is_pending_sync: false,
    };

    let isSynced = false;
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      try {
        const res = await fetch('/api/settlements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newSettlement.id,
            groupId: newSettlement.group_id,
            fromUserId: newSettlement.from_user_id,
            toUserId: newSettlement.to_user_id,
            amount: newSettlement.amount,
            currency: newSettlement.currency,
            paymentMethod: newSettlement.payment_method,
            notes: newSettlement.notes,
            settledAt: newSettlement.settled_at,
          }),
        });

        if (res.ok) {
          isSynced = true;
          newSettlement.is_pending_sync = false;
        }
      } catch (e) {
        console.warn('API recordSettlement fallback to queue:', e);
      }
    }

    if (!isSynced) {
      newSettlement.is_pending_sync = true;
      enqueueSyncAction({
        type: 'CREATE_SETTLEMENT',
        entityId: newSettlement.id,
        groupId,
        payload: newSettlement,
      });
      setPendingSyncCount(getSyncQueue().length);
    }

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

    if (currentUser?.id === userId) {
      const fallback = updatedUsers[0] || null;
      setCurrentUser(fallback);
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para actualizar tu perfil.');
    }

    const updated: Profile = {
      ...currentUser,
      ...data,
    };
    setCurrentUser(updated);

    // Update in availableUsers list too
    const updatedUsers = availableUsers.map((u) => (u.id === currentUser.id ? updated : u));
    setAvailableUsers(updatedUsers);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    // Update member cache across groups
    const updatedMembers: Record<string, GroupMember[]> = {};
    for (const [gid, list] of Object.entries(members)) {
      updatedMembers[gid] = list.map((m) =>
        m.user_id === currentUser.id ? { ...m, profile: updated } : m
      );
    }
    setMembers(updatedMembers);
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(updatedMembers));

    try {
      const supabase = createClient();
      await supabase.from('profiles').update({
        full_name: updated.full_name,
        bizum_phone: updated.bizum_phone,
        avatar_url: updated.avatar_url,
      }).eq('id', updated.id);
    } catch (e) {}
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out from Supabase:', e);
    } finally {
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
        document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      } catch (e) {}
      _setCurrentUser(null);
    }
  };


  const resetLocalDatabase = async () => {
    try {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem('pachas_user_v1');
      localStorage.removeItem('pachas_groups_v1');
      localStorage.removeItem('pachas_expenses_v1');
      localStorage.removeItem('pachas_members_v1');
      localStorage.removeItem('pachas_settlements_v1');
      localStorage.removeItem('pachas_available_users_v1');
    } catch (e) {}
    setGroups([]);
    setMembers({});
    setExpenses({});
    setSettlements({});
    setAvailableUsers(DEMO_USERS);
    _setCurrentUser(null);
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
        resetLocalDatabase,
        isOnline,
        pendingSyncCount,
        syncPendingQueue,
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
