'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  ExpenseComment,
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
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { isUserAdmin, isDemoModeAllowed } from '@/lib/authConfig';
import {
  getSyncQueue,
  enqueueSyncAction,
  processSyncQueue,
  clearSyncQueue,
  SyncAction,
} from '@/lib/sync/syncManager';
import { recalculateAllExpensesForNewBaseCurrency } from '@/lib/currencies/exchangeRateService';
import { scanReceipt } from '@/lib/ocr/receiptScanner';
import { getCurrentDateTimeISOWithTimezone } from '@/lib/utils';
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
  ocr_status?: 'processing' | 'completed' | 'failed' | null;
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
  scanAndCreateExpenseAsync: (groupId: string, receiptDataUrl: string) => Promise<Expense>;
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
  joinGroup: (inviteCode: string, enableNotifications?: boolean) => Promise<Group | null>;
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
  clearPendingSyncQueue: () => void;
  comments: Record<string, ExpenseComment[]>;
  getExpenseComments: (expenseId: string) => ExpenseComment[];
  addExpenseComment: (expenseId: string, comment: string) => Promise<ExpenseComment>;
  deleteExpenseComment: (commentId: string, expenseId: string) => Promise<void>;
  fetchExpenseComments: (expenseId: string) => Promise<ExpenseComment[]>;
}


const PachasContext = createContext<PachasContextType | null>(null);

const STORAGE_KEYS = {
  USER: 'pachas_user_v2',
  USERS: 'pachas_available_users_v2',
  GROUPS: 'pachas_groups_v2',
  MEMBERS: 'pachas_members_v2',
  EXPENSES: 'pachas_expenses_v2',
  SETTLEMENTS: 'pachas_settlements_v2',
  COMMENTS: 'pachas_expense_comments_v2',
};

export const PachasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, _setCurrentUser] = useState<Profile | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>(DEMO_USERS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [expenses, setExpenses] = useState<Record<string, Expense[]>>({});
  const [settlements, setSettlements] = useState<Record<string, Settlement[]>>({});
  const [comments, setComments] = useState<Record<string, ExpenseComment[]>>({});
  const [lastImportBatch, setLastImportBatch] = useState<{
    groupId: string;
    expenseIds: string[];
    count: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const groupsRef = useRef<Group[]>(groups);
  const membersRef = useRef<Record<string, GroupMember[]>>(members);
  const expensesRef = useRef<Record<string, Expense[]>>(expenses);
  const settlementsRef = useRef<Record<string, Settlement[]>>(settlements);

  groupsRef.current = groups;
  membersRef.current = members;
  expensesRef.current = expenses;
  settlementsRef.current = settlements;

  // Helper to change current user and persist immediately to localStorage and session cookie
  const setCurrentUser = (user: Profile | null) => {
    _setCurrentUser(user);
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        if (typeof document !== 'undefined') {
          document.cookie = `pachas_demo_user=${encodeURIComponent(
            JSON.stringify({ id: user.id, email: user.email })
          )}; path=/; max-age=604800; SameSite=Lax`;
        }
        fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user }),
        }).catch(() => {});
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
        if (typeof document !== 'undefined') {
          document.cookie = 'pachas_demo_user=; path=/; max-age=0; SameSite=Lax';
          document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
        }
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
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

      // Initial fast hydrate from localStorage to prevent UI flashing
      try {
        const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
        const savedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
        const savedGroups = localStorage.getItem(STORAGE_KEYS.GROUPS);
        const savedMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
        const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
        const savedSettlements = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);

        if (savedUsers && isMounted) {
          try {
            setAvailableUsers(JSON.parse(savedUsers));
          } catch {}
        } else if (demoAllowed && isMounted) {
          setAvailableUsers(DEMO_USERS);
        }

        if (savedUser && isMounted) {
          try {
            _setCurrentUser(JSON.parse(savedUser));
          } catch {}
        }

        if (savedGroups && isMounted) {
          try {
            setGroups(JSON.parse(savedGroups));
          } catch {}
        } else if (demoAllowed && isMounted) {
          setGroups(DEMO_GROUPS);
        }

        if (savedMembers && isMounted) {
          try {
            setMembers(JSON.parse(savedMembers));
          } catch {}
        } else if (demoAllowed && isMounted) {
          setMembers(DEMO_MEMBERS);
        }

        if (savedExpenses && isMounted) {
          try {
            setExpenses(JSON.parse(savedExpenses));
          } catch {}
        } else if (demoAllowed && isMounted) {
          setExpenses(DEMO_EXPENSES);
        }

        if (savedSettlements && isMounted) {
          try {
            setSettlements(JSON.parse(savedSettlements));
          } catch {}
        } else if (demoAllowed && isMounted) {
          setSettlements(DEMO_SETTLEMENTS);
        }

        const savedComments = localStorage.getItem(STORAGE_KEYS.COMMENTS);
        if (savedComments && isMounted) {
          try {
            setComments(JSON.parse(savedComments));
          } catch {}
        }
      } catch {}

      try {
        let activeProfile: Profile | null = null;
        const supabase = createClient();

        // 1. Try checking auth with timeout protection (max 2500ms)
        const authPromise = async () => {
          if (isSupabaseConfigured()) {
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
          }

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

          let loadedGroups: Group[] = [];
          let loadedMembers: Record<string, GroupMember[]> = {};
          let loadedExpenses: Record<string, Expense[]> = {};
          let loadedSettlements: Record<string, Settlement[]> = {};

          // 1. Fetch real groups and their members from native API
          try {
            const grpRes = await fetch('/api/groups');
            if (grpRes.ok) {
              const grpData = await grpRes.json();
              if (grpData?.groups && isMounted) {
                loadedGroups = grpData.groups;
                setGroups(grpData.groups);
                const memberMap: Record<string, GroupMember[]> = {};
                const friendProfilesMap = new Map<string, Profile>();
                friendProfilesMap.set(activeProfile.id, activeProfile);

                grpData.groups.forEach((g: any) => {
                  if (g.members && Array.isArray(g.members)) {
                    memberMap[g.id] = g.members;
                    g.members.forEach((m: any) => {
                      if (m.profile) friendProfilesMap.set(m.profile.id, m.profile);
                    });
                  }
                });
                loadedMembers = memberMap;
                setMembers(memberMap);
                setAvailableUsers(Array.from(friendProfilesMap.values()));
              }
            }
          } catch (e) {
            console.warn('API get groups error:', e);
          }

          // 2. Fetch expenses
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
                loadedExpenses = expMap;
                setExpenses(expMap);
              }
            }
          } catch (e) {
            console.warn('API get expenses error:', e);
          }

          // 3. Fetch settlements
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
                loadedSettlements = setMap;
                setSettlements(setMap);
              }
            }
          } catch (e) {
            console.warn('API get settlements error:', e);
          }

          // Save fresh state to cache
          saveState(loadedGroups, loadedMembers, loadedExpenses, loadedSettlements);
        }
      } catch (err) {
        console.warn('Data fetch error in loadData:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
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
    if (!isSupabaseConfigured()) return;
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

  const clearPendingSyncQueue = () => {
    clearSyncQueue();
    setPendingSyncCount(0);
    setExpenses((prev) => {
      const updated: Record<string, Expense[]> = {};
      for (const [gid, list] of Object.entries(prev)) {
        updated[gid] = list.map((e) => ({ ...e, is_pending_sync: false }));
      }
      try {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSettlements((prev) => {
      const updated: Record<string, Settlement[]> = {};
      for (const [gid, list] of Object.entries(prev)) {
        updated[gid] = list.map((s) => ({ ...s, is_pending_sync: false }));
      }
      try {
        localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };






  // Save changes to localStorage
  const saveState = (
    newGroups?: Group[],
    newMembers?: Record<string, GroupMember[]>,
    newExpenses?: Record<string, Expense[]>,
    newSettlements?: Record<string, Settlement[]>
  ) => {
    if (newGroups) {
      groupsRef.current = newGroups;
      setGroups(newGroups);
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(newGroups));
    }
    if (newMembers) {
      membersRef.current = newMembers;
      setMembers(newMembers);
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(newMembers));
    }
    if (newExpenses) {
      expensesRef.current = newExpenses;
      setExpenses(newExpenses);
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(newExpenses));
    }
    if (newSettlements) {
      settlementsRef.current = newSettlements;
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
    const groupExpenses = expenses[groupId] || [];
    const isBaseCurrencyChanged =
      Boolean(data.base_currency) &&
      data.base_currency?.toUpperCase() !== existing.base_currency?.toUpperCase();

    if (isBaseCurrencyChanged && groupExpenses.length > 0) {
      try {
        const recalculatedExpenses = await recalculateAllExpensesForNewBaseCurrency(
          groupExpenses,
          data.base_currency!,
          existing.base_currency
        );
        const updatedExpensesMap = {
          ...expenses,
          [groupId]: recalculatedExpenses,
        };
        saveState(updatedGroups, undefined, updatedExpensesMap);

        // Sync recalculated expenses to backend
        recalculatedExpenses.forEach(async (exp) => {
          try {
            await fetch(`/api/expenses/${encodeURIComponent(exp.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...exp,
                expenseDate: exp.expense_date,
                exchangeRate: exp.exchange_rate,
                convertedAmount: exp.converted_amount,
                participants: exp.participants,
              }),
            });
          } catch {
            // ignore network error
          }
        });
      } catch (err) {
        console.error('Error recalculating group expenses on currency change:', err);
        saveState(updatedGroups);
      }
    } else {
      saveState(updatedGroups);
    }

    try {
      await fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedGroup.name,
          description: updatedGroup.description,
          icon_emoji: updatedGroup.icon_emoji,
          cover_image_url: updatedGroup.cover_image_url,
          base_currency: updatedGroup.base_currency,
          is_archived: updatedGroup.is_archived,
          archived_at: updatedGroup.archived_at,
        }),
      });
    } catch (e) {
      console.warn('API updateGroup fallback:', e);
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

  const joinGroup = async (inviteCode: string, enableNotifications: boolean = false): Promise<Group | null> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para unirte a un grupo.');
    }

    try {
      // 1. Try unified PostgreSQL join API route
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim(), enableNotifications }),
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

    if (!targetGroup && isSupabaseConfigured()) {
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

      if (isSupabaseConfigured()) {
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
      id: generateUUID(),
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
        id: generateUUID(),
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
      id: generateUUID(),
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
    const convertedAmount = Math.round(input.amount * exchangeRate * 100) / 100;

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
      ocr_status: input.ocr_status || 'completed',
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
            ocrStatus: newExpense.ocr_status,
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

    const currentExpenses = expensesRef.current[input.groupId] || expenses[input.groupId] || [];
    const updatedExpenses = {
      ...expensesRef.current,
      [input.groupId]: [newExpense, ...currentExpenses.filter((e) => e.id !== newExpense.id)],
    };

    saveState(undefined, undefined, updatedExpenses);
    return newExpense;
  };

  const scanAndCreateExpenseAsync = async (groupId: string, receiptDataUrl: string): Promise<Expense> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para escanear un gasto.');
    }

    const targetGroup = getGroup(groupId);
    const groupCurrency = targetGroup?.base_currency || 'EUR';
    const grpMembers = getGroupMembers(groupId);
    const allMemberIds = grpMembers.map((m) => m.user_id);

    // 1. Create immediate placeholder expense in 'processing' state
    const initialExpense = await addExpense({
      groupId,
      title: 'Analizando ticket con IA...',
      amount: 0,
      currency: groupCurrency,
      category: 'other',
      expenseDate: getCurrentDateTimeISOWithTimezone(),
      receiptUrl: receiptDataUrl,
      splitType: 'EQUAL',
      payers: [{ userId: currentUser.id, amountPaid: 0 }],
      selectedParticipantIds: allMemberIds.length > 0 ? allMemberIds : [currentUser.id],
      ocr_status: 'processing',
    });

    // 2. Launch background asynchronous OCR analysis (non-blocking)
    (async () => {
      try {
        console.log('[AsyncOCR] 🚀 Starting vision receipt scan for expense:', initialExpense.id);
        const scannedData = await scanReceipt(receiptDataUrl);
        console.log('[AsyncOCR] 📥 Vision receipt result:', scannedData);

        const hasValidData =
          scannedData &&
          (scannedData.amount !== undefined ||
            (scannedData.title && scannedData.title.trim().length > 0 && scannedData.title !== 'Ticket'));

        if (hasValidData) {
          const finalAmount =
            typeof scannedData.amount === 'number' && !isNaN(scannedData.amount) ? scannedData.amount : 0;
          const finalTitle = scannedData.title || 'Ticket escaneado';
          const finalCategory = scannedData.category || 'food';
          const finalDate = scannedData.date || initialExpense.expense_date;

          await updateExpense(groupId, initialExpense.id, {
            groupId,
            title: finalTitle,
            amount: finalAmount,
            currency: scannedData.currency || groupCurrency,
            category: finalCategory,
            expenseDate: finalDate,
            receiptUrl: receiptDataUrl,
            splitType: 'EQUAL',
            locationName: scannedData.locationName || null,
            latitude: scannedData.latitude !== undefined ? scannedData.latitude : null,
            longitude: scannedData.longitude !== undefined ? scannedData.longitude : null,
            payers: [{ userId: currentUser.id, amountPaid: finalAmount }],
            selectedParticipantIds: allMemberIds.length > 0 ? allMemberIds : [currentUser.id],
            ocr_status: 'completed',
          });
          console.log('[AsyncOCR] ✅ Expense auto-completed successfully:', initialExpense.id);
        } else {
          console.warn('[AsyncOCR] ⚠️ Scan produced no definitive data, marking as failed for review:', initialExpense.id);
          await updateExpense(groupId, initialExpense.id, {
            groupId,
            title: 'Ticket pendiente de revisión',
            amount: 0,
            currency: groupCurrency,
            category: 'other',
            expenseDate: initialExpense.expense_date,
            receiptUrl: receiptDataUrl,
            splitType: 'EQUAL',
            payers: [{ userId: currentUser.id, amountPaid: 0 }],
            selectedParticipantIds: allMemberIds.length > 0 ? allMemberIds : [currentUser.id],
            ocr_status: 'failed',
          });
        }
      } catch (err: any) {
        console.warn('[PachasContext] Async OCR background error:', err);
        try {
          await updateExpense(groupId, initialExpense.id, {
            groupId,
            title: 'Ticket pendiente de revisión',
            amount: 0,
            currency: groupCurrency,
            category: 'other',
            expenseDate: initialExpense.expense_date,
            receiptUrl: receiptDataUrl,
            splitType: 'EQUAL',
            payers: [{ userId: currentUser.id, amountPaid: 0 }],
            selectedParticipantIds: allMemberIds.length > 0 ? allMemberIds : [currentUser.id],
            ocr_status: 'failed',
          });
        } catch {}
      }
    })();

    return initialExpense;
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

    const currentExpenses = expensesRef.current[groupId] || expenses[groupId] || [];
    let existing = currentExpenses.find((e) => e.id === expenseId);
    if (!existing) {
      existing = {
        id: expenseId,
        group_id: groupId,
        created_by: currentUser.id,
        title: input.title,
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        expense_date: input.expenseDate,
        split_type: input.splitType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        creator: currentUser,
      };
    }

    const grpMembers = getGroupMembers(groupId);
    const memberProfiles = new Map(grpMembers.map((m) => [m.user_id, m.profile]));

    const exchangeRate = input.exchangeRate || 1.0;
    const convertedAmount = Math.round(input.amount * exchangeRate * 100) / 100;

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
      ocr_status: input.ocr_status !== undefined ? input.ocr_status : existing.ocr_status,
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
            ocrStatus: updatedExpense.ocr_status,
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

    let updatedList = currentExpenses.map((e) => (e.id === expenseId ? updatedExpense : e));
    if (!currentExpenses.some((e) => e.id === expenseId)) {
      updatedList = [updatedExpense, ...currentExpenses];
    }

    const updatedExpenses = {
      ...expensesRef.current,
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
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));

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

    // 1. Sync to PostgreSQL backend
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          full_name: updated.full_name,
          bizum_phone: updated.bizum_phone,
          avatar_url: updated.avatar_url,
        }),
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          _setCurrentUser(json.user);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(json.user));
        }
      }
    } catch (err) {
      console.warn('Error saving profile to PostgreSQL backend:', err);
    }

    // 2. Also try Supabase only if actually configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        await supabase.from('profiles').update({
          full_name: updated.full_name,
          bizum_phone: updated.bizum_phone,
          avatar_url: updated.avatar_url,
        }).eq('id', updated.id);
      } catch (e) {}
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Error signing out from Supabase:', e);
      }
    }

    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch (e) {}
    _setCurrentUser(null);
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
    setComments({});
    setAvailableUsers(DEMO_USERS);
    _setCurrentUser(null);
  };

  const getExpenseComments = (expenseId: string) => comments[expenseId] || [];

  const fetchExpenseComments = async (expenseId: string): Promise<ExpenseComment[]> => {
    try {
      const res = await fetch(`/api/expenses/${expenseId}/comments`);
      if (res.ok) {
        const data = await res.json();
        if (data?.comments) {
          setComments((prev) => {
            const updated = { ...prev, [expenseId]: data.comments };
            try {
              localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
            } catch {}
            return updated;
          });
          return data.comments;
        }
      }
    } catch (err) {
      console.warn('Error fetching comments:', err);
    }
    return comments[expenseId] || [];
  };

  const addExpenseComment = async (expenseId: string, text: string): Promise<ExpenseComment> => {
    if (!currentUser) throw new Error('Debes iniciar sesión para comentar.');

    const newComment: ExpenseComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      expense_id: expenseId,
      user_id: currentUser.id,
      comment: text,
      created_at: new Date().toISOString(),
      profile: currentUser,
    };

    // Optimistic local update
    setComments((prev) => {
      const currentList = prev[expenseId] || [];
      const updated = { ...prev, [expenseId]: [...currentList, newComment] };
      try {
        localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Sync to backend
    try {
      const res = await fetch(`/api/expenses/${expenseId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newComment.id, comment: text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.comment) {
          setComments((prev) => {
            const currentList = prev[expenseId] || [];
            const replaced = currentList.map((c) => (c.id === newComment.id ? data.comment : c));
            const updated = { ...prev, [expenseId]: replaced };
            try {
              localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
            } catch {}
            return updated;
          });
          return data.comment;
        }
      }
    } catch (err) {
      console.warn('Error syncing comment to backend:', err);
    }

    return newComment;
  };

  const deleteExpenseComment = async (commentId: string, expenseId: string): Promise<void> => {
    setComments((prev) => {
      const currentList = prev[expenseId] || [];
      const filtered = currentList.filter((c) => c.id !== commentId);
      const updated = { ...prev, [expenseId]: filtered };
      try {
        localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await fetch(`/api/expenses/${expenseId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Error deleting comment from backend:', err);
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
        scanAndCreateExpenseAsync,
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
        clearPendingSyncQueue,
        comments,
        getExpenseComments,
        addExpenseComment,
        deleteExpenseComment,
        fetchExpenseComments,
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
