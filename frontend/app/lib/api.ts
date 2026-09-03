export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export type AgentMode = 'chat' | 'agent' | 'research'

export interface ProviderSettings {
  provider: string
  model: string
  apiKey: string
}

export function getProviderSettings(): ProviderSettings {
  if (typeof window === 'undefined') return { provider: 'huggingface', model: '', apiKey: '' }
  return {
    provider: localStorage.getItem('aiProvider') || 'huggingface',
    model: localStorage.getItem('aiModel') || '',
    apiKey: localStorage.getItem('aiApiKey') || '',
  }
}

// ---- Chat model tiers -------------------------------------------------------

export interface ChatModelOption {
  id: string
  tier: 'standard' | 'large'
  label: string
  description: string
  contextTokens: number
}

/** Fetch the selectable chat models. Public endpoint, no auth required. */
export async function fetchChatModels(): Promise<ChatModelOption[]> {
  try {
    const r = await fetch(`${API_URL}/api/models/catalog`)
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data?.models) ? data.models : []
  } catch {
    return []
  }
}

/** Currently selected chat model id (empty string = server default). */
export function getChatModel(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('aiModel') || ''
}

export function setChatModel(id: string) {
  if (typeof window === 'undefined') return
  if (id) localStorage.setItem('aiModel', id)
  else localStorage.removeItem('aiModel')
  window.dispatchEvent(new CustomEvent('loop:model-changed', { detail: id }))
}

// ---- Auth / account helpers -------------------------------------------------

export interface StoredUser {
  id: string
  email: string
  name: string
  role?: string
  plan?: string
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as StoredUser) : null
  } catch {
    return null
  }
}

export function setAuth(token: string, user?: StoredUser) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem('token', token)
  if (user) localStorage.setItem('user', JSON.stringify(user))
}

export function clearAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

/** Fetch JSON with auth headers; throws on non-2xx with the server error text. */
export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(!(init.body instanceof FormData)), ...(init.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`)
  return data as T
}
