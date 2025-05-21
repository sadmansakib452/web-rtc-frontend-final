"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Maximize, Mic, MoveUp, X, Paperclip } from "lucide-react"
import ImageUpload from "./image-upload"

interface Message {
  id: number
  text: string
  sender: string
  timestamp: Date
  isAudio?: boolean
  isVideo?: boolean
  audioDuration?: string
  audioUrl?: string
  videoUrl?: string
  imageUrl?: string
}

interface CallChatProps {
  messages: Message[]
  onSendMessage: (audioUrl: string | null, message: string) => void
  isChatOpen: boolean
  setIsChatOpen: (isOpen: boolean) => void
}

const CallChat: React.FC<CallChatProps> = ({ messages, onSendMessage, setIsChatOpen }) => {
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      })
    }
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSendMessage(null, message)
      setMessage("")
    }
  }

  const startVoiceMessage = async () => {
    if (isRecording) return

    try {
      setIsRecording(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        const audioUrl = URL.createObjectURL(audioBlob)
        onSendMessage(audioUrl, "")
      }

      mediaRecorderRef.current.start()
    } catch (err) {
      console.error("Error starting voice recording:", err)
      setIsRecording(false)
    }
  }

  const stopVoiceMessage = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const playAudioMessage = (audioUrl: string) => {
    const audio = new Audio(audioUrl)
    audio.play()
  }

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl)
    setIsImageModalOpen(true)
  }

  const closeImageModal = () => {
    setIsImageModalOpen(false)
    setSelectedImage(null)
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
        <h2 className="font-medium">Chat</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsChatOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-4 max-w-xs flex ${msg.sender === "me" ? "ml-auto flex-row-reverse" : ""}`}>
            <div className="w-6 h-6 rounded-full overflow-hidden ml-2" style={{ flexShrink: 0 }}>
              <Image
                src="/placeholder.svg?height=24&width=24"
                alt="Profile"
                width={24}
                height={24}
                className="object-cover"
              />
            </div>
            {msg.isVideo ? (
              <video controls className="max-w-[300px]">
                <source src={msg.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : msg.isAudio ? (
              <div className="bg-gray-100 p-2 rounded-md flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 rounded-full bg-blue-500 p-0 flex items-center justify-center"
                  onClick={() => msg.audioUrl && playAudioMessage(msg.audioUrl)}
                >
                  <span className="text-white text-xs">▶</span>
                </Button>
                <div className="flex-1">
                  <div className="w-full h-2 bg-blue-200 rounded-full">
                    <div className="h-full w-3/4 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{msg.audioDuration}</span>
              </div>
            ) : msg.imageUrl ? (
              <div
                className="p-3 rounded-lg bg-gray-100 max-w-[300px]"
                onClick={() => msg.imageUrl && openImageModal(msg.imageUrl)}
              >
                <Image
                  src={msg.imageUrl || "/placeholder.svg"}
                  alt="Sent Image"
                  className="object-cover rounded-md"
                  width={300}
                  height={200}
                />
              </div>
            ) : (
              <div
                className={`p-3 rounded-lg ${
                  msg.sender === "me" ? "bg-[#004D49] text-white text-right" : "bg-[#f6f8f8] text-[#004D49]"
                } max-w-[300px]`}
              >
                <p className="inter text-sm font-normal leading-[22px] break-words text-left ">{msg.text}</p>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Modal */}
      {isImageModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="icon" onClick={closeImageModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="overflow-auto">
              <Image
                src={selectedImage || "/placeholder.svg"}
                alt="Preview"
                width={800}
                height={600}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Message input with integrated image upload */}
      <div className="px-4 py-3 border-t border-gray-200 flex flex-col w-full">
        <ImageUpload className="mb-2" />

        {/* Input form */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
          <div className="relative w-full flex items-center">
            <input
              type="text"
              placeholder="Enter message..."
              className="flex-1 py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#004D49] placeholder:text-[#004D49] placeholder:font-normal placeholder:leading-[22px] placeholder:text-sm placeholder:pl-0 w-full pl-10"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            {/* Fixed paperclip icon */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-[#004D49]"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-[#004D49] text-white cursor-pointer transition-transform duration-200"
            onClick={isRecording ? stopVoiceMessage : startVoiceMessage}
          >
            {isRecording ? <X className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-[#004D49] text-white cursor-pointer"
          >
            <MoveUp className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </>
  )
}

export default CallChat
