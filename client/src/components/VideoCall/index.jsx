import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "antd";
import Peer from "simple-peer";
import Controls from "./Controls";
import PeerVideo from "./PeerVideo";
import { socket } from "../../contexts/SocketContext";
import { message } from "antd";
import Transcripts from "../Transcripts";
import Chat from "../Chat";

const VideoCall = ({
  localStream,
  visible,
  setVisible,
  roomId,
  currentUser,
  isCaller,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);

  const recognitionRef = useRef(null);
  const peerRef = useRef(null);
  const remoteVideoRef = useRef();
  const localVideoRef = useRef();

  // Add chat message handler
  const handleSendMessage = useCallback(
    (message) => {
      const msgData = {
        roomId,
        text: message,
        userId: currentUser,
        timestamp: new Date().toISOString(),
      };

      // Update local state immediately
      setChatMessages((prev) => [...prev, msgData]);

      // Send to server
      socket.emit("chat-message", msgData);
    },
    [roomId, currentUser]
  );

  // Add message reception handler
  useEffect(() => {
    const handleChatMessage = (message) => {
      setChatMessages((prev) => [...prev, message]);
    };

    socket.on("chat-message", handleChatMessage);
    return () => socket.off("chat-message", handleChatMessage);
  }, []);

  useEffect(() => {
    if (visible && roomId) {
      // Join Socket.IO room
      socket.emit("join-room", roomId);

      return () => {
        // Leave room when component unmounts
        socket.emit("leave-room", roomId);
      };
    }
  }, [visible, roomId]);

  useEffect(() => {
    if (!visible || !roomId || !localStream) return;

    // Initialize speech recognition
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = "en-US";

      // Start/stop based on mic state
      const handleMicState = () => {
        if (isMuted) {
          recognition.stop();
        } else {
          recognition.start();
        }
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).slice(-1)[0][0].transcript; // Get only final results

        if (transcript.trim()) {
          // Add local transcript immediately
          setTranscripts((prev) => [
            ...prev,
            {
              text: transcript,
              userId: currentUser,
              timestamp: new Date().toISOString(),
            },
          ]);

          // Send to server
          socket.emit("transcript", {
            roomId,
            text: transcript,
            userId: currentUser,
          });
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
      };

      recognition.start();
      recognitionRef.current = recognition;

      // Cleanup on unmount
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };
    } else {
      message.warning("Speech recognition is not supported in this browser");
    }
  }, [visible, roomId, localStream, isMuted]);

  const handleTranscript = useCallback(({ text, userId, userName }) => {
    setTranscripts((prev) => [...prev, { text, userId, userName }]);
  });

  useEffect(() => {
    socket.on("transcript", handleTranscript);
    return () => {
      socket.off("transcript", handleTranscript);
    };
  }, [handleTranscript]);

  const toggleAudio = useCallback(
    (muted) => {
      setIsMuted(muted);
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      }
    },
    [localStream]
  );

  const toggleVideo = (disabled) => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = disabled;
      });
    }
  };

  const shareScreen = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
        setIsScreenSharing(false);
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Replace video track
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = peerRef.current._pc
        .getSenders()
        .find((s) => s.track.kind === "video");

      if (sender) {
        sender.replaceTrack(videoTrack);
      }

      // Handle screen sharing stop
      videoTrack.onended = () => {
        const localVideoTrack = localStream.getVideoTracks()[0];
        if (sender) {
          sender.replaceTrack(localVideoTrack);
        }
        setScreenStream(null);
        setIsScreenSharing(false);
      };

      setScreenStream(screenStream);
      setIsScreenSharing(true);
    } catch (error) {
      console.error("Screen sharing failed:", error);
    }
  });

  const endCall = useCallback(async () => {
    try {
      // Clean up peer connection properly
      if (peerRef.current) {
        if (!peerRef.current.destroyed) {
          peerRef.current.destroy();
        }
        peerRef.current = null;
      }

      // Reset states
      setRemoteStream(null);
      setScreenStream(null);
      setIsScreenSharing(false);
      setTranscripts([]);
      setChatMessages([]);

      // Notify server to end call
      socket.emit("end-call", { roomId });

      // Close the modal
      setVisible(false);

      // Additional cleanup for speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch (error) {
      console.error("Error ending call:", error);
    }
  }, [roomId, localStream, remoteStream, screenStream, setVisible]);

  const handleRemoteEndCall = useCallback(() => {
    endCall();
  }, [endCall]);

  useEffect(() => {
    socket.on("call-ended", handleRemoteEndCall);

    return () => {
      socket.off("call-ended", handleRemoteEndCall);
    };
  }, []);

  useEffect(() => {
    if (!visible || !roomId || !localStream) return;

    const peer = new Peer({
      initiator: isCaller,
      trickle: false,
      stream: localStream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          // Add TURN servers here if needed
        ],
      },
    });

    // Handle signaling data
    peer.on("signal", (data) => {
      socket.emit("webrtc-signal", {
        roomId,
        signal: data,
        sender: currentUser,
      });
    });

    // Handle remote stream
    peer.on("stream", (stream) => {
      setRemoteStream(stream);
    });

    // Handle connection errors
    peer.on("error", (err) => {
      console.error("WebRTC error:", err);
    });

    // Handle incoming signals
    const handleSignal = (data) => {
      if (data.sender !== currentUser) {
        peer.signal(data.signal);
      }
    };

    // Handle call end from remote
    const handleEndCall = () => {
      endCall();
    };

    socket.on("webrtc-signal", handleSignal);
    socket.on("end-call", handleEndCall);
    peerRef.current = peer;

    return () => {
      // Only clean up if not already handled
      if (peerRef.current && !peerRef.current.destroyed) {
        try {
          peerRef.current.destroy();
        } catch (destroyError) {
          console.warn("Peer cleanup error:", destroyError);
        }
      }

      // Clean up media streams
      [screenStream, remoteStream].forEach((stream) => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      });

      socket.off("webrtc-signal", handleSignal);
      socket.off("end-call", handleEndCall);
    };
  }, [visible, roomId, isCaller, localStream, currentUser]);

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={endCall}
      footer={null}
      width="90%"
      closable={false}
      maskClosable={false}
      className="rounded-lg border-none"
      styles={{
        body: {
          height: "75vh",
          minHeight: "500px",
          background: "#111827",
          overflow: "auto",
        },
      }}
    >
      {/* Main Content Area */}
      <div className="flex h-full flex-col md:flex-row">
        {/* Video + Controls Section */}
        <div className="flex flex-col flex-1">
          {/* Video Container */}
          <div className="relative flex-1 ">
            <div className="md:flex gap-4 p-4 h-full">
              <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden md:mb-0 mb-4">
                <PeerVideo
                  stream={screenStream || localStream}
                  isLocal={true}
                  ref={localVideoRef}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden">
                <PeerVideo
                  stream={remoteStream}
                  isLocal={false}
                  ref={remoteVideoRef}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="border-t border-gray-700 bg-gray-800 p-4">
            <Controls
              localStream={localStream}
              endCall={endCall}
              isMuted={isMuted}
              toggleAudio={toggleAudio}
              toggleVideo={toggleVideo}
              shareScreen={shareScreen}
              isScreenSharing={isScreenSharing}
            />
          </div>
        </div>

        {/* Chat & Transcription Panel */}
        <div className="md:w-96 border-t md:border-t-0 md:border-l border-gray-700 flex flex-col">
          {/* Chat */}
          <div className="p-4 border-b border-gray-700 h-2/3">
            <h3 className="text-gray-200 font-semibold mb-3">Chat</h3>
            <div className="h-[43vh] overflow-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              <Chat
                messages={chatMessages}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>

          {/* Transcription */}
          <div className="p-4 h-1/3">
            <h3 className="text-gray-200 font-semibold mb-3">Transcription</h3>
            <div className="h-[17.5vh] overflow-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              <Transcripts
                transcripts={transcripts}
                currentUser={currentUser}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default VideoCall;
