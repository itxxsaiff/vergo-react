/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { api, setAuthToken } from '../lib/api'

const TOKEN_STORAGE_KEY = 'vergo_auth_token'

const AuthContext = createContext(null)

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

  useEffect(() => {
    if (!token || user) {
      return
    }

    api.getMe()
      .then((response) => {
        setUser(response.data ?? null)
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
    const nextUser = authPayload.user

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
