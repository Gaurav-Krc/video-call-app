import { useState } from 'react';
import { Button } from 'antd';
import { 
  PhoneOutlined, 
  AudioOutlined, 
  AudioMutedOutlined, 
  VideoCameraOutlined,
  VideoCameraFilled,
  ShareAltOutlined,
  StopOutlined
} from '@ant-design/icons';

const Controls = ({ 
  localStream, 
  endCall,
  toggleAudio,
  toggleVideo,
  shareScreen,
  isScreenSharing
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  const handleToggleAudio = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    toggleAudio(newState);
  };

  const handleToggleVideo = () => {
    const newState = !isVideoOn;
    setIsVideoOn(newState);
    toggleVideo(newState);
  };

  return (
    <div className="flex gap-4">
      {/* Audio Control */}
      <button
        onClick={handleToggleAudio}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
      >
        {isMuted ? (
          <AudioMutedOutlined className="text-xl text-white" />
        ) : (
          <AudioOutlined className="text-xl text-white" />
        )}
      </button>

      {/* Video Control */}
      <button
        onClick={handleToggleVideo}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
      >
        {isVideoOn ? (
          <VideoCameraFilled className="text-xl text-white" />
        ) : (
          <VideoCameraOutlined className="text-xl text-white" />
        )}
      </button>

      {/* Screen Share Control */}
      <button
        onClick={shareScreen}
        className={`w-12 h-12 flex items-center justify-center rounded-full ${
          isScreenSharing ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
        } transition-colors`}
      >
        {isScreenSharing ? (
          <StopOutlined className="text-xl text-white" />
        ) : (
          <ShareAltOutlined className="text-xl text-white" />
        )}
      </button>

      {/* End Call */}
      <button
        onClick={endCall}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 transition-colors"
      >
        <PhoneOutlined className="text-xl text-white" />
      </button>
    </div>
  );
};

export default Controls;