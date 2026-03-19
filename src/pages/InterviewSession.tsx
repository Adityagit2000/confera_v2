import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mic, 
  MicOff, 
  Send,
  Loader2,
  Phone,
  ArrowLeft,
  MessageSquare,
  Settings2,
  CheckCircle,
  Clock,
  Layout,
  RefreshCcw,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/UpgradeModal';

interface Message {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const InterviewSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { isPro, canStartInterview, profile } = useSubscription();
  
  // Voice engine state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTextChatOpen, setIsTextChatOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setLiveTranscript(transcript);
        setInputMsg(transcript);

        if (autoSend && event.results[event.results.length - 1].isFinal) {
           if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
           silenceTimerRef.current = setTimeout(() => {
             handleSendVoiceMessage(transcript);
           }, 2000); 
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            setIsListening(false);
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech error:', event.error);
        if (event.error === 'network') {
          setIsListening(false);
          toast({
            title: "Microphone issue",
            description: "Speech recognition failed. Please type your answer or click mic to retry.",
          });
        } else if (event.error === 'not-allowed') {
          setIsListening(false);
          toast({
            title: "Microphone blocked",
            description: "Please allow microphone access in your browser settings.",
            variant: "destructive"
          });
        } else {
          setIsListening(false);
        }
      };
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [autoSend, isListening]);

  // Camera preview
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.warn('Camera failed:', err);
      }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Session & Auto-Start
  useEffect(() => {
    if (sessionId && user) {
      fetchInterviewData();
    }
  }, [sessionId, user]);

  const fetchInterviewData = async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);

      const parsedTranscript = typeof data.transcript === 'string' 
        ? JSON.parse(data.transcript) 
        : (data.transcript || []);

      if (parsedTranscript.length > 0) {
        setMessages(parsedTranscript as Message[]);
        setQuestionCount(parsedTranscript.filter((m: any) => m.role === 'assistant').length);
        setLoading(false);
      } else {
        // Automatically trigger opening question
        startInterviewFlow(data);
      }
      
    } catch (error: any) {
      console.error('Error fetching interview:', error);
      setErrorStatus("Failed to load interview session.");
      setLoading(false);
    }
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => { 
        setIsSpeaking(true); 
        if (recognitionRef.current) recognitionRef.current.stop(); 
    };
    utterance.onend = () => { 
        setIsSpeaking(false); 
        if (isListening && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch(e) {}
        }
    };
    window.speechSynthesis.speak(utterance);
  };

  const startInterviewFlow = async (sessionData: any) => {
    if (!canStartInterview) {
      setShowUpgradeModal(true);
      setLoading(false);
      return;
    }
    
    setIsThinking(true);
    setErrorStatus(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-interview-chat', {
        body: { 
          sessionId, 
          message: "", // Empty message triggers AI start greeting
          interviewType: sessionData?.type || 'hr'
        }
      });
      
      if (error) throw error;
      
      const aiMessage = data.response;
      const initialMsgs = [{ role: 'assistant', content: aiMessage } as Message];
      setMessages(initialMsgs);
      setQuestionCount(1);
      speak(aiMessage);
    } catch (err: any) {
      console.error('Start interview error:', err);
      setErrorStatus("AI interviewer is unavailable right now. Please try again.");
    } finally {
      setIsThinking(false);
      setLoading(false);
    }
  };

  const handleSendVoiceMessage = async (transcript: string) => {
    if (!transcript.trim() || isThinking || isSpeaking) return;
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    const userMsg = transcript.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLiveTranscript('');
    setInputMsg('');
    setIsThinking(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-interview-chat', {
        body: { 
          sessionId, 
          message: userMsg,
          interviewType: session?.type || 'hr'
        }
      });
      
      if (error) throw error;
      
      const aiMessage = data.response;
      setMessages(prev => [...prev, { role: 'assistant', content: aiMessage } as Message]);
      setQuestionCount(prev => prev + 1);
      speak(aiMessage);
      
      if (data.is_complete) {
        setTimeout(endInterview, 5000);
      }
    } catch (err) {
       toast({ title: "AI Error", description: "Failed to get response. Feel free to try again.", variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMsg.trim()) {
      handleSendVoiceMessage(inputMsg);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn('Recognition start failed:', e);
      }
    }
  };

  const endInterview = async () => {
    window.speechSynthesis.cancel();
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setShowCompletion(true);
    
    try {
      await supabase.functions.invoke('generate-feedback', { body: { sessionId } });
    } catch (error) {}
    
    setTimeout(() => { navigate(`/report/${sessionId}`); }, 3000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-6" /> 
        <h2 className="text-xl font-medium tracking-wide">Prepping Interview Room...</h2>
      </div>
    );
  }

  if (errorStatus) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white p-6">
        <AlertCircle className="w-16 h-16 text-destructive mb-6" />
        <h2 className="text-2xl font-bold mb-4">{errorStatus}</h2>
        <Button onClick={() => window.location.reload()} className="bg-primary hover:bg-primary/80 px-8 py-6 rounded-2xl font-bold">
           <RefreshCcw className="w-5 h-5 mr-3" /> Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      
      <header className="p-6 flex items-center justify-between z-10 w-full relative">
        <div className="flex items-center gap-6">
          <BackButton />
          <div className="flex flex-col ml-12">
            <h1 className="text-lg font-bold tracking-tight capitalize">{session?.type?.replace('_', ' ')} Interview</h1>
            <div className="flex items-center gap-2 text-xs text-white/50 font-medium">
               <Clock className="w-3 h-3" /> {formatTime(elapsedTime)}
               <span className="mx-1 opacity-20">•</span>
               <Layout className="w-3 h-3" /> Question {questionCount} / 6+
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <span className="text-xs font-semibold text-white/60">Auto-send</span>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
           </div>
           <Button variant="ghost" onClick={() => setIsTextChatOpen(!isTextChatOpen)} className={`rounded-xl px-4 h-10 ${isTextChatOpen ? 'bg-primary/20 text-primary' : 'bg-white/5'}`}>
              <MessageSquare className="w-4 h-4 mr-2" /> {isTextChatOpen ? 'Hide History' : 'View History'}
           </Button>
        </div>
      </header>
      
      <div className="px-6 relative z-10">
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-primary to-secondary" initial={{ width: 0 }} animate={{ width: `${Math.min((questionCount / 6) * 100, 100)}%` }} />
        </div>
      </div>

      <main className="flex-1 flex p-6 gap-6 relative z-10 overflow-hidden">
        <div className={`flex-1 flex flex-col gap-6 transition-all duration-500 ${isTextChatOpen ? 'md:w-2/3' : 'w-full'}`}>
          <div className="flex-1 relative bg-white/[0.02] rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center overflow-hidden backdrop-blur-sm">
            
            <div className="relative flex flex-col items-center justify-center">
              <AnimatePresence>
                {isSpeaking && (
                  <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: [1, 1.3, 1] }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 2, repeat: Infinity }} className="absolute w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
                )}
              </AnimatePresence>
              
              <motion.div className={`w-48 h-48 rounded-full flex items-center justify-center text-7xl z-10 border-2 ${isSpeaking ? 'bg-primary/10 border-primary shadow-[0_0_50px_rgba(0,212,255,0.3)]' : isThinking ? 'bg-white/5 border-secondary animate-pulse' : 'bg-white/5 border-white/10'}`}>
                 {isThinking ? <Loader2 className="w-16 h-16 animate-spin text-secondary" /> : "🤖"}
              </motion.div>
              
              <div className="mt-8 text-center space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">AI Interviewer</h2>
                <div className="flex items-center gap-2 justify-center">
                   <div className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-primary animate-pulse' : isThinking ? 'bg-secondary animate-pulse' : 'bg-success'}`} />
                   <p className="text-sm font-medium text-white/40 tracking-wider uppercase">{isSpeaking ? 'Speaking' : isThinking ? 'Analyzing' : 'Listening'}</p>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {liveTranscript && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-12 left-6 right-6 flex justify-center z-20">
                  <p className="bg-white/5 text-white/90 px-8 py-5 rounded-[2rem] text-xl backdrop-blur-3xl border border-white/10 shadow-2xl max-w-2xl text-center leading-relaxed font-medium">{liveTranscript}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute top-8 right-8 w-40 h-52 bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl z-20">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-white/80">Candidate</p>
              </div>
            </div>
          </div>
          
          <div className="h-24 flex items-center justify-between px-8 bg-white/[0.03] border border-white/10 rounded-[2rem] backdrop-blur-md">
             <div className="flex-1 hidden md:block">
                <p className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Voice & Text Fallback Active</p>
             </div>

             <div className="flex items-center gap-8">
               <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={toggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-destructive' : 'bg-white/10'}`}>
                 {isListening ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7 text-white/50" />}
                 {isListening && (
                    <motion.div className="absolute inset-0 rounded-full border-2 border-destructive" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
                 )}
               </motion.button>

               <Button onClick={endInterview} className="h-16 px-8 rounded-2xl bg-white text-black font-bold">
                  <Phone className="w-5 h-5 mr-3 rotate-[135deg]" /> End Interview
               </Button>
             </div>

             <div className="flex-1 flex justify-end">
                <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full text-white/30 hover:text-white">
                   <Settings2 className="w-5 h-5" />
                </Button>
             </div>
          </div>
        </div>

        <AnimatePresence>
          {isTextChatOpen && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: '380px', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="bg-white/5 rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden backdrop-blur-xl">
              <div className="p-6 border-b border-white/5">
                <h3 className="font-bold tracking-tight">Conversation History</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase mb-2">
                       {msg.role === 'user' ? 'You' : 'Confera AI'}
                    </span>
                    <div className={`px-5 py-3.5 rounded-2xl max-w-[90%] text-sm ${msg.role === 'user' ? 'bg-primary' : 'bg-white/5'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-6 border-t border-white/5">
                <form onSubmit={handleManualSend} className="flex gap-2">
                  <input className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white" placeholder="Type your answer..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} />
                  <Button type="submit" size="icon" className="rounded-xl h-10 w-10">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                <p className="text-[10px] text-white/40 mt-3 text-center">Text input always available as fallback</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showCompletion && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center mb-12">
              <CheckCircle className="w-12 h-12 text-success" />
            </motion.div>
            <h2 className="text-5xl font-black mb-4 tracking-tighter">Interview Complete</h2>
            <p className="text-white/50 text-xl font-medium mb-12 max-w-md text-center">Finalizing insights and generating your report...</p>
            <div className="flex items-center gap-3 text-primary font-bold">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Analyzing Responses</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        description="You've used all your free interviews this month. Upgrade to Pro for unlimited access."
      />
    </div>
  );
};

export default InterviewSession;