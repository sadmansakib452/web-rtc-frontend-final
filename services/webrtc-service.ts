// This service handles the WebRTC connection logic
// It's used by the useWebRTC hook

import { io, type Socket } from "socket.io-client";
import {
  API_BASE_URL,
  ICE_SERVERS,
  RECORDING_MIME_TYPES,
  RECORDING_OPTIONS,
} from "@/utils/constants";

export class WebRTCService {
  // 1. Socket and connection variables
  private socket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private selfSocketId: string | null = null;

  // 2. Call state variables
  private callId: string | null = null;
  private currentReceiver: string | null = null;
  private currentAppointment: string | null = null;
  private remoteDescSet = false;
  private candidateQueue: RTCIceCandidate[] = [];
  private callInProgress = false;
  private callRejected = false;

  // 3. Media state variables
  private isVideoCall = false;
  private micMuted = false;
  private camOff = false;

  // 4. Recording variables
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingId: string | null = null;
  private recordedChunks: Blob[] = [];
  private chunkSequence = 0;
  private audioContext: AudioContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private recordingFinalized = false;

  // 5. Video elements references
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;

  // 6. Callback handlers
  private onCallStatusChange: ((status: string, data?: any) => void) | null =
    null;
  private onIncomingCall: ((data: any) => void) | null = null;
  private onCallEnded: (() => void) | null = null;
  private onRecordingStatusChange: ((isRecording: boolean) => void) | null =
    null;

  constructor() {}

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getCameraState(): boolean {
    return this.camOff;
  }

  // 7. Initialize socket connection with authentication token
  initialize(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    // 7.1. Connect to signaling server with auth token
    this.socket = io(API_BASE_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupSocketListeners();
    return this.socket;
  }

  // 8. Set up all socket event listeners
  setupSocketListeners() {
    if (!this.socket) return;

    // 8.1. Connection events
    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
      this.selfSocketId = this.socket?.id || null;

      if (this.onCallStatusChange) {
        this.onCallStatusChange("connected");
      }
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
      if (this.onCallStatusChange) {
        this.onCallStatusChange("disconnected");
      }
    });

    // 8.2. Call signaling events
    this.socket.on("incomingCall", async (data) => {
      console.log("Incoming call:", data);

      // Skip if this is our own call or if a call is already in progress
      if (data.caller === this.selfSocketId || this.callInProgress) return;

      // Reset call rejected flag for new calls
      this.callRejected = false;

      // Store call details
      this.callId = data.callId;
      this.currentReceiver = data.caller;
      this.currentAppointment = data.appointmentId;
      this.isVideoCall = data.offer?.sdp?.includes("m=video") || false;

      // Store the call data for when user accepts/rejects
      if (this.onIncomingCall) {
        this.onIncomingCall(data);
      }

      if (this.onCallStatusChange) {
        this.onCallStatusChange("ringing");
      }
    });

    // 8.3. Call accepted event
    this.socket.on("callAccepted", async (data) => {
      console.log("Call accepted:", data);

      if (this.peerConnection) {
        try {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          this.remoteDescSet = true;
          this.flushCandidates();
          this.callInProgress = true;

          if (this.onCallStatusChange) {
            this.onCallStatusChange("accepted");
          }
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    });

    // 8.4. Call ended and error events
    this.socket.on("callEnded", () => {
      console.log("Call ended by other party");
      this.finalizeRecordingIfNeeded();
      this.handleCallCleanup();
      this.callInProgress = false;

      if (this.onCallEnded) {
        this.onCallEnded();
      }
    });

    this.socket.on("callCancelled", (data) => {
      console.log("Call cancelled:", data);
      this.finalizeRecordingIfNeeded();
      this.handleCallCleanup();
      this.callInProgress = false;

      if (this.onCallStatusChange) {
        this.onCallStatusChange("cancelled", data);
      }
    });

    this.socket.on("rejectCall", (data) => {
      console.log("Call rejected:", data);
      this.finalizeRecordingIfNeeded();
      this.handleCallCleanup();
      this.callInProgress = false;
      this.callRejected = true;

      if (this.onCallStatusChange) {
        this.onCallStatusChange("rejected", data);
      }
    });

    this.socket.on("callError", (data) => {
      console.error("Call error:", data);
      this.finalizeRecordingIfNeeded();
      this.handleCallCleanup();
      this.callInProgress = false;

      if (this.onCallStatusChange) {
        this.onCallStatusChange("error", data);
      }
    });

    // 8.5. ICE candidate events
    this.socket.on("iceCandidate", async (data) => {
      console.log("Received ICE candidate");

      if (!this.remoteDescSet) {
        this.candidateQueue.push(data.candidate);
      } else if (this.peerConnection) {
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    // 8.6. Recording events
    this.socket.on("recordingStarted", () => {
      console.log("Call recording has started");
      if (this.onCallStatusChange) {
        this.onCallStatusChange("recordingStarted");
      }
    });

    this.socket.on("recordingStopped", () => {
      console.log("Call recording has stopped");
      if (this.onCallStatusChange) {
        this.onCallStatusChange("recordingStopped");
      }
    });

    this.socket.on("recordingChunkReceived", (data) => {
      console.log("Received recording chunk confirmation:", data.sequence);
    });

    this.socket.on("recordingError", (error) => {
      console.error("Recording error:", error);
      if (this.isRecording) {
        this.stopRecording();
      }
    });
  }

  // 9. Set up media devices for call with graceful fallback
  async setupMediaDevices(isVideo: boolean) {
    try {
      // 9.1. Stop any existing streams
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      // 9.2. Define audio constraints (used in both cases)
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      // 9.3. First try with requested constraints
      try {
        // Try with the original requested constraints
        const constraints = {
          audio: audioConstraints,
          video: isVideo
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
            : false,
        };

        this.isVideoCall = isVideo;
        this.localStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );

        console.log("Media setup complete with requested constraints", {
          hasAudio: this.localStream.getAudioTracks().length > 0,
          hasVideo: this.localStream.getVideoTracks().length > 0,
        });
      } catch (err) {
        // 9.4. If video fails, fall back to audio only
        if (isVideo) {
          console.warn("Camera not available, falling back to audio-only", err);

          // Try again with audio only
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false,
          });

          // We're still in a "video call" context, just without video
          this.isVideoCall = true;

          console.log("Media setup complete with audio-only fallback", {
            hasAudio: this.localStream.getAudioTracks().length > 0,
            hasVideo: 0,
          });
        } else {
          // If it's an audio call and still failing, rethrow the error
          throw err;
        }
      }

      // 9.5. Set local video element if available
      if (this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
      }

      return this.localStream;
    } catch (err) {
      console.error("Media setup error:", err);
      throw err;
    }
  }

  // 10. Set video elements for displaying streams
  setVideoElements(local: HTMLVideoElement, remote: HTMLVideoElement) {
    this.localVideoElement = local;
    this.remoteVideoElement = remote;

    // 10.1. Set existing streams if available
    if (this.localStream && this.localVideoElement) {
      this.localVideoElement.srcObject = this.localStream;
    }

    if (this.remoteStream && this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = this.remoteStream;
    }
  }

  // 11. Create WebRTC peer connection
  createPeerConnection() {
    // 11.1. Close existing peer connection if any
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // 11.2. Initialize peer connection with ICE servers
    this.peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    // 11.3. Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          console.log(`Adding track to peer connection: ${track.kind}`);
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    // 11.4. Set up ICE candidate handling
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          console.log("Sending ICE candidate");
          this.socket.emit("iceCandidate", {
            callId: this.callId,
            candidate: event.candidate,
            to: this.currentReceiver,
          });
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log(
          "ICE connection state:",
          this.peerConnection?.iceConnectionState
        );

        if (this.peerConnection?.iceConnectionState === "connected") {
          console.log("ICE connection established");
          this.callInProgress = true;

          if (this.onCallStatusChange) {
            this.onCallStatusChange("inprogress");
          }
        } else if (
          this.peerConnection?.iceConnectionState === "failed" ||
          this.peerConnection?.iceConnectionState === "disconnected"
        ) {
          console.log("ICE connection failed or disconnected");

          if (this.onCallStatusChange) {
            this.onCallStatusChange("connectionFailed");
          }
        }
      };

      // 11.5. Handle incoming remote tracks
      this.peerConnection.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        this.remoteStream = event.streams[0];

        // Set remote video element if available
        if (this.remoteVideoElement) {
          this.remoteVideoElement.srcObject = this.remoteStream;
        }

        if (this.onCallStatusChange) {
          this.onCallStatusChange("remoteStreamReceived");
        }
      };
    }

    return this.peerConnection;
  }

  // 12. Initiate a call to another user with graceful fallback
  async initiateCall(
    receiverId: string,
    appointmentId: string,
    isVideo = false
  ) {
    try {
      // 12.1. Store call details
      this.currentReceiver = receiverId;
      this.currentAppointment = appointmentId;
      this.isVideoCall = isVideo;
      this.callRejected = false;

      // 12.2. Set up media and create peer connection
      try {
        await this.setupMediaDevices(isVideo);
      } catch (err) {
        console.error("Failed to set up media devices:", err);

        // If we can't set up media at all, we can't make the call
        if (!this.localStream) {
          throw new Error("Could not access any media devices");
        }

        // If we got here, we have audio but no video
        this.isVideoCall = false;
      }

      this.createPeerConnection();

      if (this.peerConnection) {
        // 12.3. Create and set local description (offer)
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: this.isVideoCall,
        });

        await this.peerConnection.setLocalDescription(offer);

        // 12.4. Generate call ID and emit call event
        this.callId = `${appointmentId}-${Date.now()}`;

        this.socket?.emit("call", {
          appointmentId,
          receiver: receiverId,
          offer,
        });

        if (this.onCallStatusChange) {
          this.onCallStatusChange("calling", {
            receiver: receiverId,
            isVideo: this.isVideoCall,
          });
        }
      }
    } catch (error) {
      console.error("Error initiating call:", error);
      this.handleCallCleanup();
      throw error;
    }
  }

  // 13. Accept an incoming call with graceful fallback
  async acceptCall(callData: any) {
    try {
      // 13.1. Store call details
      this.callId = callData.callId;
      this.currentReceiver = callData.caller;
      this.currentAppointment = callData.appointmentId;
      this.isVideoCall = callData.offer?.sdp?.includes("m=video") || false;

      // 13.2. Set up media and create peer connection
      try {
        await this.setupMediaDevices(this.isVideoCall);
      } catch (err) {
        console.error("Failed to set up media devices:", err);

        // If we can't set up media at all, we need to reject the call
        if (!this.localStream) {
          this.rejectCall(callData);
          throw new Error("Could not access any media devices");
        }
      }

      this.createPeerConnection();

      if (this.peerConnection) {
        // 13.3. Set remote description (the offer)
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(callData.offer)
        );
        this.remoteDescSet = true;

        // 13.4. Create answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        // 13.5. Send answer to caller
        this.socket?.emit("answer", {
          callId: this.callId,
          caller: this.currentReceiver,
          appointmentId: this.currentAppointment,
          answer,
        });

        // 13.6. Process any queued ICE candidates
        this.flushCandidates();
        this.callInProgress = true;

        if (this.onCallStatusChange) {
          this.onCallStatusChange("connecting");
        }
      }
    } catch (error) {
      console.error("Error accepting call:", error);
      this.handleCallCleanup();
      throw error;
    }
  }

  // 14. Reject an incoming call
  rejectCall(callData: any) {
    if (this.socket) {
      this.socket.emit("rejectCall", {
        callId: callData.callId,
      });

      // Clear incoming call data
      this.callId = null;
      this.currentReceiver = null;
      this.currentAppointment = null;
      this.callRejected = true;

      if (this.onCallStatusChange) {
        this.onCallStatusChange("idle");
      }
    }
  }

  // 15. End an active call
  endCall() {
    // 15.1. Store current values before cleanup
    const currentCallId = this.callId;
    const currentReceiverId = this.currentReceiver;
    const currentAppointmentId = this.currentAppointment;

    // 15.2. Finalize recording if needed
    this.finalizeRecordingIfNeeded();

    // 15.3. Send end call event
    if (this.socket && currentCallId && currentReceiverId) {
      console.log("Sending end call event...");
      this.socket.emit("endCall", {
        callId: currentCallId,
        receiver: currentReceiverId,
        appointmentId: currentAppointmentId,
      });
    }

    // 15.4. Clean up resources
    this.handleCallCleanup();
    this.callInProgress = false;

    if (this.onCallStatusChange) {
      this.onCallStatusChange("ended");
    }
  }

  // 16. Clean up call resources
  handleCallCleanup() {
    // 16.1. Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // 16.2. Stop all tracks in the local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // 16.3. Clear video elements
    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }

    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
    }

    // 16.4. Reset properties
    this.callId = null;
    this.remoteDescSet = false;
    this.candidateQueue = [];
    this.remoteStream = null;
    this.callInProgress = false;
    this.recordingFinalized = false;
  }

  // 17. Process queued ICE candidates
  flushCandidates() {
    if (this.peerConnection) {
      this.candidateQueue.forEach(async (candidate) => {
        try {
          await this.peerConnection?.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate from queue:", error);
        }
      });
      this.candidateQueue = [];
    }
  }

  // 18. Toggle microphone mute state
  toggleMute(muted: boolean) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !muted;
      });
      this.micMuted = muted;
    }
  }

  // 19. Toggle camera on/off state
  toggleCamera(disabled: boolean) {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !disabled;
      });
      this.camOff = disabled;
    }
  }

  // 20. Check if recording is supported by the browser
  checkRecordingSupport() {
    const supportedType = RECORDING_MIME_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    if (!supportedType) {
      console.error("No supported video recording format found");
      return false;
    }

    console.log("Supported recording format:", supportedType);
    return supportedType;
  }

  // 21. Split array buffer into chunks for sending
  splitArrayBuffer(arrayBuffer: ArrayBuffer, chunkSize: number) {
    const chunks = [];
    for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
      chunks.push(arrayBuffer.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // 22. Start recording the call
  async startRecording() {
    if (!this.peerConnection || !this.localStream) {
      console.error("Cannot start recording without active call");
      return false;
    }

    try {
      // 22.1. Check recording support
      const supportedMimeType = this.checkRecordingSupport();
      if (!supportedMimeType) {
        console.error("No supported recording format found");
        return false;
      }

      // 22.2. Generate unique recording ID
      this.recordingId = crypto.randomUUID();
      this.chunkSequence = 0;
      this.recordedChunks = [];
      this.recordingFinalized = false;

      // 22.3. Create canvas for recording both streams
      this.canvas = document.createElement("canvas");
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.canvas.style.display = "none";
      document.body.appendChild(this.canvas);

      this.canvasContext = this.canvas.getContext("2d");

      if (!this.canvasContext) {
        throw new Error("Could not get canvas context");
      }

      // 22.4. Set up audio context for mixing
      this.audioContext = new AudioContext();
      const destination = this.audioContext.createMediaStreamDestination();

      // 22.5. Add local audio to mix
      if (this.localStream) {
        const localAudioSource = this.audioContext.createMediaStreamSource(
          this.localStream
        );
        localAudioSource.connect(destination);
        console.log("Local audio track added to mix");
      }

      // 22.6. Add remote audio to mix
      if (this.remoteStream) {
        const remoteAudioSource = this.audioContext.createMediaStreamSource(
          this.remoteStream
        );
        remoteAudioSource.connect(destination);
        console.log("Remote audio track added to mix");
      }

      // 22.7. Create canvas stream
      const canvasStream = this.canvas.captureStream(30); // 30 FPS

      // 22.8. Draw function to combine video streams
      const drawVideoFrame = () => {
        if (!this.isRecording || !this.canvasContext) return;

        this.canvasContext.clearRect(
          0,
          0,
          this.canvas!.width,
          this.canvas!.height
        );

        // Draw remote video on the left side
        if (
          this.remoteVideoElement &&
          this.remoteVideoElement.readyState >= 2
        ) {
          this.canvasContext.drawImage(
            this.remoteVideoElement,
            0,
            0,
            this.canvas!.width / 2,
            this.canvas!.height
          );
        }

        // Draw local video on the right side
        if (this.localVideoElement && this.localVideoElement.readyState >= 2) {
          this.canvasContext.drawImage(
            this.localVideoElement,
            this.canvas!.width / 2,
            0,
            this.canvas!.width / 2,
            this.canvas!.height
          );
        }

        if (this.isRecording) {
          requestAnimationFrame(drawVideoFrame);
        }
      };

      // 22.9. Combine video and audio streams
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      // 22.10. Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: supportedMimeType as string,
        audioBitsPerSecond: RECORDING_OPTIONS.audioBitsPerSecond,
        videoBitsPerSecond: this.isVideoCall
          ? RECORDING_OPTIONS.videoBitsPerSecond
          : undefined,
      });

      // 22.11. Handle data available event
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log("Recording chunk available", {
            size: event.data.size,
            type: event.data.type,
            sequence: this.chunkSequence,
          });

          this.recordedChunks.push(event.data);

          // Convert blob to array buffer for sending
          const arrayBuffer = await event.data.arrayBuffer();
          const chunkSize = 1024 * 1024; // 1MB chunks
          const chunks = this.splitArrayBuffer(arrayBuffer, chunkSize);

          // Send chunks to server
          for (const chunk of chunks) {
            this.socket?.emit("recordingChunk", {
              recordingId: this.recordingId,
              sequence: this.chunkSequence++,
              chunk: Array.from(new Uint8Array(chunk)),
              appointmentId: this.currentAppointment,
            });
          }
        }
      };

      // 22.12. Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped");

        // Create downloadable file for local use
        const blob = new Blob(this.recordedChunks, {
          type: supportedMimeType as string,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recording_${new Date().toISOString()}.webm`;
        a.click();
        URL.revokeObjectURL(url);

        // Send recordingEnded event to server if not already sent
        if (
          !this.recordingFinalized &&
          this.recordingId &&
          this.currentAppointment
        ) {
          console.log("Sending recordingEnded event to server");
          this.socket?.emit("recordingEnded", {
            recordingId: this.recordingId,
            appointmentId: this.currentAppointment,
          });
          this.recordingFinalized = true;
        }

        // Clean up recording resources
        this.cleanupRecordingResources();

        if (this.onRecordingStatusChange) {
          this.onRecordingStatusChange(false);
        }
      };

      // 22.13. Start recording with 1-second chunks
      this.mediaRecorder.start(1000);
      this.isRecording = true;

      // 22.14. Start drawing frames
      drawVideoFrame();

      // 22.15. Notify other participant
      this.socket?.emit("recordingStarted", {
        appointmentId: this.currentAppointment,
        receiver: this.currentReceiver,
      });

      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange(true);
      }

      return true;
    } catch (error) {
      console.error("Failed to start recording:", error);
      this.cleanupRecording();
      return false;
    }
  }

  // 23. Stop recording
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      console.log("Stopping recording...");

      // Stop the media recorder
      this.mediaRecorder.stop();
      this.isRecording = false;

      // Notify other participant
      this.socket?.emit("recordingStopped", {
        appointmentId: this.currentAppointment,
        receiver: this.currentReceiver,
      });
    }
  }

  // 24. Finalize recording if needed
  finalizeRecordingIfNeeded() {
    if (this.isRecording && !this.recordingFinalized) {
      console.log("Finalizing recording before call cleanup...");

      // Stop the media recorder if it's still recording
      if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
        this.mediaRecorder.stop();
      }

      // Ensure recordingEnded event is sent
      if (this.recordingId && this.currentAppointment) {
        console.log("Sending recordingEnded event to server");
        this.socket?.emit("recordingEnded", {
          recordingId: this.recordingId,
          appointmentId: this.currentAppointment,
        });
        this.recordingFinalized = true;
      }

      // Clean up recording resources
      this.cleanupRecordingResources();
      this.isRecording = false;

      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange(false);
      }
    }
  }

  // 25. Clean up recording resources
  cleanupRecordingResources() {
    // Clean up audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clean up canvas
    if (this.canvas) {
      document.body.removeChild(this.canvas);
      this.canvas = null;
      this.canvasContext = null;
    }

    // Clear media recorder
    this.mediaRecorder = null;
  }

  // 26. Clean up recording
  cleanupRecording() {
    this.finalizeRecordingIfNeeded();
    this.cleanupRecordingResources();
    this.isRecording = false;
    this.recordingFinalized = false;

    if (this.onRecordingStatusChange) {
      this.onRecordingStatusChange(false);
    }
  }

  // 27. Set callback for call status changes
  setCallStatusCallback(callback: (status: string, data?: any) => void) {
    this.onCallStatusChange = callback;
  }

  // 28. Set callback for incoming calls
  setIncomingCallCallback(callback: (data: any) => void) {
    this.onIncomingCall = callback;
  }

  // 29. Set callback for call ended
  setCallEndedCallback(callback: () => void) {
    this.onCallEnded = callback;
  }

  // 30. Set callback for recording status changes
  setRecordingStatusCallback(callback: (isRecording: boolean) => void) {
    this.onRecordingStatusChange = callback;
  }

  // 31. Check if a call is in progress
  isCallInProgress() {
    return this.callInProgress;
  }

  // 32. Check if a call was rejected
  wasCallRejected() {
    return this.callRejected;
  }

  // 33. Disconnect and clean up
  disconnect() {
    this.finalizeRecordingIfNeeded();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.handleCallCleanup();
  }
}

export const webRTCService = new WebRTCService();
