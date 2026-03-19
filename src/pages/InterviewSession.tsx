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
  AlertCircle,
  User,
  Volume2
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
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTextChatOpen, setIsTextChatOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shouldContinueListening = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        console.log('Speech recognition started');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setLiveTranscript(interimTranscript || finalTranscript);
        if (finalTranscript) {
          setInputMsg(prev => prev + finalTranscript);
          
          if (autoSend) {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              handleSendVoiceMessage(inputMsg + finalTranscript);
            }, 2000);
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (shouldContinueListening.current) {
          try {
            recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
            shouldContinueListening.current = false;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        // Stop the loop on specific errors
        if (event.error === 'network' || event.error === 'not-allowed') {
          shouldContinueListening.current = false;
          setIsListening(false);
          
          if (event.error === 'network') {
             setVoiceAvailable(false);
             toast({ 
               title: "Voice Unavailable", 
               description: "Network issues detected. Please type your answers.",
               variant: "destructive"
             });
          } else {
             toast({ 
               title: "Microphone Blocked", 
               description: "Please allow microphone access or type your answers.",
               variant: "destructive"
             });
          }
          
          // Auto focus text input
          setTimeout(() => textInputRef.current?.focus(), 100);
          return;
        }

        if (event.error === 'no-speech') return;
        
        setIsListening(false);
        toast({
          title: "Microphone issue",
          description: "Speech recognition error. Please try typing.",
          variant: "destructive"
        });
      };

      recognitionRef.current = recognition;
    }

    return () => {
      shouldContinueListening.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [autoSend, toast]);

  // Camera preview
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false // audio handled separately
        });
        
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraAvailable(true);
        }
      } catch (err) {
        console.warn('Camera failed:', err);
        setCameraAvailable(false);
      }
    };

    startCamera();
    
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Auto-scroll chat history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const toggleMic = async () => {
    if (isListening) {
      shouldContinueListening.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        // Explicitly request microphone access first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsListening(true);
        shouldContinueListening.current = true;
        recognitionRef.current?.start();
      } catch (e: any) {
        console.error('Microphone access denied:', e);
        toast({
          title: "Microphone access denied",
          description: "Microphone access denied by browser.",
          variant: "destructive"
        });
        setIsListening(false);
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
        <div className="flex items-center gap-4">
          <BackButton />
          <div className="flex flex-col">
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
              
              <motion.div 
                className={`w-48 h-48 rounded-full flex flex-col items-center justify-center z-10 border-4 transition-all duration-500 ${
                  isSpeaking 
                    ? 'bg-primary/20 border-primary shadow-[0_0_80px_rgba(0,212,255,0.4)]' 
                    : isThinking 
                      ? 'bg-white/10 border-secondary animate-pulse' 
                      : 'bg-white/5 border-white/10'
                }`}
              >
                  {isThinking ? (
                    <div className="relative">
                      <Loader2 className="w-16 h-16 animate-spin text-secondary" />
                      <div className="absolute inset-0 w-16 h-16 border-4 border-secondary/20 rounded-full animate-ping" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className={`text-4xl font-black mb-2 px-6 py-2 rounded-2xl ${isSpeaking ? 'bg-primary text-black' : 'bg-white/10 text-white'}`}>AI</div>
                      {isSpeaking && <Volume2 className="w-6 h-6 text-primary animate-bounce mt-2" />}
                    </div>
                  )}
              </motion.div>
              
              <div className="mt-8 text-center space-y-2">
                <h2 className="text-2xl font-black tracking-tighter uppercase italic opacity-80 italic">AI Interviewer</h2>
                <div className="flex items-center gap-3 justify-center">
                   <div className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? 'bg-primary animate-pulse' : isThinking ? 'bg-secondary animate-pulse' : 'bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`} />
                   <p className="text-xs font-bold text-white/40 tracking-[0.3em] uppercase">{isSpeaking ? 'Speaking' : isThinking ? 'Thinking' : 'Ready'}</p>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {liveTranscript && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-24 left-6 right-6 flex justify-center z-20">
                  <p className="bg-white/10 text-white/90 px-8 py-4 rounded-2xl text-lg backdrop-blur-3xl border border-white/10 shadow-2xl max-w-2xl text-center leading-relaxed font-medium">{liveTranscript}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!voiceAvailable && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="absolute top-8 left-1/2 -translate-x-1/2 z-30 bg-destructive/20 border border-destructive/30 px-6 py-2 rounded-full backdrop-blur-xl">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-white shadow-sm flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> Voice Unavailable on this network • Please type your answer
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute top-8 right-8 w-44 h-56 bg-black rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl z-20 group/candidate">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                className={`scale-x-[-1] transition-opacity duration-500 ${cameraAvailable ? 'opacity-100' : 'opacity-0'}`} 
              />
              
              {!cameraAvailable && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]">
                    <span className="text-3xl font-black text-primary uppercase tracking-tighter">
                      {profile?.name?.substring(0, 2) || user?.email?.substring(0, 2) || 'C'}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                <div className="flex flex-col">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-white/90">Candidate</p>
                  <p className="text-[8px] font-bold text-primary/80 uppercase">
                    {cameraAvailable ? 'Live Feed' : 'Camera Off'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="h-24 flex items-center justify-between px-8 bg-white/[0.03] border border-white/10 rounded-[2.5rem] backdrop-blur-md">
               <div className="flex-1 hidden lg:block">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Audio Engine</p>
                    <p className="text-[10px] font-bold text-primary/50 uppercase">Neural Voice Fallback Active</p>
                  </div>
               </div>

               <div className="flex items-center gap-6">
                 <div className="relative group">
                   <motion.button 
                    whileHover={voiceAvailable ? { scale: 1.1 } : {}} 
                    whileTap={voiceAvailable ? { scale: 0.9 } : {}} 
                    onClick={voiceAvailable ? toggleMic : undefined} 
                    className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${
                      isListening 
                        ? 'bg-destructive shadow-destructive/20 border-4 border-destructive/20' 
                        : voiceAvailable 
                          ? 'bg-white/10 hover:bg-white/20 border-2 border-white/5'
                          : 'bg-white/5 opacity-30 cursor-not-allowed border-none'
                    }`}
                    title={!voiceAvailable ? "Voice recognition unavailable" : ""}
                   >
                     {isListening ? <Mic className="w-8 h-8 text-white" /> : <MicOff className="w-8 h-8 text-white/40" />}
                     <span className={`text-[8px] font-black mt-1 uppercase tracking-tighter ${isListening ? 'text-white' : 'text-white/20'}`}>
                        {isListening ? 'Listening' : voiceAvailable ? 'Voice' : 'Off'}
                     </span>
                     {isListening && (
                        <motion.div className="absolute inset-0 rounded-full border-4 border-destructive" animate={{ scale: [1, 1.4], opacity: [0.6, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />
                     )}
                   </motion.button>
                 </div>

                 <Button onClick={endInterview} className="h-16 px-10 rounded-[2rem] bg-white text-black hover:bg-white/90 font-black uppercase tracking-tighter shadow-xl">
                    <Phone className="w-5 h-5 mr-3 rotate-[135deg] fill-current" /> End Session
                 </Button>
               </div>

               <div className="flex-1 flex justify-end">
                  <Button variant="ghost" size="icon" className="w-14 h-14 rounded-full text-white/20 hover:text-white hover:bg-white/5 transition-all">
                     <Settings2 className="w-6 h-6" />
                  </Button>
               </div>
            </div>

            {/* Primary text input */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-5 flex gap-4 items-center shadow-lg group focus-within:border-primary/40 transition-all">
              <div className="flex-1 relative">
                <input 
                  ref={textInputRef}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-base text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                  placeholder={voiceAvailable ? "Speak to the AI or type your comprehensive response here..." : "Voice unavailable — please type your response here..."}
                  value={inputMsg} 
                  onChange={(e) => setInputMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSend(e as any)}
                />
              </div>
              <Button onClick={(e) => handleManualSend(e as any)} size="lg" className="h-16 px-8 rounded-2xl bg-primary hover:bg-primary-glow shadow-glow transition-all font-black uppercase tracking-tighter">
                <Send className="w-6 h-6 mr-3" /> Send
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
              
              <div className="flex-1 overflow-y-auto max-h-[calc(100vh-250px)] p-6 space-y-6">
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