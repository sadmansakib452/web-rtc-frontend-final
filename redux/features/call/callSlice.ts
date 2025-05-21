import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { User } from "@/types/user"

interface CallState {
  isCallActive: boolean
  user: User | null
  callType: "audio" | "video"
  callId: string | null
}

const initialState: CallState = {
  isCallActive: false,
  user: null,
  callType: "audio",
  callId: null,
}

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    setCallActive: (state, action: PayloadAction<boolean>) => {
      state.isCallActive = action.payload
      if (!action.payload) {
        state.callId = null
      }
    },
    setCallUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload
    },
    setCallType: (state, action: PayloadAction<"audio" | "video">) => {
      state.callType = action.payload
    },
    setCallId: (state, action: PayloadAction<string>) => {
      state.callId = action.payload
    },
    resetCall: (state) => {
      state.isCallActive = false
      state.callId = null
    },
  },
})

export const { setCallActive, setCallUser, setCallType, setCallId, resetCall } = callSlice.actions
export default callSlice.reducer
