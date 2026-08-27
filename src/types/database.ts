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
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: Profile;
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
  exchange_rate: number;
  converted_amount: number;
  category: ExpenseCategory;
  expense_date: string;
  receipt_url?: string | null;
  notes?: string | null;
  split_type: SplitType;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
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
