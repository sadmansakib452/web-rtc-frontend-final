import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface WebRTCState {
  isConnected: boolean
  isMuted: boolean
  isCameraOff: boolean
  isRecording: boolean
  localStream: MediaStream | null
  remoteStream: MediaStream | null
}

const initialState: WebRTCState = {
  isConnected: false,
  isMuted: false,
  isCameraOff: false,
  isRecording: false,
  localStream: null,
  remoteStream: null,
}

const webRTCSlice = createSlice({
  name: "webRTC",
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload
    },
    setMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload
    },
    setCameraOff: (state, action: PayloadAction<boolean>) => {
      state.isCameraOff = action.payload
    },
    setRecording: (state, action: PayloadAction<boolean>) => {
      state.isRecording = action.payload
    },
    setLocalStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.localStream = action.payload
    },
    setRemoteStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.remoteStream = action.payload
    },
    resetWebRTC: (state) => {
      state.isConnected = false
      state.isMuted = false
      state.isCameraOff = false
      state.isRecording = false
      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => track.stop())
      }
      state.localStream = null
      state.remoteStream = null
    },
  },
})

export const { setConnected, setMuted, setCameraOff, setRecording, setLocalStream, setRemoteStream, resetWebRTC } =
  webRTCSlice.actions
export default webRTCSlice.reducer
