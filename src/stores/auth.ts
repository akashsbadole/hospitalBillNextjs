import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  userId: string
  name: string
  email: string
  role: string
  phone: string | null
  avatar: string | null
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  _checkAuthCalled: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  getToken: () => string | null
  clearAuth: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      _checkAuthCalled: false,

      login: async (email: string, password: string) => {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          let data: { error?: string } = {}
          try { data = await response.json() } catch { /* non-JSON response */ }
          throw new Error(data.error || 'Login failed')
        }

        const { user, token } = await response.json()
        set({ user, token, isAuthenticated: true, isLoading: false, _checkAuthCalled: false })
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: get().token ? { Authorization: `Bearer ${get().token}` } : {},
          })
        } catch {
          // Ignore logout API errors
        }
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, _checkAuthCalled: false })
      },

      checkAuth: async () => {
        if (get()._checkAuthCalled) return
        set({ _checkAuthCalled: true })

        try {
          const storedToken = get().token
          const headers: Record<string, string> = {}
          if (storedToken) {
            headers['Authorization'] = `Bearer ${storedToken}`
          }

          const response = await fetch('/api/auth/me', {
            credentials: 'include',
            headers,
          })

          if (response.ok) {
            const data = await response.json()
            const user = data.user
            const newToken = data.token || storedToken
            set({ user, token: newToken, isAuthenticated: true, isLoading: false })
            return
          }

          if (response.status === 401 && storedToken) {
            try {
              const refreshRes = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storedToken}` },
              })
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json()
                set({
                  user: refreshData.user,
                  token: refreshData.token,
                  isAuthenticated: true,
                  isLoading: false,
                  _checkAuthCalled: false,
                })
                return
              }
            } catch {
              // Refresh failed
            }
          }

          set({ user: null, token: null, isAuthenticated: false, isLoading: false })
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false, _checkAuthCalled: false })
        }
      },

      getToken: () => get().token,

      clearAuth: () => {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, _checkAuthCalled: false })
      },
    }),
    {
      name: 'medibill-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
)