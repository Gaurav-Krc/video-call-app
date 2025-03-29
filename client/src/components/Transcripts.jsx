import { useEffect, useRef } from "react";

const Transcripts = ({ transcripts, currentUser }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  return (
    <div
      className="bg-gray-800 p-4 rounded-lg h-full overflow-y-auto 
                  scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
    >
      {transcripts.map((t, index) => (
        <div
          key={index}
          className="text-sm mb-2 animate-[fadeIn_0.3s_ease-in-out]"
        >
          <span className="font-semibold text-blue-400">{t.userId === currentUser ? 'You' : t.userName}:</span>
          <span className="text-gray-200 ml-2">{t.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default Transcripts;




