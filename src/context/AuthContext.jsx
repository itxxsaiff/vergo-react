/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { api, setAuthToken, setUnauthorizedHandler } from '../lib/api'

const TOKEN_STORAGE_KEY = 'vergo_auth_token'

const AuthContext = createContext(null)

function normalizeUser(user) {
  if (!user) {
    return null
  }

  return {
    ...user,
    accessLevel: user.accessLevel ?? user.access_level ?? 'admin',
    navigationRole: user.navigationRole ?? user.navigation_role ?? user.role,
    roleLabel: user.roleLabel ?? user.role_label ?? user.role,
    homePath: user.homePath ?? user.home_path ?? '/dashboard',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)

    if (storedToken) {
      setAuthToken(storedToken)
    }

    return storedToken
  })
  const [isBooting, setIsBooting] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)))

  // Drop the local session whenever the backend says the token is dead, so a
  // logout in another tab surfaces as a clean redirect to the login instead of
  // an "Unauthenticated." error on the next click.
  useEffect(() => {
    function clearSession() {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      setAuthToken(null)
      setToken(null)
      setUser(null)
      setIsBooting(false)
    }

    setUnauthorizedHandler(clearSession)

    // Another tab in this browser logged in or out: follow it immediately
    // rather than waiting for the next request to fail.
    function handleStorage(event) {
      if (event.key !== TOKEN_STORAGE_KEY) {
        return
      }

      if (!event.newValue) {
        clearSession()
        return
      }

      setAuthToken(event.newValue)
      setToken(event.newValue)
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      setUnauthorizedHandler(null)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    if (!token || user) {
      return
    }

    api.getMe()
      .then((response) => {
        setUser(normalizeUser(response.data ?? null))
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setAuthToken(null)
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        setIsBooting(false)
      })
  }, [token, user])

  function applySession(authPayload) {
    const nextToken = authPayload.token
    const nextUser = normalizeUser(authPayload.user)

    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setAuthToken(nextToken)
    setToken(nextToken)
    setUser(nextUser)
  }

  async function login(credentials) {
    const response = await api.login(credentials)
    applySession(response.data)
    return response.data.user
  }

  async function requestUserOtp(payload) {
    return api.requestUserOtp(payload)
  }

  async function verifyUserOtp(payload) {
    const response = await api.verifyUserOtp(payload)
    applySession(response.data)
    return response.data.user
  }

  async function requestManagerOtp(payload) {
    return api.requestManagerOtp(payload)
  }

  async function verifyManagerOtp(payload) {
    const response = await api.verifyManagerOtp(payload)
    applySession(response.data)
    return response.data.user
  }

  async function logout() {
    try {
      await api.logout()
    } catch {
      // Ignore logout transport issues and clear local session anyway.
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setAuthToken(null)
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    isBooting,
    isAuthenticated: Boolean(user && token),
    login,
    requestUserOtp,
    verifyUserOtp,
    requestManagerOtp,
    verifyManagerOtp,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
