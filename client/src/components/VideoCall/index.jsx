import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "antd";
import Peer from "simple-peer";
import Controls from "./Controls";
import PeerVideo from "./PeerVideo";
import { socket } from "../../contexts/SocketContext";
import { message } from "antd";
import Transcripts from "../Transcripts";

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
  const recognitionRef = useRef(null);
  const peerRef = useRef(null);
  const remoteVideoRef = useRef();
  const localVideoRef = useRef();


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

  // Screen sharing
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
  
      // Clean up media streams
      // [localStream, remoteStream, screenStream].forEach(stream => {
      //   if (stream) {
      //     stream.getTracks().forEach(track => {
      //       track.stop();          // Stop each track
      //       track.enabled = false; // Disable track
      //     });
      //   }
      // });
  
      // Reset states
      setRemoteStream(null);
      setScreenStream(null);
      setIsScreenSharing(false);
      setTranscripts([]);

  
      // Notify server to end call
      socket.emit('end-call', { roomId });
  
      // Close the modal
      setVisible(false);
  
      // Additional cleanup for speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
  
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [roomId, localStream, remoteStream, screenStream, setVisible]);

  // Handle remote call ending
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
          console.warn('Peer cleanup error:', destroyError);
        }
      }
      
      // Clean up media streams
      [screenStream, remoteStream].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });
  
      socket.off('webrtc-signal', handleSignal);
      socket.off('end-call', handleEndCall);
    };
  }, [visible, roomId, isCaller, localStream, currentUser]);

  return (
    <Modal
      title={`Video Call - Room ID: ${roomId}`}
      open={visible}
      onCancel={endCall}
      footer={null}
      width="80%"
      closable={false}
      maskClosable={false}
      className="rounded-lg overflow-hidden"
      styles={{
        padding: "0",
        height: "70vh",
        minHeight: "400px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="flex flex-col h-full">
        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2 flex-1 min-h-0">
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden h-full">
            <PeerVideo
              stream={screenStream || localStream}
              isLocal={true}
              ref={localVideoRef}
            />
          </div>

          {/* Remote Video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden h-full">
            <PeerVideo
              stream={remoteStream}
              isLocal={false}
              ref={remoteVideoRef}
            />
          </div>
        </div>

        {/* Transcripts panel */}
        <div className="px-4 mb-4">
          <Transcripts transcripts={transcripts} currentUser={currentUser} />
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 p-4 bg-gray-800">
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
    </Modal>
  );
};

export default VideoCall;
