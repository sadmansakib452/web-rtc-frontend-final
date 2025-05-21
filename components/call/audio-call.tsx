"use client"

import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import type { RootState } from "@/redux/store"
import { setCallActive } from "@/redux/features/call/callSlice"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { PhoneIcon, Settings } from "lucide-react"
import { IoMdMic, IoMdMicOff } from "react-icons/io"
import { FiVideo } from "react-icons/fi"
import { BsChatDots } from "react-icons/bs"
import { GrStatusPlaceholder } from "react-icons/gr"
import SettingsPopup from "./settings-popup"
import CallChat from "./call-chat"
import { useWebRTC } from "@/hooks/use-webrtc"

interface Message {
  id: number
  text: string
  sender: string
  timestamp: Date
  isAudio?: boolean
  audioDuration?: string
  audioUrl?: string
}

interface CallInterfaceProps {
  callType?: "audio" | "video"
}

export default function AudioCall({ callType = "audio" }: CallInterfaceProps) {
  const callUser = useSelector((state: RootState) => state.call.user)
  const { user } = useSelector((state: RootState) => state.auth)
  const { isMuted, isRecording } = useSelector((state: RootState) => state.webRTC)
  const dispatch = useDispatch()
  const {
    endCall,
    toggleMute,
    toggleCamera,
    startRecording,
    stopRecording,
    localVideoRef,
    remoteVideoRef,
    callStatus,
  } = useWebRTC()

  // 1. State variables
  const [callTime, setCallTime] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [isHolding, setIsHolding] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // 2. Mock messages for chat
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "This is really amazing game!",
      sender: "other",
      timestamp: new Date(),
    },
    {
      id: 2,
      text: "I just wanted to let everyone know that Kira won her game today. She even got her first goal!",
      sender: "other",
      timestamp: new Date(),
    },
    {
      id: 3,
      text: "",
      sender: "me",
      timestamp: new Date(),
      isAudio: true,
      audioDuration: "00:40",
    },
    {
      id: 4,
      text: "This is really amazing game!",
      sender: "other",
      timestamp: new Date(),
    },
    {
      id: 5,
      text: "Thanks everyone. I am super happy today.",
      sender: "me",
      timestamp: new Date(),
    },
  ])

  // 3. Start timer only when call is connected
  useEffect(() => {
    // Only start timer when call is in progress or accepted
    if (callStatus === "inprogress" || callStatus === "accepted") {
      setTimerActive(true)
    } else {
      setTimerActive(false)
    }
  }, [callStatus])

  // 4. Timer for call duration - only runs when timerActive is true
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    if (timerActive) {
      timer = setInterval(() => {
        setCallTime((prevTime) => prevTime + 1)
      }, 1000)
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [timerActive])

  // 5. Reset timer when call ends
  useEffect(() => {
    if (callStatus === "idle" || callStatus === "ended") {
      setCallTime(0)
      setTimerActive(false)
    }
  }, [callStatus])

  // 6. Format time as MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = timeInSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // 7. Handle sending a message
  const handleSendMessage = (audioUrl: string | null, message: string) => {
    const newMessage = {
      id: messages.length + 1,
      text: audioUrl ? "" : message,
      sender: "me",
      timestamp: new Date(),
      isAudio: !!audioUrl,
      audioDuration: audioUrl ? "00:00" : undefined,
      audioUrl: audioUrl || undefined,
    }
    setMessages([...messages, newMessage])
  }

  // 8. Handle ending the call
  const handleEndCall = () => {
    endCall()
    dispatch(setCallActive(false))
    setCallTime(0)
    setTimerActive(false)
  }

  // 9. Handle toggling mute
  const handleToggleMute = () => {
    toggleMute(!isMuted)
  }

  // 10. Handle toggling camera
  const handleToggleCamera = () => {
    toggleCamera()
  }

  // 11. Handle toggling recording
  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // 12. Get avatar images
  const otherAvatar = callUser?.img || "/placeholder.svg?height=200&width=200"
  const meAvatar = user?.avatar || "/placeholder.svg?height=200&width=200"

  // 13. Check if user is a coach (for recording)
  const isCoach = user?.type === "coach"

  // 14. Display connection status
  const getConnectionStatus = () => {
    switch (callStatus) {
      case "calling":
        return "Calling..."
      case "ringing":
        return "Ringing..."
      case "connecting":
        return "Connecting..."
      case "inprogress":
      case "accepted":
        return formatTime(callTime)
      default:
        return ""
    }
  }

  return (
    <div className="flex h-[90vh]">
      {/* Hidden video elements for WebRTC streams */}
      <video ref={localVideoRef} autoPlay playsInline muted className={callType === "video" ? "hidden" : "hidden"} />
      <video ref={remoteVideoRef} autoPlay playsInline className={callType === "video" ? "hidden" : "hidden"} />

      <div
        className={`flex flex-col items-center justify-between ${
          isChatOpen ? "w-2/3" : "w-full"
        } bg-gray-50 py-8 transition-all duration-300`}
      >
        {callType === "audio" ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-emerald-500">
              <Image
                src={otherAvatar || "/placeholder.svg"}
                alt={callUser?.name || "User"}
                width={128}
                height={128}
                className="object-cover"
              />
            </div>

            <h2 className="text-xl font-medium text-gray-900 mt-4">{callUser?.name || "User"}</h2>
            <p className="text-sm text-gray-500">{callUser?.title || ""}</p>
            <p className="text-sm text-gray-500 mt-1">{getConnectionStatus()}</p>

            {isRecording && (
              <div className="mt-2 flex items-center gap-2 text-red-500">
                <span className="animate-pulse h-3 w-3 rounded-full bg-red-500"></span>
                <span className="text-sm font-medium">Recording</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full">
            <div className="relative w-full h-[70vh] overflow-hidden ">
              {/* For video calls, we'll display the remote video stream directly */}
              <div className="w-full h-full bg-black">
                {remoteVideoRef.current &&
                remoteVideoRef.current.srcObject &&
                (remoteVideoRef.current.srcObject as MediaStream).getVideoTracks().length > 0 ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-white text-center">
                      <div className="mb-4">
                        <Image
                          src={otherAvatar || "/placeholder.svg"}
                          alt={callUser?.name || "User"}
                          width={128}
                          height={128}
                          className="rounded-full mx-auto"
                        />
                      </div>
                      <p className="text-xl">{callUser?.name || "User"}</p>
                      <p className="text-sm opacity-70">Video unavailable</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Local video as picture-in-picture */}
              <div className="absolute top-5 right-5 w-[150px] h-[150px] overflow-hidden bg-gray-800">
                {localVideoRef.current &&
                localVideoRef.current.srcObject &&
                (localVideoRef.current.srcObject as MediaStream).getVideoTracks().length > 0 ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-white text-center">
                      <div className="mb-2">
                        <Image
                          src={meAvatar || "/placeholder.svg"}
                          alt="You"
                          width={64}
                          height={64}
                          className="rounded-full mx-auto"
                        />
                      </div>
                      <p className="text-xs">Camera off</p>
                    </div>
                  </div>
                )}
              </div>

              {isRecording && (
                <div className="absolute top-5 left-5 flex items-center gap-2 bg-black/50 text-red-500 px-3 py-1 rounded-full">
                  <span className="animate-pulse h-3 w-3 rounded-full bg-red-500"></span>
                  <span className="text-sm font-medium">Recording</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 mt-1">{getConnectionStatus()}</p>
          </div>
        )}

        {/* Bottom section - Call controls */}
        <div className="w-full">
          <div className="bg-white p-4 rounded-xl shadow-sm py-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-0">
              <div className="flex items-center gap-6 md:gap-10">
                {/* Record button - Only show for coaches */}
                {isCoach && (
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`rounded-full w-7 h-7 ${
                        isRecording ? "text-white bg-[#EB3D4D]" : "text-[#EB3D4D] border border-[#EB3D4D]"
                      } cursor-pointer`}
                      onClick={handleToggleRecording}
                    >
                      {isRecording ? (
                        <div className="w-3 h-3 bg-white rounded-sm" />
                      ) : (
                        <div className="w-3 h-3 bg-[#EB3D4D] rounded-full" />
                      )}
                    </Button>
                    <span className="text-xs md:text-sm text-[#EB3D4D] font-medium inter-medium">
                      {isRecording ? "Stop" : "Record"}
                    </span>
                  </div>
                )}

                {/* Hold button */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="rounded-full w-8 h-8 md:w-10 md:h-10 text-gray-400 cursor-pointer duration-300 ease-linear hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => setIsHolding(!isHolding)}
                  >
                    {isHolding ? (
                      <GrStatusPlaceholder className="h-4 w-4 md:h-5 md:w-5" />
                    ) : (
                      <Image
                        src="/placeholder.svg?height=24&width=24"
                        alt="Hold"
                        width={24}
                        height={24}
                        className="w-6 h-6 md:w-8 md:h-8"
                      />
                    )}
                  </div>
                  <span className="text-xs md:text-sm inter-medium font-normal text-[#A4A4A4]">Hold</span>
                </div>
              </div>

              {/* Main call controls */}
              <div className="flex items-center gap-2 md:gap-3">
                {/* Mute button */}
                <Button
                  size="icon"
                  variant="outline"
                  className={`rounded-full w-9 h-9 md:w-12 md:h-12 cursor-pointer ${
                    isMuted ? "bg-[#004D49]" : "bg-white"
                  }`}
                  onClick={handleToggleMute}
                >
                  {isMuted ? (
                    <IoMdMicOff className="h-5 w-5 md:h-8 md:w-8 text-white" />
                  ) : (
                    <IoMdMic className="h-5 w-5 md:h-8 md:w-8" />
                  )}
                </Button>

                {/* End call button */}
                <Button
                  size="icon"
                  className="rounded-full w-9 h-9 md:w-12 md:h-12 bg-[#EB3D4D] hover:bg-[#EB3D4D]/80 cursor-pointer duration-300 ease-linear"
                  onClick={handleEndCall}
                >
                  <PhoneIcon className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </Button>

                {/* Video button */}
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full w-9 h-9 md:w-12 md:h-12 bg-white cursor-pointer duration-300 ease-linear hover:bg-gray-100"
                  onClick={handleToggleCamera}
                >
                  <FiVideo className="h-4 w-4 md:h-5 md:w-5 text-gray-800" />
                </Button>
              </div>

              <div className="flex items-center gap-6 md:gap-10">
                {/* Chat button */}
                <div
                  className="flex flex-col items-center gap-1 cursor-pointer"
                  onClick={() => setIsChatOpen(!isChatOpen)}
                >
                  <div className={`rounded-full ${isChatOpen ? "text-[#004D49]" : "text-[#D4D4D4]"}`}>
                    <BsChatDots className="h-5 w-5 md:h-7 md:w-7" />
                  </div>
                  <span
                    className={`text-xs md:text-sm inter-medium font-normal ${
                      isChatOpen ? "text-[#004D49]" : "text-[#A4A4A4]"
                    }`}
                  >
                    Chat
                  </span>
                </div>

                {/* Settings button */}
                <div
                  className="flex flex-col items-center gap-1 cursor-pointer"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <div className="rounded-full text-gray-500">
                    <Settings className="h-5 w-5 md:h-7 md:w-7 text-[#D4D4D4]" />
                  </div>
                  <span className="text-xs md:text-sm inter-medium font-normal text-[#A4A4A4]">Settings</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Popup */}
        <SettingsPopup isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>

      {/* Chat Sidebar */}
      {isChatOpen && (
        <div className="w-1/3 bg-white border-l border-gray-200 flex flex-col h-[86vh] rounded-xl ">
          <CallChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isChatOpen={isChatOpen}
            setIsChatOpen={setIsChatOpen}
          />
        </div>
      )}
    </div>
  )
}
