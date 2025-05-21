export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://192.168.4.4:4000"

// WebRTC configuration
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  // Add TURN servers here for production
]

// Recording configuration
export const RECORDING_MIME_TYPES = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"]

export const RECORDING_OPTIONS = {
  audioBitsPerSecond: 128000,
  videoBitsPerSecond: 2500000,
  mimeType: "video/webm;codecs=vp8,opus",
}
