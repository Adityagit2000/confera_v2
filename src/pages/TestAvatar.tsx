import { AvatarScene } from '@/components/Avatar3D/AvatarScene';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function TestAvatar() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const text = "Hello! I am your AI interviewer. I look much more realistic now, don't I?";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-8">
      <div className="w-[600px] h-[600px] border border-white/10 rounded-3xl overflow-hidden bg-slate-900 shadow-2xl relative">
        <AvatarScene
          isSpeaking={isSpeaking}
          isListening={isListening}
          isThinking={isThinking}
          currentText={isSpeaking ? text : ""}
        />
      </div>

      <div className="mt-8 flex gap-4">
        <Button 
          onClick={() => setIsSpeaking(!isSpeaking)}
          variant={isSpeaking ? "default" : "outline"}
        >
          {isSpeaking ? "Stop Speaking" : "Start Speaking"}
        </Button>
        <Button 
          onClick={() => setIsListening(!isListening)}
          variant={isListening ? "default" : "outline"}
        >
          {isListening ? "Stop Listening" : "Start Listening"}
        </Button>
        <Button 
          onClick={() => setIsThinking(!isThinking)}
          variant={isThinking ? "default" : "outline"}
        >
          {isThinking ? "Stop Thinking" : "Start Thinking"}
        </Button>
      </div>
      
      {isSpeaking && (
        <p className="mt-4 text-white/70 italic text-center max-w-md">
          "{text}"
        </p>
      )}
    </div>
  );
}
