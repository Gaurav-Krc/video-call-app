
import { useState, useEffect } from 'react';

export default function useMedia() {
  const [localStream, setLocalStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setMediaError(error);
      }
    };

    if (navigator.mediaDevices) {
      initMedia();
    } else {
      setMediaError(new Error('Media devices not available'));
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { localStream, mediaError };
}




