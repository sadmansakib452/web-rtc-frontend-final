"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSelector, useDispatch } from "react-redux"
import type { RootState } from "@/redux/store"
import { login } from "@/redux/features/auth/authSlice"
import AuthForm from "@/components/auth/auth-form"
import CallDashboard from "@/components/call/call-dashboard"
import { authService } from "@/services/auth-service"

export default function Dashboard() {
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const dispatch = useDispatch()
  const { isAuthenticated } = useSelector((state: RootState) => state.auth)

  // Check for saved session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const userData = await authService.restoreSession()
        if (userData) {
          dispatch(login(userData))
        }
      } catch (error) {
        console.error("Failed to restore session:", error)
      } finally {
        setIsLoading(false)
        setIsClient(true)
      }
    }

    restoreSession()
  }, [dispatch])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#004D49]"></div>
      </div>
    )
  }

  if (!isClient) {
    return null
  }

  return <div className="container mx-auto p-4">{isAuthenticated ? <CallDashboard /> : <AuthForm />}</div>
}
