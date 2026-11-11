import { apiFetch } from './client'

export interface ReferralCode {
  id: number
  member_id: number
  code: string
  is_active: boolean
  created_at: string
}

export interface Referral {
  id: number
  referrer_id: number
  referee_member_id?: number
  referral_code_id: number
  status: 'pending' | 'converted' | 'expired'
  referee_email?: string
  converted_at?: string
  reward_points: number
  created_at: string
  updated_at: string
}

export interface LoyaltyAccount {
  id: number
  member_id: number
  total_earned: number
  total_redeemed: number
  balance: number
  updated_at: string
}

export interface LoyaltyTransaction {
  id: number
  member_id: number
  tx_type: 'earned' | 'redeemed' | 'expired' | 'adjusted'
  points: number
  description?: string
  ref_model?: string
  ref_id?: number
  created_at: string
}

export interface LoyaltyConfig {
  id: number
  facility_id: number
  points_on_new_membership: number
  points_on_renewal: number
  points_on_referral: number
  points_on_day_pass: number
  points_on_pt_session: number
  points_per_rupee: number
  min_redeem_points: number
  max_redeem_per_tx: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const loyaltyApi = {
  getReferralCode: (memberId: number) =>
    apiFetch<ReferralCode>(`/members/${memberId}/referral-code`),
  registerReferral: (code: string, refereeEmail: string) =>
    apiFetch<Referral>('/referrals', { method: 'POST', body: JSON.stringify({ code, referee_email: refereeEmail }) }),
  convertReferral: (id: number, memberId: number) =>
    apiFetch<{ status: string }>(`/referrals/${id}/convert`, { method: 'POST', body: JSON.stringify({ member_id: memberId }) }),
  listReferrals: (memberId: number) =>
    apiFetch<Referral[]>(`/members/${memberId}/referrals`),
  getLoyaltyAccount: (memberId: number) =>
    apiFetch<LoyaltyAccount>(`/members/${memberId}/loyalty`),
  redeemPoints: (memberId: number, points: number, description: string) =>
    apiFetch<{ status: string }>(`/members/${memberId}/loyalty/redeem`, { method: 'POST', body: JSON.stringify({ points, description }) }),
  listTransactions: (memberId: number, page = 1, perPage = 20) =>
    apiFetch<{ data: LoyaltyTransaction[]; meta: unknown }>(`/members/${memberId}/loyalty/transactions`, { params: { page, per_page: perPage } }),
  getConfig: () =>
    apiFetch<LoyaltyConfig>('/loyalty/config'),
  updateConfig: (cfg: Partial<Omit<LoyaltyConfig, 'id' | 'facility_id' | 'created_at' | 'updated_at'>>) =>
    apiFetch<LoyaltyConfig>('/loyalty/config', { method: 'PUT', body: JSON.stringify(cfg) }),
}
