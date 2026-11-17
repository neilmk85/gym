export type Role = 'superadmin' | 'owner' | 'reception' | 'manager' | 'trainer' | 'member'

export interface AuthUser {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: Role
  email_verified: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  tokens: {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
  }
  user: AuthUser
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in?: number
}
