import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { User } from "@/types/user"

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  loading: boolean
  error: string | null
}

// Initialize state from localStorage if available
const getInitialState = (): AuthState => {
  if (typeof window !== "undefined") {
    const storedUser = localStorage.getItem("user")
    const token = localStorage.getItem("token")

    if (storedUser && token) {
      try {
        const user = JSON.parse(storedUser)
        return {
          isAuthenticated: true,
          user: { ...user, token },
          loading: false,
          error: null,
        }
      } catch (e) {
        console.error("Error parsing stored user:", e)
      }
    }
  }

  return {
    isAuthenticated: false,
    user: null,
    loading: false,
    error: null,
  }
}

const authSlice = createSlice({
  name: "auth",
  initialState: getInitialState(),
  reducers: {
    login: (state, action: PayloadAction<User>) => {
      state.isAuthenticated = true
      state.user = action.payload
      state.error = null

      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("token", action.payload.token || "")
        localStorage.setItem("user", JSON.stringify(action.payload))
      }
    },
    logout: (state) => {
      state.isAuthenticated = false
      state.user = null

      // Clear localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        localStorage.removeItem("userEmail")
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
    },
  },
})

export const { login, logout, setLoading, setError } = authSlice.actions
export default authSlice.reducer
