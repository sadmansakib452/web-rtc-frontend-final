import { configureStore } from "@reduxjs/toolkit"
import authReducer from "./features/auth/authSlice"
import callReducer from "./features/call/callSlice"
import webRTCReducer from "./features/webrtc/webrtcSlice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    call: callReducer,
    webRTC: webRTCReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
