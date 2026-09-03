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
  GroupMessage,
  GroupMessageReplySnippet,
  PendingReceiptScan,
  AppNotification,
  NotificationType,
  SupportMessage,
  SupportCategory,
} from '@/types/database';
import {
  DEMO_CURRENT_USER,
  DEMO_GROUPS,
  DEMO_MEMBERS,
  DEMO_EXPENSES,
  DEMO_SETTLEMENTS,
  DEMO_USERS,
  DEFAULT_NOTIFICATIONS,
} from '@/lib/demoData';
import { calculateBalances, simplifyDebts } from '@/lib/algorithms/simplifyDebts';
import { calculateSplits } from '@/lib/algorithms/splitCalculations';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

import { isAppAdmin, isGroupAdmin as checkIsGroupAdmin, isDemoModeAllowed } from '@/lib/authConfig';
import {
  getSyncQueue,
  enqueueSyncAction,
  processSyncQueue,
  clearSyncQueue,
  SyncAction,
} from '@/lib/sync/syncManager';
import { recalculateAllExpensesForNewBaseCurrency } from '@/lib/currencies/exchangeRateService';
import { formatMoney } from '@/lib/currencies';
import { scanReceipt } from '@/lib/ocr/receiptScanner';
import { getCurrentDateTimeISOWithTimezone } from '@/lib/utils';
import { generateUUID } from '@/lib/id';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageCode, SUPPORTED_LANGUAGES } from '@/locales';

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
  isAppAdmin: boolean;
  isCurrentUserAdmin: boolean;
  isGroupAdmin: (groupId: string, userId?: string) => boolean;
  isDemoMode: boolean;
  groups: Group[];
  isLoading: boolean;
  createGroup: (
    name: string,
    description: string,
    emoji: string,
    currency: string,
    coverImageUrl?: string | null,
    enableNotifications?: boolean
  ) => Promise<Group>;
  updateGroup: (groupId: string, data: Partial<Group>) => Promise<Group>;
  getGroup: (id: string) => Group | undefined;
  fetchGroup: (groupId: string) => Promise<Group | null>;
  getGroupMembers: (groupId: string) => GroupMember[];
  getGroupExpenses: (groupId: string) => Expense[];
  getGroupSettlements: (groupId: string) => Settlement[];
  getGroupBalances: (groupId: string) => MemberBalance[];
  getGroupDebts: (groupId: string) => SimplifiedDebt[];
  addExpense: (input: CreateExpenseInput) => Promise<Expense>;
  scanAndCreateExpenseAsync: (groupId: string, receiptDataUrl: string) => Promise<Expense>;
  pendingReceiptScans: PendingReceiptScan[];
  queueReceiptScan: (groupId: string, censoredImageDataUrl: string) => Promise<PendingReceiptScan>;
  confirmPendingScan: (scanId: string, input: CreateExpenseInput) => Promise<Expense>;
  dismissPendingScan: (scanId: string) => void;
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
  deleteGroup: (groupId: string) => Promise<boolean>;
  archiveGroup: (groupId: string) => Promise<Group>;
  restoreGroup: (groupId: string) => Promise<Group>;
  freezeGroup: (groupId: string, reason?: string, freezeType?: 'full' | 'read_only') => Promise<Group>;
  unfreezeGroup: (groupId: string) => Promise<Group>;
  isGroupFrozen: (groupId: string) => boolean;
  joinGroup: (inviteCode: string, enableNotifications?: boolean) => Promise<Group | null>;
  addMemberByEmail: (groupId: string, email: string) => Promise<boolean>;
  addMemberToGroup: (groupId: string, userId: string) => Promise<boolean>;
  removeMemberFromGroup: (groupId: string, userId: string) => Promise<boolean>;
  updateMemberRole: (groupId: string, userId: string, newRole: 'admin' | 'member') => Promise<boolean>;
  availableUsers: Profile[];
  createLocalUser: (data: {
    full_name: string;
    email: string;
    bizum_phone?: string;
    preferred_language?: string;
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
  addExpenseComment: (expenseId: string, comment: string, gifUrl?: string | null) => Promise<ExpenseComment>;
  deleteExpenseComment: (commentId: string, expenseId: string) => Promise<void>;
  fetchExpenseComments: (expenseId: string) => Promise<ExpenseComment[]>;
  toggleCommentReaction: (commentId: string, expenseId: string, emoji: string) => Promise<void>;
  groupMessages: Record<string, GroupMessage[]>;
  getGroupMessages: (groupId: string) => GroupMessage[];
  addGroupMessage: (
    groupId: string,
    message: string,
    gifUrl?: string | null,
    replyToId?: string | null,
    replyToSnippet?: GroupMessageReplySnippet | null,
    expenseId?: string | null
  ) => Promise<GroupMessage>;
  deleteGroupMessage: (messageId: string, groupId: string) => Promise<void>;
  fetchGroupMessages: (groupId: string) => Promise<GroupMessage[]>;
  toggleGroupMessageReaction: (messageId: string, groupId: string, emoji: string) => Promise<void>;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'created_at' | 'read'>) => void;
  seedDemoNotifications: () => void;
  supportMessages: SupportMessage[];
  isSupportModalOpen: boolean;
  supportInitialCategory?: SupportCategory;
  openSupportModal: (category?: SupportCategory) => void;
  closeSupportModal: () => void;
  fetchSupportMessages: (targetUserId?: string) => Promise<SupportMessage[]>;
  sendSupportMessage: (
    message: string,
    category?: SupportCategory,
    targetUserId?: string,
    attachmentUrl?: string
  ) => Promise<SupportMessage | null>;
  markSupportMessagesRead: (targetUserId?: string) => Promise<void>;
  banUser: (userId: string, reason?: string) => Promise<boolean>;
  unbanUser: (userId: string) => Promise<boolean>;
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
  GROUP_MESSAGES: 'pachas_group_messages_v2',
  NOTIFICATIONS: 'pachas_notifications_v2',
  SUPPORT_MESSAGES: 'pachas_support_messages_v2',
};

// Helper to strip heavy base64 strings from objects before saving to sessionStorage to prevent QuotaExceededError
function sanitizeExpensesForLocalStorage(data: Record<string, Expense[]>): Record<string, Expense[]> {
  const sanitized: Record<string, Expense[]> = {};
  for (const [groupId, list] of Object.entries(data)) {
    sanitized[groupId] = list.map((exp) => {
      // If receipt_url is a massive base64 image (> 2048 chars), omit in sessionStorage cache
      if (exp.receipt_url && exp.receipt_url.startsWith('data:') && exp.receipt_url.length > 2048) {
        return { ...exp, receipt_url: null };
      }
      return exp;
    });
  }
  return sanitized;
}

export function safeGetLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}


export function safeSetLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    // If it's expenses, sanitize heavy base64 images before saving to save 90% of storage
    if (key === STORAGE_KEYS.EXPENSES) {
      try {
        const parsed = JSON.parse(value);
        const sanitized = sanitizeExpensesForLocalStorage(parsed);
        sessionStorage.setItem(key, JSON.stringify(sanitized));
        return;
      } catch {}
    }
    sessionStorage.setItem(key, value);
  } catch (err: any) {
    if (
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      String(err?.message).includes('quota') ||
      String(err?.message).includes('Quota')
    ) {
      console.warn(`[Pachas] sessionStorage quota exceeded for key "${key}". Cleaning up heavy caches...`);
      try {
        if (key === STORAGE_KEYS.EXPENSES) {
          try {
            const parsed = JSON.parse(value);
            const sanitized = sanitizeExpensesForLocalStorage(parsed);
            sessionStorage.setItem(key, JSON.stringify(sanitized));
            return;
          } catch {}
        }
        // Emergency cleanup of non-essential keys
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && !Object.values(STORAGE_KEYS).includes(k)) {
            sessionStorage.removeItem(k);
          }
        }
        sessionStorage.setItem(key, value);
      } catch (retryErr) {
        console.warn(`[Pachas] Could not persist key "${key}" to sessionStorage:`, retryErr);
      }
    } else {
      console.warn(`[Pachas] sessionStorage.setItem error for key "${key}":`, err);
    }
  }
}



export const PachasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setLanguage } = useTranslation();
  const [currentUser, _setCurrentUser] = useState<Profile | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>(DEMO_USERS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [expenses, setExpenses] = useState<Record<string, Expense[]>>({});
  const [settlements, setSettlements] = useState<Record<string, Settlement[]>>({});
  const [comments, setComments] = useState<Record<string, ExpenseComment[]>>({});
  const [groupMessages, setGroupMessages] = useState<Record<string, GroupMessage[]>>({});
  const [lastImportBatch, setLastImportBatch] = useState<{
    groupId: string;
    expenseIds: string[];
    count: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [pendingReceiptScans, setPendingReceiptScans] = useState<PendingReceiptScan[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('pachas_pending_scans_v1');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        safeSetLocalStorage('pachas_pending_scans_v1', JSON.stringify(pendingReceiptScans));
      } catch (err) {
        console.warn('Error saving pending scans to storage:', err);
      }
    }
  }, [pendingReceiptScans]);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeGetLocalStorage(STORAGE_KEYS.NOTIFICATIONS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        return DEFAULT_NOTIFICATIONS;
      }
    }
    return DEFAULT_NOTIFICATIONS;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
  }, [notifications]);

  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeGetLocalStorage(STORAGE_KEYS.SUPPORT_MESSAGES);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportInitialCategory, setSupportInitialCategory] = useState<SupportCategory | undefined>(undefined);

  const openSupportModal = (category?: SupportCategory) => {
    setSupportInitialCategory(category);
    setIsSupportModalOpen(true);
  };

  const closeSupportModal = () => {
    setIsSupportModalOpen(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      safeSetLocalStorage(STORAGE_KEYS.SUPPORT_MESSAGES, JSON.stringify(supportMessages));
    }
  }, [supportMessages]);

  // Synchronize pending receipt scans into notifications
  useEffect(() => {
    if (pendingReceiptScans.length > 0 && currentUser) {
      pendingReceiptScans.forEach((scan) => {
        if (scan.status === 'ready') {
          const notifId = `notif-scan-${scan.id}`;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === notifId)) return prev;
            const newNotif: AppNotification = {
              id: notifId,
              user_id: scan.user_id,
              type: 'receipt_pending',
              title: '🧾 Ticket listo para validar',
              message: scan.scanned_data?.title
                ? `Se ha procesado "${scan.scanned_data.title}" (${scan.scanned_data.amount || 0} €). Valídalo para añadirlo al grupo.`
                : 'Tu ticket escaneado por IA está listo para que lo revises y confirmes.',
              created_at: scan.created_at || new Date().toISOString(),
              read: false,
              group_id: scan.group_id,
              action_url: `/groups/${scan.group_id}?validateScan=${scan.id}`,
              data: { scanId: scan.id },
            };
            return [newNotif, ...prev];
          });
        }
      });
    }
  }, [pendingReceiptScans, currentUser]);

  const groupsRef = useRef<Group[]>(groups);
  const membersRef = useRef<Record<string, GroupMember[]>>(members);
  const expensesRef = useRef<Record<string, Expense[]>>(expenses);
  const settlementsRef = useRef<Record<string, Settlement[]>>(settlements);

  groupsRef.current = groups;
  membersRef.current = members;
  expensesRef.current = expenses;
  settlementsRef.current = settlements;

  // Helper to change current user and persist immediately to sessionStorage and session cookie
  const setCurrentUser = (user: Profile | null) => {
    _setCurrentUser(user);
    if (user?.preferred_language) {
      const validCodes = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
      if (validCodes.has(user.preferred_language as LanguageCode)) {
        setLanguage(user.preferred_language as LanguageCode);
      }
    }
    try {
      if (user) {
        safeSetLocalStorage(STORAGE_KEYS.USER, JSON.stringify(user));
        if (typeof document !== 'undefined') {
          document.cookie = `pachas_demo_user=${encodeURIComponent(
            JSON.stringify({ id: user.id, email: user.email, role: user.role })
          )}; path=/; max-age=604800; SameSite=Lax`;
        }
        fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.user && data.user.role && data.user.role !== user.role) {
              _setCurrentUser(data.user);
              safeSetLocalStorage(STORAGE_KEYS.USER, JSON.stringify(data.user));
            }
          })
          .catch(() => {});
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.USER);
        if (typeof document !== 'undefined') {
          document.cookie = 'pachas_demo_user=; path=/; max-age=0; SameSite=Lax';
          document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
        }
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to persist current user to sessionStorage:', e);
    }
  };

  // Initialize data from Supabase or sessionStorage or demo defaults
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const demoAllowed = isDemoModeAllowed();

      // If the user just logged out, skip re-authentication entirely
      if (typeof window !== 'undefined') {
        const justLoggedOut = sessionStorage.getItem('justLoggedOut');
        if (justLoggedOut) {
          sessionStorage.removeItem('justLoggedOut');
          Object.values(STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k));
          if (isMounted) setIsLoading(false);
          return;
        }
      }

      // Initial fast hydrate from sessionStorage to prevent UI flashing
      try {
        const savedUser = sessionStorage.getItem(STORAGE_KEYS.USER);
        const savedUsers = sessionStorage.getItem(STORAGE_KEYS.USERS);
        const savedGroups = sessionStorage.getItem(STORAGE_KEYS.GROUPS);
        const savedMembers = sessionStorage.getItem(STORAGE_KEYS.MEMBERS);
        const savedExpenses = sessionStorage.getItem(STORAGE_KEYS.EXPENSES);
        const savedSettlements = sessionStorage.getItem(STORAGE_KEYS.SETTLEMENTS);

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

        const savedComments = sessionStorage.getItem(STORAGE_KEYS.COMMENTS);
        if (savedComments && isMounted) {
          try {
            setComments(JSON.parse(savedComments));
          } catch {}
        }

        const savedGroupMessages = sessionStorage.getItem(STORAGE_KEYS.GROUP_MESSAGES);
        if (savedGroupMessages && isMounted) {
          try {
            setGroupMessages(JSON.parse(savedGroupMessages));
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
            safeSetLocalStorage(STORAGE_KEYS.EXPENSES, JSON.stringify({ ...prev, [exp.group_id]: updated }));
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
              safeSetLocalStorage(STORAGE_KEYS.EXPENSES, JSON.stringify({ ...prev, [syncedItem.groupId!]: updated }));
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
            safeSetLocalStorage(STORAGE_KEYS.SETTLEMENTS, JSON.stringify({ ...prev, [settle.group_id]: updated }));
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

  // Revalidate user ban status on window focus or visibility change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkBanStatus = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            _setCurrentUser((prev) => {
              if (!prev) return data.user;
              if (prev.is_banned !== data.user.is_banned) {
                if (data.user.is_banned && typeof window !== 'undefined') {
                  window.location.href = '/suspended';
                }
                return { ...prev, ...data.user };
              }
              return prev;
            });
          }
        }
      } catch {}
    };

    const onFocus = () => checkBanStatus();
    const onVisChange = () => {
      if (document.visibilityState === 'visible') checkBanStatus();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisChange);
    const interval = setInterval(checkBanStatus, 15000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisChange);
      clearInterval(interval);
    };
  }, []);

  const clearPendingSyncQueue = () => {
    clearSyncQueue();
    setPendingSyncCount(0);
    setExpenses((prev) => {
      const updated: Record<string, Expense[]> = {};
      for (const [gid, list] of Object.entries(prev)) {
        updated[gid] = list.map((e) => ({ ...e, is_pending_sync: false }));
      }
      safeSetLocalStorage(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
      return updated;
    });
    setSettlements((prev) => {
      const updated: Record<string, Settlement[]> = {};
      for (const [gid, list] of Object.entries(prev)) {
        updated[gid] = list.map((s) => ({ ...s, is_pending_sync: false }));
      }
      safeSetLocalStorage(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(updated));
      return updated;
    });
  };

  // Save changes to sessionStorage
  const saveState = (
    newGroups?: Group[],
    newMembers?: Record<string, GroupMember[]>,
    newExpenses?: Record<string, Expense[]>,
    newSettlements?: Record<string, Settlement[]>
  ) => {
    if (newGroups) {
      groupsRef.current = newGroups;
      setGroups(newGroups);
      safeSetLocalStorage(STORAGE_KEYS.GROUPS, JSON.stringify(newGroups));
    }
    if (newMembers) {
      membersRef.current = newMembers;
      setMembers(newMembers);
      safeSetLocalStorage(STORAGE_KEYS.MEMBERS, JSON.stringify(newMembers));
    }
    if (newExpenses) {
      expensesRef.current = newExpenses;
      setExpenses(newExpenses);
      safeSetLocalStorage(STORAGE_KEYS.EXPENSES, JSON.stringify(newExpenses));
    }
    if (newSettlements) {
      settlementsRef.current = newSettlements;
      setSettlements(newSettlements);
      safeSetLocalStorage(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(newSettlements));
    }
  };

  const handleApiBanOrAuthError = (res: Response, errData?: any): boolean => {
    if (res.status === 403) {
      const isBan = errData?.is_banned === true || String(errData?.error || '').toLowerCase().includes('suspendid');
      if (isBan || errData?.suspended_redirect_url) {
        _setCurrentUser((prev) => (prev ? { ...prev, is_banned: true, ban_reason: errData?.ban_reason || prev.ban_reason } : null));
        if (typeof window !== 'undefined') {
          window.location.href = '/suspended';
        }
        return true;
      }
    }
    return false;
  };

  const getGroup = (id: string) => groups.find((g) => g.id === id);

  const fetchGroup = async (groupId: string): Promise<Group | null> => {
    if (!groupId) return null;
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, { cache: 'no-store' });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        handleApiBanOrAuthError(res, errData);
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.group) {
          const grp: Group = data.group;
          setGroups((prev) => {
            const exists = prev.some((g) => g.id === grp.id);
            return exists ? prev.map((g) => (g.id === grp.id ? grp : g)) : [grp, ...prev];
          });

          const rawMembers = (data.group as any).members;
          if (rawMembers && Array.isArray(rawMembers)) {
            setMembers((prev) => ({
              ...prev,
              [grp.id]: rawMembers,
            }));
          }

          // Fetch expenses in parallel
          fetch(`/api/expenses?groupId=${encodeURIComponent(groupId)}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.expenses) {
                setExpenses((prev) => ({
                  ...prev,
                  [grp.id]: d.expenses,
                }));
              }
            })
            .catch(() => {});

          // Fetch settlements in parallel
          fetch(`/api/settlements?groupId=${encodeURIComponent(groupId)}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.settlements) {
                setSettlements((prev) => ({
                  ...prev,
                  [grp.id]: d.settlements,
                }));
              }
            })
            .catch(() => {});

          // Fetch group messages in parallel
          fetch(`/api/groups/${encodeURIComponent(groupId)}/messages`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.messages) {
                setGroupMessages((prev) => ({
                  ...prev,
                  [grp.id]: d.messages,
                }));
              }
            })
            .catch(() => {});

          return grp;
        }
      }
    } catch (e) {
      console.warn('fetchGroup error:', e);
    }
    return null;
  };

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
    coverImageUrl?: string | null,
    enableNotifications: boolean = true
  ): Promise<Group> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para crear un grupo.');
    }
    if (currentUser.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
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
      notifications_enabled: enableNotifications,
      joined_at: new Date().toISOString(),
      profile: currentUser,
    };

    const updatedGroups = [newGroup, ...groups];
    const updatedMembers = { ...members, [newGroup.id]: [initialMember] };
    const updatedExpenses = { ...expenses, [newGroup.id]: [] };
    const updatedSettlements = { ...settlements, [newGroup.id]: [] };

    saveState(updatedGroups, updatedMembers, updatedExpenses, updatedSettlements);

    try {
      const res = await fetch('/api/groups', {
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
          notifications_enabled: enableNotifications,
        }),
      });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        handleApiBanOrAuthError(res, errData);
        throw new Error(errData.error || 'Operación no permitida.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('suspendid')) throw e;
      console.warn('API createGroup fallback to local storage:', e);
    }

    return newGroup;
  };

  const updateGroup = async (groupId: string, data: Partial<Group>): Promise<Group> => {
    if (currentUser?.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
    }

    let existing = groups.find((g) => g.id === groupId);
    if (!existing) {
      try {
        const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          if (d?.group) existing = d.group;
        }
      } catch {}
    }

    const updatedGroup: Group = {
      ...(existing || ({ id: groupId, name: 'Grupo', base_currency: 'EUR' } as any)),
      ...data,
      updated_at: new Date().toISOString(),
    };

    const updatedGroups = groups.some((g) => g.id === groupId)
      ? groups.map((g) => (g.id === groupId ? updatedGroup : g))
      : [updatedGroup, ...groups];

    const groupExpenses = expenses[groupId] || [];
    const isBaseCurrencyChanged =
      Boolean(data.base_currency) &&
      existing?.base_currency &&
      data.base_currency?.toUpperCase() !== existing.base_currency?.toUpperCase();

    if (isBaseCurrencyChanged && groupExpenses.length > 0) {
      try {
        const recalculatedExpenses = await recalculateAllExpensesForNewBaseCurrency(
          groupExpenses,
          data.base_currency!,
          existing!.base_currency
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
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
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
          is_frozen: updatedGroup.is_frozen,
          frozen_at: updatedGroup.frozen_at,
          frozen_by: updatedGroup.frozen_by,
          frozen_reason: updatedGroup.frozen_reason,
          freeze_type: updatedGroup.freeze_type,
        }),
      });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        handleApiBanOrAuthError(res, errData);
      }
    } catch (e) {
      console.warn('API updateGroup fallback:', e);
    }

    return updatedGroup;
  };


  const archiveGroup = async (groupId: string): Promise<Group> => {
    const targetGroup = getGroup(groupId);
    const updated = await updateGroup(groupId, {
      is_archived: true,
      archived_at: new Date().toISOString(),
    });

    addNotification({
      user_id: currentUser ? currentUser.id : 'system',
      type: 'group_archived',
      title: '📦 Grupo archivado',
      message: `El grupo "${targetGroup?.name || 'Viaje'}" ha sido archivado por ${currentUser?.full_name || 'el administrador'}`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: '/dashboard',
    });

    return updated;
  };

  const restoreGroup = async (groupId: string): Promise<Group> => {
    const targetGroup = getGroup(groupId);
    const updated = await updateGroup(groupId, {
      is_archived: false,
      archived_at: null,
    });

    addNotification({
      user_id: currentUser ? currentUser.id : 'system',
      type: 'group_restored',
      title: '♻️ Grupo reactivado',
      message: `El grupo "${targetGroup?.name || 'Viaje'}" ha sido reactivado y vuelve a estar disponible`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: `/groups/${groupId}`,
    });

    return updated;
  };

  const freezeGroup = async (groupId: string, reason?: string, freezeType: 'full' | 'read_only' = 'full'): Promise<Group> => {
    const targetGroup = getGroup(groupId);
    const updated = await updateGroup(groupId, {
      is_frozen: true,
      frozen_at: new Date().toISOString(),
      frozen_by: currentUser?.id || null,
      frozen_reason: reason || 'Bajo investigación por moderación',
      freeze_type: freezeType,
    });

    addNotification({
      user_id: currentUser ? currentUser.id : 'system',
      type: 'group_frozen',
      title: '❄️ Grupo congelado por investigación',
      message: `El grupo "${targetGroup?.name || 'Viaje'}" ha sido temporalmente congelado por el administrador en espera de decisión.`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: '/dashboard',
    });

    return updated;
  };

  const unfreezeGroup = async (groupId: string): Promise<Group> => {
    const targetGroup = getGroup(groupId);
    const updated = await updateGroup(groupId, {
      is_frozen: false,
      frozen_at: null,
      frozen_by: null,
      frozen_reason: null,
      freeze_type: null,
    });

    addNotification({
      user_id: currentUser ? currentUser.id : 'system',
      type: 'group_unfrozen',
      title: '🔥 Grupo descongelado',
      message: `El grupo "${targetGroup?.name || 'Viaje'}" ha sido descongelado por el administrador y vuelve a estar disponible.`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: `/groups/${groupId}`,
    });

    return updated;
  };

  const isGroupFrozen = (groupId: string): boolean => {
    const g = getGroup(groupId);
    return Boolean(g?.is_frozen);
  };

  const deleteGroup = async (groupId: string): Promise<boolean> => {
    const targetGroup = getGroup(groupId);
    const updatedGroups = groups.filter((g) => g.id !== groupId);
    const updatedExpenses = { ...expensesRef.current };
    delete updatedExpenses[groupId];
    const updatedMembers = { ...members };
    delete updatedMembers[groupId];
    const updatedSettlements = { ...settlementsRef.current };
    delete updatedSettlements[groupId];

    saveState(updatedGroups, updatedMembers, updatedExpenses, updatedSettlements);

    try {
      await fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('API deleteGroup fallback:', e);
    }

    addNotification({
      user_id: currentUser ? currentUser.id : 'system',
      type: 'group_deleted',
      title: '🗑️ Grupo eliminado',
      message: `El grupo "${targetGroup?.name || 'Viaje'}" ha sido eliminado definitivamente`,
      action_url: '/dashboard',
    });

    return true;
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

        addNotification({
          user_id: currentUser.id,
          type: 'member_joined',
          title: '🎉 Nuevo miembro en el grupo',
          message: `${currentUser.full_name || 'Un nuevo amigo'} se ha unido al grupo "${group.name || group.invite_code}"`,
          group_id: group.id,
          group_name: group.name,
          action_url: `/groups/${group.id}?tab=members`,
        });

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
    const removedMember = grpMembers.find((m) => m.user_id === userId);
    const targetGroup = getGroup(groupId);
    const updated = grpMembers.filter((m) => m.user_id !== userId);
    const updatedMembers = {
      ...members,
      [groupId]: updated,
    };
    saveState(undefined, updatedMembers);

    addNotification({
      user_id: currentUser ? currentUser.id : userId,
      type: 'member_removed',
      title: '👤 Miembro salió del grupo',
      message: `${removedMember?.profile?.full_name || 'Un miembro'} ha salido del grupo "${targetGroup?.name || 'Viaje'}"`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: `/groups/${groupId}?tab=members`,
    });

    return true;
  };

  const updateMemberRole = async (groupId: string, userId: string, newRole: 'admin' | 'member'): Promise<boolean> => {
    const grpMembers = members[groupId] || [];
    const targetMember = grpMembers.find((m) => m.user_id === userId);
    if (!targetMember) return false;

    const updated = grpMembers.map((m) =>
      m.user_id === userId ? { ...m, role: newRole } : m
    );
    const updatedMembers = {
      ...members,
      [groupId]: updated,
    };
    saveState(undefined, updatedMembers);

    const targetGroup = getGroup(groupId);
    addNotification({
      user_id: currentUser ? currentUser.id : userId,
      type: 'group_role_updated',
      title: '🛡️ Rol de grupo actualizado',
      message: `Ahora ${targetMember.profile?.full_name || 'un miembro'} es ${newRole === 'admin' ? 'Administrador' : 'Miembro'} del grupo "${targetGroup?.name || 'Viaje'}"`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: `/groups/${groupId}?tab=members`,
    });

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        await supabase
          .from('group_members')
          .update({ role: newRole })
          .eq('group_id', groupId)
          .eq('user_id', userId);
      } catch (e) {
        console.warn('Supabase updateMemberRole sync warning:', e);
      }
    }

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

    const targetGroup = getGroup(groupId);
    addNotification({
      user_id: currentUser ? currentUser.id : userId,
      type: 'member_invited',
      title: '📨 Nuevo miembro invitado',
      message: `Se ha añadido a ${targetUser.full_name || targetUser.email} al grupo "${targetGroup?.name || 'Viaje'}"`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: `/groups/${groupId}?tab=members`,
    });

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
      sessionStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
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
    if (currentUser.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
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

        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          handleApiBanOrAuthError(res, errData);
          throw new Error(errData.error || 'Tu cuenta se encuentra suspendida.');
        }

        if (res.ok) {
          isSynced = true;
          newExpense.is_pending_sync = false;
        } else if (res.status >= 400 && res.status < 500) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al guardar el gasto.');
        }
      } catch (e: any) {
        if (e.message && (e.message.includes('suspendid') || e.message.includes('permisos') || e.message.includes('Error al guardar'))) {
          throw e;
        }
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

    const targetGroup = getGroup(input.groupId);
    addNotification({
      user_id: currentUser.id,
      type: 'expense_created',
      title: '💸 Nuevo gasto añadido',
      message: `${currentUser.full_name || 'Alguien'} ha añadido "${newExpense.title}" por ${formatMoney(newExpense.amount, newExpense.currency)}`,
      group_id: input.groupId,
      group_name: targetGroup?.name,
      expense_id: newExpense.id,
      action_url: `/groups/${input.groupId}?tab=expenses&expenseId=${newExpense.id}`,
      data: { amount: newExpense.amount, currency: newExpense.currency, title: newExpense.title },
    });

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

  const queueReceiptScan = async (groupId: string, censoredImageDataUrl: string): Promise<PendingReceiptScan> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para escanear un ticket.');
    }

    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newScan: PendingReceiptScan = {
      id: scanId,
      group_id: groupId,
      user_id: currentUser.id,
      created_at: new Date().toISOString(),
      original_image: censoredImageDataUrl,
      status: 'processing',
    };

    setPendingReceiptScans((prev) => [newScan, ...prev.filter((s) => s.id !== scanId)]);

    // Non-blocking background OCR processing
    (async () => {
      try {
        console.log('[QueueScan] 🚀 Procesando ticket en segundo plano:', scanId);
        const scannedData = await scanReceipt(censoredImageDataUrl);
        console.log('[QueueScan] 📥 Resultado de IA para scanId:', scanId, scannedData);

        setPendingReceiptScans((prev) =>
          prev.map((s) =>
            s.id === scanId
              ? {
                  ...s,
                  status: 'ready',
                  scanned_data: scannedData,
                }
              : s
          )
        );

        // Show push / in-app notification when ready
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              const notifTitle = `🧾 Ticket listo para validar: ${scannedData?.title || 'Nuevo gasto'}`;
              const notifBody = `Importe: ${scannedData?.amountFormatted || (typeof scannedData?.amount === 'number' ? `${scannedData.amount} €` : '')}. Pulsa para revisar las censuras y confirmar el gasto.`;
              
              if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification(notifTitle, {
                  body: notifBody,
                  icon: '/icon-192.png',
                  badge: '/badge-72.png',
                  tag: `scan-${scanId}`,
                  data: { scanId, groupId, url: `/groups/${groupId}?validateScan=${scanId}` },
                });
              } else {
                new Notification(notifTitle, { body: notifBody, icon: '/icon-192.png' });
              }
            } catch (notifErr) {
              console.warn('Error showing scan notification:', notifErr);
            }
          }
        }
      } catch (err: any) {
        console.warn('[QueueScan] Error analizando ticket:', err);
        setPendingReceiptScans((prev) =>
          prev.map((s) =>
            s.id === scanId
              ? {
                  ...s,
                  status: 'error',
                  error_message: err.message || 'Error al analizar el ticket',
                }
              : s
          )
        );
      }
    })();

    return newScan;
  };

  const confirmPendingScan = async (scanId: string, input: CreateExpenseInput): Promise<Expense> => {
    const createdExpense = await addExpense(input);
    setPendingReceiptScans((prev) => prev.filter((s) => s.id !== scanId));
    return createdExpense;
  };

  const dismissPendingScan = (scanId: string) => {
    setPendingReceiptScans((prev) => prev.filter((s) => s.id !== scanId));
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
    if (currentUser.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
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

        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          handleApiBanOrAuthError(res, errData);
          throw new Error(errData.error || 'Tu cuenta se encuentra suspendida.');
        }

        if (res.ok) {
          isSynced = true;
          updatedExpense.is_pending_sync = false;
        } else if (res.status >= 400 && res.status < 500) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al actualizar el gasto.');
        }
      } catch (e: any) {
        if (e.message && (e.message.includes('suspendid') || e.message.includes('permisos') || e.message.includes('Error al actualizar'))) {
          throw e;
        }
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

    const targetGroup = getGroup(groupId);
    addNotification({
      user_id: currentUser.id,
      type: 'expense_updated',
      title: '✏️ Gasto modificado',
      message: `${currentUser.full_name || 'Alguien'} ha modificado "${updatedExpense.title}" (${formatMoney(updatedExpense.amount, updatedExpense.currency)})`,
      group_id: groupId,
      group_name: targetGroup?.name,
      expense_id: updatedExpense.id,
      action_url: `/groups/${groupId}?tab=expenses&expenseId=${updatedExpense.id}`,
      data: { amount: updatedExpense.amount, currency: updatedExpense.currency, title: updatedExpense.title },
    });

    return updatedExpense;
  };

  const deleteExpense = async (groupId: string, expenseId: string): Promise<void> => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para eliminar un gasto.');
    }
    if (currentUser.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
    }

    const currentExpenses = expensesRef.current[groupId] || expenses[groupId] || [];
    const existing = currentExpenses.find((e) => e.id === expenseId);
    const isAppAdminUser = isAppAdmin(currentUser);
    const isGroupAdminUser = isUserGroupAdmin(groupId, currentUser.id);
    const isCreator = existing ? existing.created_by === currentUser.id : true;

    if (existing && !isCreator && !isAppAdminUser && !isGroupAdminUser) {
      throw new Error('No puedes eliminar este gasto porque fue creado por otro amigo.');
    }
    const filtered = currentExpenses.filter((e) => e.id !== expenseId);
    const updatedExpenses = {
      ...expenses,
      [groupId]: filtered,
    };
    saveState(undefined, undefined, updatedExpenses);

    const targetGroup = getGroup(groupId);
    addNotification({
      user_id: currentUser.id,
      type: 'expense_deleted',
      title: '🗑️ Gasto eliminado',
      message: `${currentUser.full_name || 'Alguien'} ha eliminado el gasto "${existing?.title || 'gasto'}"`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: `/groups/${groupId}?tab=expenses`,
    });

    let isDeleted = false;
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      try {
        const res = await fetch(`/api/expenses/${encodeURIComponent(expenseId)}`, {
          method: 'DELETE',
        });
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          handleApiBanOrAuthError(res, errData);
          throw new Error(errData.error || 'Tu cuenta se encuentra suspendida.');
        }
        if (res.ok) isDeleted = true;
      } catch (e: any) {
        if (e.message && (e.message.includes('suspendid') || e.message.includes('permisos'))) {
          throw e;
        }
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
    if (currentUser.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
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

        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          handleApiBanOrAuthError(res, errData);
          throw new Error(errData.error || 'Tu cuenta se encuentra suspendida.');
        }

        if (res.ok) {
          isSynced = true;
          newSettlement.is_pending_sync = false;
        } else if (res.status >= 400 && res.status < 500) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al guardar la liquidación.');
        }
      } catch (e: any) {
        if (e.message && (e.message.includes('suspendid') || e.message.includes('permisos') || e.message.includes('Error al guardar'))) {
          throw e;
        }
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




  const isAppAdminUser = isAppAdmin(currentUser);
  const isCurrentUserAdmin = isAppAdminUser;

  const isUserGroupAdmin = (groupId: string, targetUserId?: string): boolean => {
    const checkUser = targetUserId
      ? availableUsers.find((u) => u.id === targetUserId) || (currentUser?.id === targetUserId ? currentUser : null)
      : currentUser;
    if (!checkUser || !groupId) return false;
    const group = groups.find((g) => g.id === groupId);
    const groupMembers = members[groupId] || [];
    return checkIsGroupAdmin(groupId, checkUser, group, groupMembers);
  };

  const isDemoMode = isDemoModeAllowed();

  const createLocalUser = async (data: {
    full_name: string;
    email: string;
    bizum_phone?: string;
    preferred_language?: string;
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
      preferred_language: data.preferred_language || 'es',
      avatar_url: data.avatar_url || null,
      role: 'member',
      created_at: new Date().toISOString(),
    };

    const updatedUsers = [...availableUsers, newProfile];
    setAvailableUsers(updatedUsers);
    safeSetLocalStorage(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

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
      safeSetLocalStorage(STORAGE_KEYS.MEMBERS, JSON.stringify(updatedMembers));
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
    safeSetLocalStorage(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

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
    safeSetLocalStorage(STORAGE_KEYS.USER, JSON.stringify(updated));

    // Update in availableUsers list too
    const updatedUsers = availableUsers.map((u) => (u.id === currentUser.id ? updated : u));
    setAvailableUsers(updatedUsers);
    safeSetLocalStorage(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    // Update member cache across groups
    const updatedMembers: Record<string, GroupMember[]> = {};
    for (const [gid, list] of Object.entries(members)) {
      updatedMembers[gid] = list.map((m) =>
        m.user_id === currentUser.id ? { ...m, profile: updated } : m
      );
    }
    setMembers(updatedMembers);
    safeSetLocalStorage(STORAGE_KEYS.MEMBERS, JSON.stringify(updatedMembers));

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
          preferred_language: updated.preferred_language,
        }),
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          _setCurrentUser(json.user);
          safeSetLocalStorage(STORAGE_KEYS.USER, JSON.stringify(json.user));
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
      sessionStorage.removeItem(STORAGE_KEYS.USER);
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'pachas_demo_user=; path=/; max-age=0; SameSite=Lax';
    } catch (e) {}
    sessionStorage.setItem('justLoggedOut', 'true');
    _setCurrentUser(null);
  };


  const resetLocalDatabase = async () => {
    try {
      Object.values(STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k));
      sessionStorage.removeItem('pachas_user_v1');
      sessionStorage.removeItem('pachas_groups_v1');
      sessionStorage.removeItem('pachas_expenses_v1');
      sessionStorage.removeItem('pachas_members_v1');
      sessionStorage.removeItem('pachas_settlements_v1');
      sessionStorage.removeItem('pachas_available_users_v1');
    } catch (e) {}
    setGroups([]);
    setMembers({});
    setExpenses({});
    setSettlements({});
    setComments({});
    setGroupMessages({});
    setAvailableUsers(DEMO_USERS);
    _setCurrentUser(null);
  };

  const getExpenseComments = (expenseId: string) => comments[expenseId] || [];

  const fetchExpenseComments = async (expenseId: string): Promise<ExpenseComment[]> => {
    try {
      const res = await fetch(`/api/expenses/${expenseId}/comments`);
      if (res.ok) {
        const data = await res.json();
        if (data?.comments && Array.isArray(data.comments)) {
          setComments((prev) => {
            const localList = prev[expenseId] || [];
            // If server returned 0 comments but local has comments, preserve local comments
            if (data.comments.length === 0 && localList.length > 0) {
              return prev;
            }

            // Enrich server comments with local profiles if missing
            const enriched = data.comments.map((sc: ExpenseComment) => {
              const localAuthor = availableUsers.find((u) => u.id === sc.user_id) || (currentUser?.id === sc.user_id ? currentUser : undefined);
              return {
                ...sc,
                profile: (sc.profile?.full_name && sc.profile.full_name !== 'Amigo') ? sc.profile : (localAuthor || sc.profile),
              };
            });

            const updated = { ...prev, [expenseId]: enriched };
            safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
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

  const addExpenseComment = async (expenseId: string, text: string, gifUrl?: string | null): Promise<ExpenseComment> => {
    if (!currentUser) throw new Error('Debes iniciar sesión para comentar.');
    if (currentUser.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
    }

    const newComment: ExpenseComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      expense_id: expenseId,
      user_id: currentUser.id,
      comment: text,
      gif_url: gifUrl || null,
      reactions: {},
      created_at: new Date().toISOString(),
      profile: currentUser,
    };

    const allExpenses = Object.values(expensesRef.current || {}).flat();
    const targetExpense = allExpenses.find((e) => e.id === expenseId);
    const targetGroup = targetExpense ? getGroup(targetExpense.group_id) : undefined;

    // Sync to backend first if online to prevent banned users seeing optimistic messages
    try {
      const res = await fetch(`/api/expenses/${expenseId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newComment.id, comment: text, gif_url: gifUrl }),
      });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        handleApiBanOrAuthError(res, errData);
        throw new Error(errData.error || 'Tu cuenta se encuentra suspendida.');
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.comment) {
          setComments((prev) => {
            const currentList = prev[expenseId] || [];
            const updated = { ...prev, [expenseId]: [...currentList.filter((c) => c.id !== newComment.id), { ...data.comment, profile: currentUser }] };
            safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
            return updated;
          });
          return data.comment;
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('suspendid') || err.message.includes('permisos'))) {
        throw err;
      }
      console.warn('Error syncing comment to backend:', err);
    }

    // Local fallback for offline mode only
    setComments((prev) => {
      const currentList = prev[expenseId] || [];
      const updated = { ...prev, [expenseId]: [...currentList, newComment] };
      safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
      return updated;
    });

    if (targetExpense?.group_id) {
      const mirroredMsg: GroupMessage = {
        id: newComment.id,
        group_id: targetExpense.group_id,
        user_id: currentUser.id,
        message: text,
        gif_url: gifUrl || null,
        reactions: {},
        expense_id: expenseId,
        expense_title: targetExpense.title,
        expense_amount: targetExpense.amount,
        expense_currency: targetExpense.currency,
        created_at: newComment.created_at,
        profile: currentUser,
      };

      setGroupMessages((prev) => {
        const currentList = prev[targetExpense.group_id] || [];
        if (currentList.some((m) => m.id === newComment.id)) return prev;
        const updated = { ...prev, [targetExpense.group_id]: [...currentList, mirroredMsg] };
        safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
        return updated;
      });
    }

    addNotification({
      user_id: currentUser.id,
      type: 'comment_created',
      title: '💬 Nuevo comentario',
      message: `${currentUser.full_name || 'Alguien'} ha comentado en "${targetExpense?.title || 'gasto'}": "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
      group_id: targetExpense?.group_id,
      group_name: targetGroup?.name,
      expense_id: expenseId,
      action_url: targetExpense ? `/groups/${targetExpense.group_id}?tab=expenses&expenseId=${expenseId}&comments=true` : undefined,
    });

    return newComment;
  };

  const toggleCommentReaction = async (commentId: string, expenseId: string, emoji: string): Promise<void> => {
    if (!currentUser) return;
    const userId = currentUser.id;

    // Optimistic local update
    setComments((prev) => {
      const currentList = prev[expenseId] || [];
      const updatedList = currentList.map((c) => {
        if (c.id !== commentId) return c;
        const reactions = { ...(c.reactions || {}) };
        const users = reactions[emoji] || [];
        const hasReacted = users.includes(userId);
        if (hasReacted) {
          const filtered = users.filter((u) => u !== userId);
          if (filtered.length === 0) {
            delete reactions[emoji];
          } else {
            reactions[emoji] = filtered;
          }
        } else {
          reactions[emoji] = [...users, userId];
        }
        return { ...c, reactions };
      });
      const updated = { ...prev, [expenseId]: updatedList };
      safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));

      const allExpenses = Object.values(expensesRef.current || {}).flat();
      const targetExpense = allExpenses.find((e) => e.id === expenseId);
      const targetGroup = targetExpense ? getGroup(targetExpense.group_id) : undefined;

      addNotification({
        user_id: currentUser.id,
        type: 'comment_reaction',
        title: '✨ Nueva reacción',
        message: `${currentUser.full_name || 'Alguien'} ha reaccionado con ${emoji} a un comentario en "${targetExpense?.title || 'gasto'}"`,
        group_id: targetExpense?.group_id,
        group_name: targetGroup?.name,
        expense_id: expenseId,
        action_url: targetExpense ? `/groups/${targetExpense.group_id}?tab=expenses&expenseId=${expenseId}&comments=true` : undefined,
      });

      return updated;
    });

    // Sync to backend
    try {
      await fetch(`/api/expenses/${expenseId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, emoji }),
      });
    } catch (err) {
      console.warn('Error toggling comment reaction in backend:', err);
    }
  };

  const deleteExpenseComment = async (commentId: string, expenseId: string): Promise<void> => {
    setComments((prev) => {
      const currentList = prev[expenseId] || [];
      const filtered = currentList.filter((c) => c.id !== commentId);
      const updated = { ...prev, [expenseId]: filtered };
      safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
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

  const getGroupMessages = (groupId: string): GroupMessage[] => groupMessages[groupId] || [];

  const fetchGroupMessages = async (groupId: string): Promise<GroupMessage[]> => {
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`);
      if (res.ok) {
        const data = await res.json();
        if (data?.messages && Array.isArray(data.messages)) {
          setGroupMessages((prev) => {
            const localList = prev[groupId] || [];
            if (data.messages.length === 0 && localList.length > 0) {
              return prev;
            }

            const enriched = data.messages.map((sm: GroupMessage) => {
              const localAuthor = availableUsers.find((u) => u.id === sm.user_id) || (currentUser?.id === sm.user_id ? currentUser : undefined);
              return {
                ...sm,
                profile: (sm.profile?.full_name && sm.profile.full_name !== 'Amigo') ? sm.profile : (localAuthor || sm.profile),
              };
            });

            const updated = { ...prev, [groupId]: enriched };
            safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
            return updated;
          });
          return data.messages;
        }
      }
    } catch (err) {
      console.warn('Error fetching group messages:', err);
    }
    return groupMessages[groupId] || [];
  };

  const addGroupMessage = async (
    groupId: string,
    message: string,
    gifUrl?: string | null,
    replyToId?: string | null,
    replyToSnippet?: GroupMessageReplySnippet | null,
    expenseId?: string | null
  ): Promise<GroupMessage> => {
    if (!currentUser) throw new Error('Debes iniciar sesión para enviar mensajes.');
    if (currentUser.is_banned) {
      if (typeof window !== 'undefined') window.location.href = '/suspended';
      throw new Error('Tu cuenta se encuentra suspendida por moderación.');
    }

    const effExpenseId = expenseId || replyToSnippet?.expense_id || null;
    const allExpenses = Object.values(expensesRef.current || {}).flat();
    const targetExpense = effExpenseId ? allExpenses.find((e) => e.id === effExpenseId) : undefined;

    const newMessage: GroupMessage = {
      id: generateUUID(),
      group_id: groupId,
      user_id: currentUser.id,
      message: message,
      gif_url: gifUrl || null,
      reactions: {},
      expense_id: effExpenseId,
      expense_title: targetExpense?.title || replyToSnippet?.expense_title || null,
      expense_amount: targetExpense?.amount || null,
      expense_currency: targetExpense?.currency || null,
      reply_to_id: replyToId || null,
      reply_to_snippet: replyToSnippet || null,
      created_at: new Date().toISOString(),
      profile: currentUser,
    };

    // Sync to backend first if online to prevent banned users seeing optimistic messages
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newMessage.id,
          message,
          gif_url: gifUrl,
          reply_to_id: replyToId,
          reply_to_snippet: replyToSnippet,
          expense_id: effExpenseId,
        }),
      });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        handleApiBanOrAuthError(res, errData);
        throw new Error(errData.error || 'Tu cuenta se encuentra suspendida.');
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.message) {
          const finalMsg = { ...data.message, profile: currentUser };
          setGroupMessages((prev) => {
            const currentList = prev[groupId] || [];
            const exists = currentList.some((m) => m.id === finalMsg.id || m.id === newMessage.id);
            const updatedList = exists
              ? currentList.map((m) => (m.id === finalMsg.id || m.id === newMessage.id ? finalMsg : m))
              : [...currentList, finalMsg];
            const updated = { ...prev, [groupId]: updatedList };
            safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
            return updated;
          });
          return data.message;
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('suspendid') || err.message.includes('permisos'))) {
        throw err;
      }
      console.warn('Error syncing group message to backend:', err);
    }

    // Local fallback for offline mode
    setGroupMessages((prev) => {
      const currentList = prev[groupId] || [];
      const updated = { ...prev, [groupId]: [...currentList, newMessage] };
      safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
      return updated;
    });

    // Bidirectional sync: If message is linked/replying to an expense, also record in comments cache!
    if (effExpenseId) {
      const mirroredComment: ExpenseComment = {
        id: newMessage.id,
        expense_id: effExpenseId,
        user_id: currentUser.id,
        comment: message,
        gif_url: gifUrl || null,
        reactions: {},
        created_at: newMessage.created_at,
        profile: currentUser,
      };
      setComments((prev) => {
        const currentList = prev[effExpenseId] || [];
        if (currentList.some((c) => c.id === newMessage.id)) return prev;
        const updated = { ...prev, [effExpenseId]: [...currentList, mirroredComment] };
        safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
        return updated;
      });
    }

    // Sync to backend
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newMessage.id,
          message,
          gif_url: gifUrl,
          reply_to_id: replyToId,
          reply_to_snippet: replyToSnippet,
          expense_id: effExpenseId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.message) {
          setGroupMessages((prev) => {
            const currentList = prev[groupId] || [];
            const replaced = currentList.map((m) => (m.id === newMessage.id ? { ...data.message, profile: currentUser } : m));
            const updated = { ...prev, [groupId]: replaced };
            safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (err) {
      console.warn('Error syncing group message to backend:', err);
    }

    const targetGroup = getGroup(groupId);
    const snippet = message.trim()
      ? message.length > 50 ? message.slice(0, 47) + '...' : message
      : 'ha enviado un GIF';

    addNotification({
      user_id: currentUser.id,
      type: 'group_message_created',
      title: `💬 Mensaje en ${targetGroup?.name || 'el grupo'}`,
      message: `${currentUser.full_name?.split(' ')[0] || 'Un amigo'}: ${snippet}`,
      group_id: groupId,
      group_name: targetGroup?.name,
      action_url: `/groups/${groupId}?tab=members&chat=true`,
      data: { messageId: newMessage.id, groupId, expenseId: effExpenseId },
    });

    return newMessage;
  };

  const deleteGroupMessage = async (messageId: string, groupId: string): Promise<void> => {
    setGroupMessages((prev) => {
      const currentList = prev[groupId] || [];
      const updated = { ...prev, [groupId]: currentList.filter((m) => m.id !== messageId) };
      safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
      return updated;
    });

    try {
      await fetch(`/api/groups/${groupId}/messages?messageId=${messageId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Error deleting group message:', err);
    }
  };

  const toggleGroupMessageReaction = async (messageId: string, groupId: string, emoji: string): Promise<void> => {
    if (!currentUser) return;
    const userId = currentUser.id;

    setGroupMessages((prev) => {
      const currentList = prev[groupId] || [];
      const updated = currentList.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = { ...(msg.reactions || {}) };
        const userList = reactions[emoji] || [];
        if (userList.includes(userId)) {
          reactions[emoji] = userList.filter((id) => id !== userId);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        } else {
          reactions[emoji] = [...userList, userId];
        }
        return { ...msg, reactions };
      });

      const nextState = { ...prev, [groupId]: updated };
      safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(nextState));
      return nextState;
    });

    try {
      await fetch(`/api/groups/${groupId}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji }),
      });
    } catch (err) {
      console.warn('Error toggling group message reaction:', err);
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
      return updated;
    });
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  };

  const seedDemoNotifications = () => {
    setNotifications(DEFAULT_NOTIFICATIONS);
    safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(DEFAULT_NOTIFICATIONS));
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'created_at' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev];
      safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
      return updated;
    });
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Real-time EventSource listener for instant messages, reactions, and notifications
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isDisposed = false;

    const connectSSE = () => {
      if (isDisposed) return;

      try {
        eventSource = new EventSource('/api/realtime');

        eventSource.onmessage = (event) => {
          if (!event.data) return;
          try {
            const parsed = JSON.parse(event.data);
            if (!parsed?.type) return;

            if (parsed.type === 'group_message_created') {
              const msg = parsed.payload;
              if (msg && msg.group_id) {
                setGroupMessages((prev) => {
                  const currentList = prev[msg.group_id] || [];
                  // Prevent duplicate if already in state
                  if (currentList.some((m) => m.id === msg.id)) {
                    return prev;
                  }
                  const updated = {
                    ...prev,
                    [msg.group_id]: [...currentList, msg],
                  };
                  safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
                  return updated;
                });

                // In-app notification if message was sent by another user
                if (currentUser && msg.user_id !== currentUser.id) {
                  const authorName = msg.profile?.full_name || 'Alguien';
                  addNotification({
                    user_id: currentUser.id,
                    type: 'group_message_created',
                    group_id: msg.group_id,
                    title: `Mensaje de ${authorName}`,
                    message: msg.message || 'Ha enviado un mensaje en el grupo',
                    action_url: `/groups/${msg.group_id}?tab=chat&messageId=${msg.id}`,
                  });
                }
              }
            } else if (parsed.type === 'group_message_reaction') {
              const { messageId, reactions } = parsed.payload || {};
              const targetGroupId = parsed.groupId;
              if (targetGroupId && messageId) {
                setGroupMessages((prev) => {
                  const currentList = prev[targetGroupId] || [];
                  const updatedList = currentList.map((m) =>
                    m.id === messageId ? { ...m, reactions: reactions || {} } : m
                  );
                  const updated = { ...prev, [targetGroupId]: updatedList };
                  safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'group_message_deleted') {
              const { messageId } = parsed.payload || {};
              const targetGroupId = parsed.groupId;
              if (targetGroupId && messageId) {
                setGroupMessages((prev) => {
                  const currentList = prev[targetGroupId] || [];
                  const updatedList = currentList.filter((m) => m.id !== messageId);
                  const updated = { ...prev, [targetGroupId]: updatedList };
                  safeSetLocalStorage(STORAGE_KEYS.GROUP_MESSAGES, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'expense_created') {
              const exp = parsed.payload;
              if (exp && exp.group_id) {
                setExpenses((prev) => {
                  const currentList = prev[exp.group_id] || [];
                  if (currentList.some((e) => e.id === exp.id)) {
                    // Update if already in list (e.g. from local optimistic add)
                    return {
                      ...prev,
                      [exp.group_id]: currentList.map((e) => (e.id === exp.id ? { ...e, ...exp } : e)),
                    };
                  }
                  const updated = {
                    ...prev,
                    [exp.group_id]: [exp, ...currentList],
                  };
                  safeSetLocalStorage(STORAGE_KEYS.EXPENSES, JSON.stringify(sanitizeExpensesForLocalStorage(updated)));
                  return updated;
                });

                // In-app notification if created by another user
                if (currentUser && exp.created_by !== currentUser.id) {
                  const authorName = exp.creator?.full_name || 'Un amigo';
                  addNotification({
                    user_id: currentUser.id,
                    type: 'expense_created',
                    group_id: exp.group_id,
                    title: `Nuevo gasto: ${exp.title}`,
                    message: `${authorName} ha añadido un gasto de ${exp.amount} ${exp.currency || 'EUR'}.`,
                    action_url: `/groups/${exp.group_id}`,
                  });
                }
              }
            } else if (parsed.type === 'expense_updated') {
              const exp = parsed.payload;
              if (exp && exp.group_id) {
                setExpenses((prev) => {
                  const currentList = prev[exp.group_id] || [];
                  const updatedList = currentList.map((e) => (e.id === exp.id ? { ...e, ...exp } : e));
                  const updated = {
                    ...prev,
                    [exp.group_id]: updatedList,
                  };
                  safeSetLocalStorage(STORAGE_KEYS.EXPENSES, JSON.stringify(sanitizeExpensesForLocalStorage(updated)));
                  return updated;
                });
              }
            } else if (parsed.type === 'expense_deleted') {
              const { expenseId, groupId } = parsed.payload || {};
              if (groupId && expenseId) {
                setExpenses((prev) => {
                  const currentList = prev[groupId] || [];
                  const updatedList = currentList.filter((e) => e.id !== expenseId);
                  const updated = {
                    ...prev,
                    [groupId]: updatedList,
                  };
                  safeSetLocalStorage(STORAGE_KEYS.EXPENSES, JSON.stringify(sanitizeExpensesForLocalStorage(updated)));
                  return updated;
                });
              }
            } else if (parsed.type === 'settlement_created') {
              const stl = parsed.payload;
              if (stl && stl.group_id) {
                setSettlements((prev) => {
                  const currentList = prev[stl.group_id] || [];
                  if (currentList.some((s) => s.id === stl.id)) {
                    return prev;
                  }
                  const updated = {
                    ...prev,
                    [stl.group_id]: [stl, ...currentList],
                  };
                  safeSetLocalStorage(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(updated));
                  return updated;
                });

                if (currentUser && stl.from_user_id !== currentUser.id) {
                  addNotification({
                    user_id: currentUser.id,
                    type: 'settlement_created',
                    group_id: stl.group_id,
                    title: 'Deuda liquidada',
                    message: `Se ha registrado un pago de ${stl.amount} ${stl.currency || 'EUR'}.`,
                    action_url: `/groups/${stl.group_id}?tab=balances`,
                  });
                }
              }
            } else if (parsed.type === 'member_joined') {
              const { member, group } = parsed.payload || {};
              if (member && member.group_id) {
                setMembers((prev) => {
                  const currentList = prev[member.group_id] || [];
                  if (currentList.some((m) => m.user_id === member.user_id)) {
                    return prev;
                  }
                  const updated = {
                    ...prev,
                    [member.group_id]: [...currentList, member],
                  };
                  safeSetLocalStorage(STORAGE_KEYS.MEMBERS, JSON.stringify(updated));
                  return updated;
                });

                if (member.profile) {
                  setAvailableUsers((prev) => {
                    if (prev.some((u) => u.id === member.profile.id)) return prev;
                    return [...prev, member.profile];
                  });
                }

                if (group) {
                  setGroups((prev) => {
                    if (prev.some((g) => g.id === group.id)) return prev;
                    const updated = [group, ...prev];
                    safeSetLocalStorage(STORAGE_KEYS.GROUPS, JSON.stringify(updated));
                    return updated;
                  });
                }

                if (currentUser && member.user_id !== currentUser.id) {
                  const memberName = member.profile?.full_name || 'Un amigo';
                  addNotification({
                    user_id: currentUser.id,
                    type: 'member_joined',
                    group_id: member.group_id,
                    title: 'Nuevo miembro en el grupo',
                    message: `${memberName} se ha unido al grupo.`,
                    action_url: `/groups/${member.group_id}?tab=members`,
                  });
                }
              }
            } else if (parsed.type === 'member_removed') {
              const { userId, groupId } = parsed.payload || {};
              if (groupId && userId) {
                setMembers((prev) => {
                  const currentList = prev[groupId] || [];
                  const updated = {
                    ...prev,
                    [groupId]: currentList.filter((m) => m.user_id !== userId),
                  };
                  safeSetLocalStorage(STORAGE_KEYS.MEMBERS, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'member_role_updated') {
              const { userId, groupId, role } = parsed.payload || {};
              if (groupId && userId && role) {
                setMembers((prev) => {
                  const currentList = prev[groupId] || [];
                  const updated = {
                    ...prev,
                    [groupId]: currentList.map((m) => (m.user_id === userId ? { ...m, role } : m)),
                  };
                  safeSetLocalStorage(STORAGE_KEYS.MEMBERS, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'group_updated') {
              const updatedGroup = parsed.payload;
              if (updatedGroup && updatedGroup.id) {
                setGroups((prev) => {
                  const exists = prev.some((g) => g.id === updatedGroup.id);
                  const updated = exists
                    ? prev.map((g) => (g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g))
                    : [updatedGroup, ...prev];
                  safeSetLocalStorage(STORAGE_KEYS.GROUPS, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'group_deleted') {
              const { groupId } = parsed.payload || {};
              if (groupId) {
                setGroups((prev) => {
                  const updated = prev.filter((g) => g.id !== groupId);
                  safeSetLocalStorage(STORAGE_KEYS.GROUPS, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'expense_comment_created') {
              const comment = parsed.payload;
              if (comment && comment.expense_id) {
                setComments((prev) => {
                  const currentList = prev[comment.expense_id] || [];
                  if (currentList.some((c) => c.id === comment.id)) {
                    return prev;
                  }
                  const updated = {
                    ...prev,
                    [comment.expense_id]: [...currentList, comment],
                  };
                  safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'expense_comment_deleted') {
              const { commentId, expenseId } = parsed.payload || {};
              if (expenseId && commentId) {
                setComments((prev) => {
                  const currentList = prev[expenseId] || [];
                  const updated = {
                    ...prev,
                    [expenseId]: currentList.filter((c) => c.id !== commentId),
                  };
                  safeSetLocalStorage(STORAGE_KEYS.COMMENTS, JSON.stringify(updated));
                  return updated;
                });
              }
            } else if (parsed.type === 'notification_created') {
              const notifData = parsed.payload;
              if (currentUser && notifData && (!notifData.userId || notifData.userId === currentUser.id)) {
                addNotification({
                  user_id: currentUser.id,
                  type: (notifData.type as NotificationType) || 'expense_created',
                  group_id: notifData.groupId,
                  title: notifData.title || 'Nueva notificación',
                  message: notifData.body || notifData.message || '',
                  action_url: notifData.url || (notifData.groupId ? `/groups/${notifData.groupId}` : '/dashboard'),
                });
              }
            }
          } catch {
            // Heartbeat or malformed data, ignore
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isDisposed && !reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              connectSSE();
            }, 5000);
          }
        };
      } catch (err) {
        console.warn('Realtime SSE connection could not be established:', err);
      }
    };

    connectSSE();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [currentUser?.id]);

  const fetchSupportMessages = async (targetUserId?: string): Promise<SupportMessage[]> => {
    try {
      const url = targetUserId ? `/api/support/messages?userId=${targetUserId}` : '/api/support/messages';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setSupportMessages(data.messages);
          safeSetLocalStorage(STORAGE_KEYS.SUPPORT_MESSAGES, JSON.stringify(data.messages));
          return data.messages;
        }
      }
    } catch (err) {
      console.warn('Error fetching support messages from API:', err);
    }
    return supportMessages;
  };

  const sendSupportMessage = async (
    message: string,
    category: SupportCategory = 'general',
    targetUserId?: string,
    attachmentUrl?: string
  ): Promise<SupportMessage | null> => {
    const isUserAdmin = isAppAdmin(currentUser);
    const resolvedUserId = isUserAdmin && targetUserId ? targetUserId : (currentUser?.id || 'demo-user-1');
    const senderRole: 'user' | 'admin' = isUserAdmin && targetUserId ? 'admin' : 'user';

    const localMsg: SupportMessage = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: resolvedUserId,
      sender_id: currentUser?.id || 'demo-user-1',
      sender_role: senderRole,
      message,
      category,
      attachment_url: attachmentUrl || undefined,
      is_read_by_user: senderRole === 'user',
      is_read_by_admin: senderRole === 'admin',
      created_at: new Date().toISOString(),
      sender_name: currentUser?.full_name,
      sender_avatar: currentUser?.avatar_url || undefined,
    };

    setSupportMessages((prev) => {
      const updated = [...prev, localMsg];
      safeSetLocalStorage(STORAGE_KEYS.SUPPORT_MESSAGES, JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          category,
          targetUserId,
          attachmentUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setSupportMessages((prev) =>
            prev.map((m) => (m.id === localMsg.id ? { ...data.message, sender_name: currentUser?.full_name } : m))
          );
          return data.message;
        }
      }
    } catch (err) {
      console.warn('Error posting support message to API:', err);
    }

    return localMsg;
  };

  const markSupportMessagesRead = async (targetUserId?: string): Promise<void> => {
    try {
      await fetch('/api/support/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      });
    } catch {}
  };

  const banUser = async (userId: string, reason?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setAvailableUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, is_banned: true, ban_reason: reason || 'Infracción de moderación', banned_at: new Date().toISOString() }
              : u
          )
        );
        _setCurrentUser((prev) =>
          prev && prev.id === userId
            ? { ...prev, is_banned: true, ban_reason: reason || 'Infracción de moderación' }
            : prev
        );
        return true;
      }
    } catch (err) {
      console.error('Error banning user:', err);
    }
    return false;
  };

  const unbanUser = async (userId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAvailableUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, is_banned: false, ban_reason: null, banned_at: null, banned_by: null }
              : u
          )
        );
        _setCurrentUser((prev) =>
          prev && prev.id === userId
            ? { ...prev, is_banned: false, ban_reason: null, banned_at: null, banned_by: null }
            : prev
        );
        return true;
      }
    } catch (err) {
      console.error('Error unbanning user:', err);
    }
    return false;
  };

  return (
    <PachasContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAppAdmin: isAppAdminUser,
        isCurrentUserAdmin,
        isGroupAdmin: isUserGroupAdmin,
        isDemoMode,
        availableUsers,
        createLocalUser,
        deleteLocalUser,
        groups,
        isLoading,
        createGroup,
        updateGroup,
        getGroup,
        fetchGroup,
        getGroupMembers,
        getGroupExpenses,
        getGroupSettlements,
        getGroupBalances,
        getGroupDebts,
        addExpense,
        scanAndCreateExpenseAsync,
        pendingReceiptScans,
        queueReceiptScan,
        confirmPendingScan,
        dismissPendingScan,
        importExpenses,
        lastImportBatch,
        undoLastImport,
        updateExpense,
        deleteExpense,
        recordSettlement,
        deleteGroup,
        archiveGroup,
        restoreGroup,
        freezeGroup,
        unfreezeGroup,
        isGroupFrozen,
        joinGroup,
        addMemberByEmail,
        addMemberToGroup,
        removeMemberFromGroup,
        updateMemberRole,
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
        toggleCommentReaction,
        groupMessages,
        getGroupMessages,
        addGroupMessage,
        deleteGroupMessage,
        fetchGroupMessages,
        toggleGroupMessageReaction,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        clearAllNotifications,
        addNotification,
        seedDemoNotifications,
        supportMessages,
        isSupportModalOpen,
        supportInitialCategory,
        openSupportModal,
        closeSupportModal,
        fetchSupportMessages,
        sendSupportMessage,
        markSupportMessagesRead,
        banUser,
        unbanUser,
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
