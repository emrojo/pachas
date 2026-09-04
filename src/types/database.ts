export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export type ExpenseCategory =
  | 'accommodation'
  | 'food'
  | 'transport'
  | 'activities'
  | 'shopping'
  | 'other';

export type PaymentMethod =
  | 'BIZUM'
  | 'REVOLUT'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'OTHER';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  bizum_phone?: string | null;
  role?: 'admin' | 'member';
  preferred_language?: string | null;
  is_banned?: boolean;
  banned_at?: string | null;
  banned_by?: string | null;
  ban_reason?: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  icon_emoji: string;
  cover_image_url?: string | null;
  base_currency: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_archived?: boolean;
  archived_at?: string | null;
  is_frozen?: boolean;
  frozen_at?: string | null;
  frozen_by?: string | null;
  frozen_reason?: string | null;
  freeze_type?: 'full' | 'read_only' | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  notifications_enabled?: boolean;
  joined_at: string;
  profile?: Profile;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  invited_by: string | null;
  email: string;
  role: 'admin' | 'member';
  token: string;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  custom_message?: string | null;
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
  inviter?: Profile;
}

export interface ExpensePayer {
  id: string;
  expense_id: string;
  user_id: string;
  amount_paid: number;
  profile?: Profile;
}

export interface ExpenseParticipant {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  percentage?: number | null;
  shares?: number | null;
  profile?: Profile;
}

export interface Expense {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  amount: number;
  currency: string;
  exchange_rate?: number; // Dynamically resolved from public.exchange_rates
  converted_amount?: number; // Dynamically calculated (amount * exchange_rate)
  category: ExpenseCategory;
  expense_date: string;
  receipt_url?: string | null;
  notes?: string | null;
  split_type: SplitType;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  ocr_status?: 'processing' | 'completed' | 'failed' | null;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  payers?: ExpensePayer[];
  participants?: ExpenseParticipant[];
  is_pending_sync?: boolean;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  notes?: string | null;
  settled_at: string;
  created_at: string;
  from_profile?: Profile;
  to_profile?: Profile;
  is_pending_sync?: boolean;
}


export interface MemberBalance {
  user_id: string;
  profile: Profile;
  total_paid: number;
  total_owed: number;
  net_balance: number; // Positive means user is owed money; negative means user owes money
}

export interface SimplifiedDebt {
  from_user_id: string;
  from_profile: Profile;
  to_user_id: string;
  to_profile: Profile;
  amount: number;
  currency: string;
}

export interface DailyExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate_date: string;
  rate: number;
  provider: string;
  is_estimated?: boolean;
  created_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

export interface ExpenseComment {
  id: string;
  expense_id: string;
  user_id: string;
  comment: string;
  gif_url?: string | null;
  reactions?: Record<string, string[]>; // emoji -> string[] of user_ids
  created_at: string;
  profile?: Profile;
}

export interface GroupMessageReplySnippet {
  id: string;
  author_name: string;
  message: string;
  expense_id?: string | null;
  expense_title?: string | null;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  message: string;
  gif_url?: string | null;
  reactions?: Record<string, string[]>; // emoji -> string[] of user_ids
  created_at: string;
  profile?: Profile;
  expense_id?: string | null;
  expense_title?: string | null;
  expense_amount?: number | null;
  expense_currency?: string | null;
  reply_to_id?: string | null;
  reply_to_snippet?: GroupMessageReplySnippet | null;
}

export interface PendingReceiptScan {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  original_image: string; // Base64 pre-censored image
  status: 'processing' | 'ready' | 'error';
  error_message?: string;
  scanned_data?: any; // ScannedReceiptData
}

export type SupportCategory =
  | 'general'
  | 'bug'
  | 'report_clarification'
  | 'appeal'
  | 'other';

export interface SupportMessage {
  id: string;
  user_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  message: string;
  category?: SupportCategory;
  attachment_url?: string | null;
  is_read_by_user: boolean;
  is_read_by_admin: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
  user_name?: string;
  user_email?: string;
}

export type NotificationType =
  | 'receipt_pending'
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'comment_created'
  | 'comment_reaction'
  | 'group_message_created'
  | 'group_message_reaction'
  | 'settlement_created'
  | 'group_role_updated'
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'group_archived'
  | 'group_restored'
  | 'group_frozen'
  | 'group_unfrozen'
  | 'group_deleted'
  | 'support_message_received'
  | 'user_banned'
  | 'user_unbanned'
  | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  group_id?: string;
  group_name?: string;
  expense_id?: string;
  action_url?: string;
  data?: Record<string, any>;
}



