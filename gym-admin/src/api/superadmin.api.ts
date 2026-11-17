import { apiFetch } from './client'

export interface EntitlementsResponse {
  roles: string[]
  permissions: string[]
  grants: Record<string, boolean>
}

export interface GrantUpdate {
  role: string
  permission: string
  granted: boolean
}

export const superadminApi = {
  getEntitlements: (): Promise<EntitlementsResponse> =>
    apiFetch<EntitlementsResponse>('/superadmin/entitlements'),

  updateEntitlements: (updates: GrantUpdate[]): Promise<void> =>
    apiFetch<void>('/superadmin/entitlements', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
}
