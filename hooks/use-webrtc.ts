"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "@/redux/store"
import {
  setMuted,
  setCameraOff,
  setLocalStream,
  setRemoteStream,
  resetWebRTC,
  setRecording,
} from "@/redux/features/webrtc/webrtcSlice"
import { setCallId, resetCall } from "@/redux/features/call/callSlice"
import { webRTCService } from "@/services/webrtc-service"
import { userService } from "@/services/user-service"
import type { User } from "@/types/user"

export function useWebRTC() {
  const dispatch = useDispatch()
  const { user } = useSelector((state: RootState) => state.auth)
  const { localStream, remoteStream, isRecording } = useSelector((state: RootState) => state.webRTC)

  // 1. State variables
  const [contacts, setContacts] = useState<User[]>([])
  const [callStatus, setCallStatus] = useState<string>("idle")
  const [incomingCallData, setIncomingCallData] = useState<any>(null)

  // 2. Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)

  // 3. Connect to socket and set up callbacks
  const connectSocket = useCallback(
    async (token: string) => {
      if (!token || !user?.type) return null

      try {
        // 3.1. Initialize the WebRTC service
        const socket = webRTCService.initialize(token)

        // 3.2. Set up call status callback
        webRTCService.setCallStatusCallback((status, data) => {
          console.log("Call status changed:", status, data)
          setCallStatus(status)

          if (status === "remoteStreamReceived" && data?.stream) {
            dispatch(setRemoteStream(data.stream))
          }

          // Handle call rejection or cancellation
          if (status === "rejected" || status === "cancelled" || status === "error") {
            dispatch(resetWebRTC())
            dispatch(resetCall())
            setIncomingCallData(null)
          }
        })

        // 3.3. Set up incoming call callback
        webRTCService.setIncomingCallCallback((data) => {
          console.log("Incoming call received:", data)
          setIncomingCallData(data)
        })

        // 3.4. Set up call ended callback
        webRTCService.setCallEndedCallback(() => {
          console.log("Call ended callback triggered")
          dispatch(resetWebRTC())
          dispatch(resetCall())
          setCallStatus("idle")
          setIncomingCallData(null)
        })

        // 3.5. Set up recording status callback
        webRTCService.setRecordingStatusCallback((isRecording) => {
          dispatch(setRecording(isRecording))
        })

        // 3.6. Load contacts based on user role
        await loadContacts(token, user.type)

        return socket
      } catch (error) {
        console.error("Error connecting to socket:", error)
        return null
      }
    },
    [dispatch, user?.type],
  )

  // 4. Set video elements when references change
  useEffect(() => {
    if (localVideoRef.current && remoteVideoRef.current) {
      webRTCService.setVideoElements(localVideoRef.current, remoteVideoRef.current)
    }
  }, [localVideoRef.current, remoteVideoRef.current])

  // 5. Load contacts based on user role
  const loadContacts = async (token: string, userRole: string) => {
    try {
      const contactsList = await userService.getContacts(token, userRole)
      setContacts(contactsList)
    } catch (error) {
      console.error("Error loading contacts:", error)
      setContacts([])
    }
  }

  // 6. Initiate a call
  const initiateCall = async (receiverId: string, type: "audio" | "video", appointmentId?: string) => {
    try {
      // 6.1. Use provided appointmentId or default
      const callAppointmentId = appointmentId || "appointment-123";

      // 6.2. Start call
      await webRTCService.initiateCall(
        receiverId,
        callAppointmentId,
        type === "video"
      );

      // // 6.3. Update Redux state
      // if (webRTCService.localStream) {
      //   dispatch(setLocalStream(webRTCService.localStream))
      // }

      // Use the getter method instead of accessing private property
      const localStream = webRTCService.getLocalStream();
      if (localStream) {
        dispatch(setLocalStream(localStream));
      }

      const newCallId = `call-${Date.now()}`;
      dispatch(setCallId(newCallId));

      setCallStatus("calling");
    } catch (error) {
      console.error("Error initiating call:", error)
      setCallStatus("error")
    }
  }

  // 7. Accept incoming call
  const acceptCall = async (callData: any) => {
    try {
      await webRTCService.acceptCall(callData);

      // if (webRTCService.localStream) {
      //   dispatch(setLocalStream(webRTCService.localStream))
      // }

      // Use the getter method instead of accessing private property
      const localStream = webRTCService.getLocalStream();
      if (localStream) {
        dispatch(setLocalStream(localStream));
      }

      dispatch(setCallId(callData.callId));
      setCallStatus("connecting");
      setIncomingCallData(null);
    } catch (error) {
      console.error("Error accepting call:", error)
      setCallStatus("error")
      setIncomingCallData(null)
    }
  }

  // 8. Reject incoming call
  const rejectCall = (callData: any) => {
    webRTCService.rejectCall(callData)
    setIncomingCallData(null)
    setCallStatus("idle")
  }

  // 9. End call
  const endCall = useCallback(() => {
    webRTCService.endCall()
    dispatch(resetWebRTC())
    dispatch(resetCall())
    setCallStatus("idle")
    setIncomingCallData(null)
  }, [dispatch])

  // 10. Toggle mute
  const toggleMute = useCallback(
    (muted: boolean) => {
      webRTCService.toggleMute(muted)
      dispatch(setMuted(muted))
    },
    [dispatch],
  )

  // 11. Toggle camera
  const toggleCamera = useCallback(() => {
    const newState = !webRTCService.getCameraState(); // Use getter method instead of direct access
    webRTCService.toggleCamera(newState);
    dispatch(setCameraOff(newState));
    return newState;
  }, [dispatch]);

  // 12. Start recording
  const startRecording = useCallback(() => {
    if (isRecording) return false
    return webRTCService.startRecording()
  }, [isRecording])

  // 13. Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording) return
    webRTCService.stopRecording()
  }, [isRecording])

  // 14. Cleanup on unmount
  useEffect(() => {
    return () => {
      webRTCService.disconnect()
      dispatch(resetWebRTC())
      dispatch(resetCall())
    }
  }, [dispatch])

  // 15. Return hook interface
  return {
    connectSocket,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    startRecording,
    stopRecording,
    contacts,
    callStatus,
    incomingCallData,
    localVideoRef,
    remoteVideoRef,
    isRecording,
  }
}

