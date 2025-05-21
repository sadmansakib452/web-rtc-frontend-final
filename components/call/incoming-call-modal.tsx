"use client"

import { useEffect, useRef } from "react"
import { useDispatch } from "react-redux"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PhoneIcon, Video, X } from "lucide-react"
import { setCallActive, setCallUser } from "@/redux/features/call/callSlice"

interface IncomingCallModalProps {
  isOpen: boolean
  callData: any
  onAccept: () => void
  onReject: () => void
}

export default function IncomingCallModal({ isOpen, callData, onAccept, onReject }: IncomingCallModalProps) {
  const dispatch = useDispatch()
  const ringtoneRef = useRef<HTMLAudioElement>(null)
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Play ringtone when modal opens
    if (isOpen && ringtoneRef.current) {
      ringtoneRef.current.currentTime = 0
      ringtoneRef.current.play().catch((err) => console.log("Autoplay prevented:", err))

      // Set a timeout to auto-reject the call after 30 seconds
      callTimeoutRef.current = setTimeout(() => {
        handleReject()
      }, 30000)
    } else if (!isOpen && ringtoneRef.current) {
      ringtoneRef.current.pause()

      // Clear timeout if modal closes
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current)
        callTimeoutRef.current = null
      }
    }

    return () => {
      // Stop ringtone and clear timeout when component unmounts
      if (ringtoneRef.current) {
        ringtoneRef.current.pause()
      }

      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current)
        callTimeoutRef.current = null
      }
    }
  }, [isOpen])

  const handleAccept = () => {
    // Clear timeout when call is accepted
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }

    if (callData) {
      dispatch(setCallActive(true))
      // You would typically fetch user details here before setting call user
      dispatch(
        setCallUser({
          id: callData.caller,
          name: "Incoming User", // Replace with actual name from API
          img: "/placeholder.svg?height=200&width=200",
        }),
      )
      onAccept()
    }
  }

  const handleReject = () => {
    // Clear timeout when call is rejected
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }

    onReject()
  }

  return (
    <>
      <audio ref={ringtoneRef} loop>
        <source src="/sounds/ringtone.mp3" type="audio/mp3" />
      </audio>

      <Dialog open={isOpen} onOpenChange={() => handleReject()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Incoming {callData?.offer?.sdp?.includes("m=video") ? "Video" : "Audio"} Call
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center">
              {callData?.offer?.sdp?.includes("m=video") ? (
                <Video className="h-12 w-12 text-gray-600" />
              ) : (
                <PhoneIcon className="h-12 w-12 text-gray-600" />
              )}
            </div>

            <div className="text-center">
              <p className="text-lg font-medium">{callData?.isDoctorCall ? "Doctor" : "Patient"} is calling you</p>
              <p className="text-sm text-gray-500">Appointment #{callData?.appointmentId}</p>
            </div>

            <div className="flex gap-4 mt-4">
              <Button onClick={handleReject} variant="destructive" size="lg" className="rounded-full w-16 h-16">
                <X className="h-8 w-8" />
              </Button>

              <Button
                onClick={handleAccept}
                variant="default"
                size="lg"
                className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700"
              >
                <PhoneIcon className="h-8 w-8" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
