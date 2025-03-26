
import { forwardRef, useEffect } from 'react';

const PeerVideo = forwardRef(({ stream, isLocal }, ref) => {
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;

      const playVideo = async () => {
        try {
          await ref.current.play();
        } catch (error) {
          console.error('Error playing video:', error);
        }
      };

      ref.current.onloadedmetadata = playVideo;
    }
  }, [stream, ref]);

  return ( 
    <div className="relative w-full h-full aspect-video">
      <video
        ref={ref}
        autoPlay
        muted={isLocal}
        playsInline
        className="absolute inset-0 w-full h-full object-cover bg-black"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
        {isLocal ? 'You' : 'Remote User'}
      </div>
    </div>
  );
});

export default PeerVideo;