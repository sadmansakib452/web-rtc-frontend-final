import type { User } from "@/types/user"
import { API_BASE_URL } from "@/utils/constants"

export const authService = {
  // 1. Login with email and password
  async login(email: string, password: string): Promise<User> {
    try {
      // 1.1. Call login API
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.message || "Login failed")

      // 1.2. Extract token
      const token = data.authorization.token

      // 1.3. Get user profile with token
      const userData = await this.getUserProfile(token)

      // 1.4. Save session data
      this.saveSession(token, userData.email)

      return userData
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  },

  // 2. Get user profile
  async getUserProfile(token: string): Promise<User> {
    const userRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const userResult = await userRes.json()
    if (!userResult.success) {
      throw new Error(userResult.message || "Failed to get user profile")
    }

    const userData = userResult.data

    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      token: token,
      avatar: userData.avatar_url || "/placeholder.svg?height=200&width=200",
      type: userData.type,
    }
  },

  // 3. Logout user
  async logout(): Promise<void> {
    try {
      const token = localStorage.getItem("token")
      if (token) {
        // Optional: Call logout endpoint if your API has one
        // await fetch(`${API_BASE_URL}/api/auth/logout`, {
        //   method: "POST",
        //   headers: { Authorization: `Bearer ${token}` }
        // });
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      this.clearSession()
    }
  },

  // 4. Login with Google
  loginWithGoogle(userType = "user"): void {
    window.location.href = `${API_BASE_URL}/api/auth/google?userType=${userType}`
  },

  // 5. Handle OAuth callback
  async handleOAuthCallback(code: string, userType = "user"): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, userType }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || "Google login failed")
      }

      const token = data.data.token
      const userData = data.data.user

      const user: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        token: token,
        avatar: userData.avatar_url || "/placeholder.svg?height=200&width=200",
        type: userData.type,
      }

      // Save session data
      this.saveSession(token, userData.email)

      return user
    } catch (error) {
      console.error("OAuth callback error:", error)
      return null
    }
  },

  // 6. Check if user is authenticated
  checkAuth(): User | null {
    if (typeof window === "undefined") return null

    const token = localStorage.getItem("token")
    const userJson = localStorage.getItem("user")

    if (token && userJson) {
      try {
        return JSON.parse(userJson)
      } catch (e) {
        return null
      }
    }

    return null
  },

  // 7. Save session data
  saveSession(token: string, email?: string): void {
    localStorage.setItem("token", token)
    if (email) {
      localStorage.setItem("userEmail", email)
    }
  },

  // 8. Clear session data
  clearSession(): void {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("userEmail")
  },

  // 9. Restore session
  async restoreSession(): Promise<User | null> {
    const token = localStorage.getItem("token")
    if (!token) return null

    try {
      const userData = await this.getUserProfile(token)
      return userData
    } catch (error) {
      console.error("Session restore error:", error)
      this.clearSession()
      return null
    }
  },
}
