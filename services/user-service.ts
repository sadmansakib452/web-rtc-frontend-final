import { API_BASE_URL } from "@/utils/constants"
import type { User } from "@/types/user"

export const userService = {
  // 1. Get all available users for chat
  async getAllUsers(token: string): Promise<User[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/user`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch users")
      }

      return data.data.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        type: user.type,
        img: user.avatar_url || "/placeholder.svg?height=200&width=200",
      }))
    } catch (error) {
      console.error("Error fetching all users:", error)
      return []
    }
  },

  // 2. Get contacts based on user role (coach or user)
  async getContacts(token: string, userRole: string): Promise<User[]> {
    try {
      // 2.1. Determine the correct endpoint based on user role
      const endpoint =
        userRole === "user" ? "/api/user-dashboard/all-hired-coachs" : "/api/coach-dashboard/all-consumer-list"

      // 2.2. Get all users for mapping
      const allUsers = await this.getAllUsers(token)

      // 2.3. Fetch contacts from the appropriate endpoint
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await response.json()
      const items = userRole === "user" ? result.coachesList : result.customerlist

      // 2.4. Map contacts to users with appointment IDs
      const mappedContacts = items
        .map((item: any) => {
          const name = userRole === "user" ? item.name : item.customer_name
          const email = userRole === "user" ? item.email : null

          // 2.5. Find matching user from all users
          const match = allUsers.find((u) => (email ? u.email === email : u.name === name))

          if (!match) return null

          return {
            id: match.id,
            name,
            email: match.email,
            type: match.type,
            img: match.img,
            appointmentId: item.orderId,
            title: match.type === "coach" ? "Coach" : "User",
          }
        })
        .filter(Boolean) as User[]

      return mappedContacts
    } catch (error) {
      console.error("Error fetching contacts:", error)
      return []
    }
  },
}
