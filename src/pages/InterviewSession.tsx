import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceSynthesis } from '@/hooks/useVoiceSynthesis';
import { useTurnDetection, type TurnState } from '@/hooks/useTurnDetection';
import { PreFlightCheck } from '@/components/PreFlightCheck';
import { closeAudioContext, type DiagnosticReport } from '@/lib/voiceDiagnostics';
import { useOnlineStatus, acquireInterviewLock, releaseInterviewLock } from '@/lib/networkUtils';
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
  Volume2,
  WifiOff,
  RotateCcw
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
  const { isOnline, wasOffline } = useOnlineStatus();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Pre-flight check state
  const [preFlightComplete, setPreFlightComplete] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { isPro, canStartInterview, profile } = useSubscription();
  
  // Voice engine state
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [hasFinalResult, setHasFinalResult] = useState(false);
  const [lastFinalText, setLastFinalText] = useState('');
  const speakingStartRef = useRef<number | null>(null);
  const [speakingStart, setSpeakingStart] = useState<number | null>(null);
  const [gotItFlash, setGotItFlash] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTextChatOpen, setIsTextChatOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [answeredQuestionsCount, setAnsweredQuestionsCount] = useState(0);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(localStorage.getItem('confera_voice') || '');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const candidateVideoRef = useRef<HTMLVideoElement>(null);
  const shouldContinueListeningRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  
  const voiceSynth = useVoiceSynthesis();

  const voiceInput = useVoiceInput({
    onTranscript: (text, isFinal) => {
      if (!isFinal) {
        setLiveTranscript(text);
        return;
      }

      // Track speaking start time
      if (!speakingStartRef.current) {
        speakingStartRef.current = Date.now();
        setSpeakingStart(Date.now());
      }

      // Accumulate final transcripts
      setFinalTranscript(prev => prev + text + ' ');
      setLiveTranscript('');
      setHasFinalResult(true);
      setLastFinalText(text);
    },
    onError: (error) => {
      toast({ title: "Microphone issue", description: error, variant: "destructive" });
    },
  });

  const isListening = voiceInput.isListening;
  const isSpeaking = voiceSynth.isSpeaking;
  const voiceAvailable = voiceInput.mode !== 'text-only';

  // ── Intelligent Turn Detection ──────────────────────────────────────────
  const wordCount = (finalTranscript + ' ' + liveTranscript).trim().split(/\s+/).filter(Boolean).length;

  const turnDetection = useTurnDetection({
    isListening,
    wordCount,
    hasFinalResult,
    lastFinalTranscript: lastFinalText,
    audioEnergyBelowThreshold: voiceInput.audioEnergy < 0.02,
    isSpeechDetected: voiceInput.isSpeechDetected,
    speakingStartTimestamp: speakingStart,
  });

  // When turn detection says the answer is complete, auto-submit
  useEffect(() => {
    if (turnDetection.turnState === 'complete' && autoSend) {
      const fullAnswer = (finalTranscript + liveTranscript).trim();
      if (fullAnswer.length > 10) {
        // Show brief "Got it" flash
        setGotItFlash(true);
        setTimeout(() => {
          setGotItFlash(false);
          handleSendVoiceMessage(fullAnswer);
          setFinalTranscript('');
          setLiveTranscript('');
          setHasFinalResult(false);
          setLastFinalText('');
          speakingStartRef.current = null;
          setSpeakingStart(null);
          turnDetection.reset();
        }, 600);
      } else {
        // Answer too short — keep listening
        turnDetection.reset();
      }
    }
  }, [turnDetection.turnState]);

  // Voice engine initialization — handled by useVoiceSynthesis hook
  // Just need to manage user's voice preference
  const availableVoices = voiceSynth.getVoices();

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    localStorage.setItem('confera_voice', voiceName);
  };

  // Pre-flight check handlers
  const handlePreFlightComplete = useCallback((report: DiagnosticReport) => {
    setDiagnosticReport(report);
    setPreFlightComplete(true);
  }, []);

  const handlePreFlightSkip = useCallback(() => {
    setPreFlightComplete(true);
  }, []);

  // Check for first-time user onboarding
  useEffect(() => {
    const isFirstTime = !localStorage.getItem('confera_onboarded');
    if (isFirstTime && !loading && messages.length > 0) {
      setOnboardingStep(1);
    }
  }, [loading, messages.length]);


  const completeStep = (step: number) => {
    if (onboardingStep === step) {
      if (step === 3) {
        localStorage.setItem('confera_onboarded', 'true');
        setOnboardingStep(0);
      } else {
        setOnboardingStep(step + 1);
      }
    }
  };


  useEffect(() => {
    const handleBeforeUnload = () => {
      voiceSynth.cancel();
      voiceInput.cleanup();
      closeAudioContext();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      voiceSynth.cancel();
      voiceInput.cleanup();
      closeAudioContext();
    };
  }, []);

  useEffect(() => {
    return () => {
      // On unmount, if session is still active, mark as completed
      if (sessionId && user?.id) {
        supabase
          .from('interview_sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId)
          .eq('status', 'active');
      }
    }
  }, [sessionId, user?.id])

  // Camera preview initialization logic
  useEffect(() => {
    let stream: MediaStream;
    
    const initCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false
        });
        
        // Small delay to ensure video element is mounted
        setTimeout(() => {
          if (candidateVideoRef.current) {
            candidateVideoRef.current.srcObject = stream;
            candidateVideoRef.current.play().catch(console.error);
            setCameraAvailable(true);
          }
        }, 500);
        
      } catch (err) {
        if (import.meta.env.DEV) console.log('Camera error:', err);
        setCameraAvailable(false);
      }
    };
    
    initCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // empty dependency array - runs once on mount

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
    if (sessionId && user?.id) {
      fetchInterviewData();
    }
  }, [sessionId]); // Follow user instruction for single dependency as much as possible, using user?.id for stability

  const fetchInterviewData = useCallback(async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (data && data.user_id !== user.id) {
        toast({ title: "Unauthorized", description: "You don't have access to this session.", variant: "destructive" });
        navigate('/dashboard');
        return;
      }

      setSession(data);

      let parsedTranscript = [];
      try {
        parsedTranscript = typeof data.transcript === 'string' 
          ? JSON.parse(data.transcript) 
          : (data.transcript || []);
      } catch (e) {
        if (import.meta.env.DEV) console.error("Error parsing transcript:", e);
        parsedTranscript = [];
      }

      if (parsedTranscript.length > 0) {
        setMessages(parsedTranscript as Message[]);
        setQuestionCount(parsedTranscript.filter((m: any) => m.role === 'assistant').length);
        setLoading(false);
      } else {
        // Automatically trigger opening question
        startInterviewFlow(data);
      }
      
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error fetching interview:', error);
      setErrorStatus("Failed to load interview session.");
      setLoading(false);
    }
  }, [sessionId, supabase]);

  // Consolidated speak function — delegates to the production-grade voiceSynth hook
  // which handles Chrome 15s chunking, async voice loading, iOS audio unlock, and retry
  const speak = useCallback((text: string) => {
    voiceSynth.speak(
      text,
      selectedVoiceName || undefined,
      // onStart
      () => {
        setIsAiSpeaking(true);
        shouldContinueListeningRef.current = false;
        voiceInput.stopListening();
      },
      // onEnd
      () => {
        setIsAiSpeaking(false);
        if (shouldContinueListeningRef.current) {
          voiceInput.startListening();
        }
      }
    );
  }, [selectedVoiceName, voiceInput, voiceSynth]);

  const startInterviewFlow = useCallback(async (sessionData: any) => {
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
  }, [canStartInterview, sessionId, speak]);

  const handleSendVoiceMessage = useCallback(async (transcript: string) => {
    if (!transcript.trim() || isThinking || isSpeaking || isSubmittingRef.current) return;
    
    const userMsg = transcript.trim();
    isSubmittingRef.current = true;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLiveTranscript('');
    setInputMsg('');
    setIsThinking(true);
    
    try {
      setLastFailedMessage(null);
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
      setAnsweredQuestionsCount(prev => prev + 1);
      speak(aiMessage);
      
      if (data.is_complete) {
        setTimeout(endInterview, 5000);
      }
    } catch (err) {
       setLastFailedMessage(userMsg);
       // Remove the failed user message from chat to avoid confusion
       setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'user' && m.content === userMsg)));
       toast({ 
         title: "AI Error", 
         description: "Failed to get response. Tap 'Retry' to try again.", 
         variant: "destructive" 
       });
    } finally {
      setIsThinking(false);
      isSubmittingRef.current = false;
    }
  }, [isThinking, isSpeaking, sessionId, session?.type, speak, toast]);

  // Retry handler for failed messages
  const retryLastMessage = useCallback(() => {
    if (lastFailedMessage) {
      handleSendVoiceMessage(lastFailedMessage);
    }
  }, [lastFailedMessage, handleSendVoiceMessage]);

  const handleManualSend = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputMsg.trim()) {
      handleSendVoiceMessage(inputMsg);
    }
  }, [inputMsg, handleSendVoiceMessage]);

  const toggleMic = useCallback(async () => {
    if (voiceInput.isListening) {
      shouldContinueListeningRef.current = false;
      voiceInput.stopListening();
    } else {
      shouldContinueListeningRef.current = true;
      const started = await voiceInput.startListening();
      if (!started) {
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access in your browser settings.",
          variant: "destructive"
        });
      }
    }
  }, [voiceInput, toast]);

  const endInterview = useCallback(async () => {
    if (answeredQuestionsCount === 0) {
      toast({
        title: "No answers recorded",
        description: "Please answer at least one question before ending the interview.",
        variant: "destructive"
      });
      return;
    }

    if (answeredQuestionsCount < 3) {
      const confirmed = window.confirm(
        `You've only answered ${answeredQuestionsCount} question(s). The report will be based on limited data. Continue anyway?`
      );
      if (!confirmed) return;
    }

    voiceSynth.cancel();
    voiceInput.stopListening();
    closeAudioContext();
    setShowCompletion(true);
    
    try {
      await supabase.functions.invoke('generate-feedback', { body: { sessionId } });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error generating feedback:', error);
    }
    
    let attempts = 0
    const maxAttempts = 15
    const poll = async () => {
      attempts++
      const { data, error } = await supabase
        .from('feedback_reports')
        .select('id')
        .eq('session_id', sessionId)
        .single()
      if (data && !error) {
        navigate(`/report/${sessionId}`)
        return
      }
      if (attempts >= maxAttempts) {
        setShowCompletion(false)
        toast({ title: "Report is taking longer than expected", description: "Check your dashboard in a few minutes.", variant: "destructive" })
        navigate('/dashboard')
        return
      }
      setTimeout(poll, 2000)
    }
    setTimeout(poll, 2000)
  }, [answeredQuestionsCount, sessionId, navigate, toast]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  // Show pre-flight check before interview room
  if (!preFlightComplete) {
    return (
      <PreFlightCheck
        onComplete={handlePreFlightComplete}
        onSkip={handlePreFlightSkip}
      />
    );
  }

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
      
      <header className="p-4 sm:p-6 flex items-center justify-between z-50 w-full relative">
        <div className="flex items-center gap-2 sm:gap-4">
          <BackButton />
          <div className="flex flex-col">
            <h1 className="text-sm sm:text-lg font-bold tracking-tight capitalize truncate max-w-[120px] sm:max-w-none">{session?.type?.replace('_', ' ')} Interview</h1>
            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-white/50 font-medium">
               <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {formatTime(elapsedTime)}
               <span className="mx-0.5 sm:mx-1 opacity-20">•</span>
               <Layout className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Q{questionCount}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
           {/* Voice Selection */}
           <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur-md">
              <Volume2 className="w-4 h-4 text-primary/70" />
              <Select value={selectedVoiceName} onValueChange={handleVoiceChange}>
                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-white/5 text-[10px] font-bold uppercase tracking-wider min-w-[140px] focus:ring-0">
                  <SelectValue placeholder="Select Voice" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name} className="text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10 transition-colors">
                      {voice.name.replace('Google ', '').replace('US English ', '').replace('Microsoft ', '')}
                    </SelectItem>
                  ))}
                  {availableVoices.length === 0 && (
                    <div className="p-2 text-[10px] text-white/40">No premium voices found</div>
                  )}
                </SelectContent>
              </Select>
           </div>

           <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 rounded-xl border transition-all ${onboardingStep === 2 ? 'border-primary ring-4 ring-primary/20 bg-primary/10 scale-105 z-50' : 'border-white/10'}`}>
              <span className="text-[10px] sm:text-xs font-semibold text-white/60">Auto-send</span>
              <Switch checked={autoSend} onCheckedChange={(val) => {
                setAutoSend(val);
                completeStep(2);
              }} />
              {onboardingStep === 2 && (
                <div className="absolute top-full mt-4 right-0 w-48 p-4 bg-primary text-black rounded-2xl shadow-2xl z-[60] text-xs font-bold animate-in fade-in slide-in-from-top-2">
                  <div className="absolute -top-2 right-6 w-4 h-4 bg-primary rotate-45" />
                  Enable Auto-send for a seamless, hands-free conversation.
                  <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-[10px] hover:bg-black/10 font-black p-0 border-none" onClick={() => completeStep(2)}>GOT IT</Button>
                </div>
              )}
           </div>
           <div className="relative">
             <Button 
              variant="ghost" 
              onClick={() => {
                setIsTextChatOpen(!isTextChatOpen);
                completeStep(3);
              }} 
              className={`rounded-xl px-2 sm:px-4 h-9 sm:h-10 transition-all ${isTextChatOpen ? 'bg-primary/20 text-primary' : 'bg-white/5'} ${onboardingStep === 3 ? 'border-primary ring-4 ring-primary/20 bg-primary/10 scale-105 z-50' : ''}`}
             >
                <MessageSquare className="w-4 h-4 sm:mr-2" /> 
                <span className="hidden sm:inline">{isTextChatOpen ? 'Hide History' : 'View History'}</span>
             </Button>
             {onboardingStep === 3 && (
                <div className="absolute top-full mt-4 right-0 w-48 p-4 bg-primary text-black rounded-2xl shadow-2xl z-[60] text-xs font-bold animate-in fade-in slide-in-from-top-2">
                  <div className="absolute -top-2 right-12 w-4 h-4 bg-primary rotate-45" />
                  Need to review? Check your past responses here.
                  <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-[10px] hover:bg-black/10 font-black p-0 border-none" onClick={() => completeStep(3)}>FINISH GUIDE</Button>
                </div>
              )}
           </div>
        </div>
      </header>
      {voiceInput.isIOS && (
        <div className="mx-6 mt-2 px-4 py-3 rounded-xl bg-blue-500/10 
        border border-blue-500/30 text-blue-400 text-sm font-medium">
          Using Whisper AI transcription for iOS — tap the microphone to start, speak naturally, and tap again when done.
        </div>
      )}
      
      <div className="px-6 relative z-10">
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-primary to-secondary" initial={{ width: 0 }} animate={{ width: `${Math.min((questionCount / 6) * 100, 100)}%` }} />
        </div>
      </div>

      <main className="flex-1 flex flex-col md:flex-row p-3 sm:p-6 gap-3 sm:gap-6 relative z-10 overflow-hidden">
        <div className={`flex-1 flex flex-col gap-6 transition-all duration-500 ${isTextChatOpen ? 'md:w-2/3' : 'w-full'}`}>
          <div className="flex-1 relative bg-white/[0.02] rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center overflow-hidden backdrop-blur-sm">
            
            {/* Camera Off Panel — replaces 3D avatar */}
            <div className="w-full h-full min-h-[260px] sm:min-h-[420px] flex items-center justify-center">
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#0f0f0f',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                border: '1px solid #2a2a2a',
                position: 'relative',
                minHeight: '240px',
              }}>
                {/* Camera off icon */}
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#1e1e1e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}>
                  🎙️
                </div>
                {/* AI label */}
                <span style={{ color: '#888', fontSize: '13px', fontWeight: 500 }}>
                  AI Interviewer
                </span>

                {/* Intelligent voice state indicator */}
                {(() => {
                  const ts = turnDetection.turnState;
                  if (isSpeaking) return (
                    <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Speaking</span>
                  );
                  if (isThinking) return (
                    <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Thinking...</span>
                  );
                  if (gotItFlash) return (
                    <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>✓ Got it</span>
                  );
                  if (ts === 'active_speech') return (
                    <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Listening</span>
                  );
                  if (ts === 'waiting' || ts === 'confirming') return (
                    <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Still listening, take your time...</span>
                  );
                  if (isListening) return (
                    <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Listening</span>
                  );
                  return (
                    <span style={{ color: '#555', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Ready</span>
                  );
                })()}

                {/* Silence progress bar — subtle thin line (only in waiting/confirming) */}
                {isListening && (turnDetection.turnState === 'waiting' || turnDetection.turnState === 'confirming') && (
                  <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '120px',
                    height: '2px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${turnDetection.silenceProgress * 100}%`,
                      backgroundColor: turnDetection.turnState === 'confirming' ? '#f59e0b' : 'rgba(245,158,11,0.5)',
                      borderRadius: '2px',
                      transition: 'width 0.3s ease-out',
                    }} />
                  </div>
                )}

                {/* Speaking indicator — animated dots */}
                {isAiSpeaking && (
                  <div style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#4ade80',
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Keyframe animations */}
            <style>{`
              @keyframes bounce {
                0%, 80%, 100% { transform: scaleY(1); }
                40% { transform: scaleY(1.6); }
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
              }
            `}</style>

            <AnimatePresence>
              {liveTranscript && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-24 left-6 right-6 flex justify-center z-20">
                  <p className="bg-white/10 text-white/90 px-8 py-4 rounded-2xl text-lg backdrop-blur-3xl border border-white/10 shadow-2xl max-w-2xl text-center leading-relaxed font-medium">{liveTranscript}</p>
                </motion.div>
              )}
            </AnimatePresence>


            <div className="absolute top-4 sm:top-8 right-4 sm:right-8 w-28 h-36 sm:w-44 sm:h-56 bg-black rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl z-20 group/candidate">
              <video
                ref={candidateVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-lg"
              />
              
              {!cameraAvailable && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                  <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]">
                    <span className="text-xl sm:text-3xl font-black text-primary uppercase tracking-tighter">
                      {profile?.name?.substring(0, 2) || user?.email?.substring(0, 2) || 'C'}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 sm:p-4">
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
            <div className="h-20 sm:h-24 flex items-center justify-between px-4 sm:px-8 bg-white/[0.03] border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] backdrop-blur-md">
               <div className="flex-1 hidden lg:block">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Audio Engine</p>
                    <p className="text-[10px] font-bold text-primary/50 uppercase">
                      {voiceInput.mode === 'speech-api' ? 'Real-time Web Speech' : 'Neural Voice Fallback Active'}
                    </p>
                  </div>
               </div>

               <div className="flex items-center gap-4 sm:gap-6">
                 <div className="relative group">
                   <motion.button 
                    whileHover={voiceAvailable ? { scale: 1.1 } : {}} 
                    whileTap={voiceAvailable ? { scale: 0.9 } : {}} 
                    onClick={voiceAvailable ? () => { toggleMic(); completeStep(1); } : undefined} 
                    style={{
                      backgroundColor: isListening
                        ? (turnDetection.turnState === 'waiting' || turnDetection.turnState === 'confirming')
                          ? '#f59e0b'
                          : '#ef4444'
                        : voiceAvailable ? '#22c55e' : 'rgba(255,255,255,0.05)',
                      boxShadow: isListening ? '0 0 0 4px rgba(239,68,68,0.2)' : 'none',
                    }}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl relative ${
                      !voiceAvailable ? 'opacity-30 cursor-not-allowed' : ''
                    } ${onboardingStep === 1 ? 'ring-4 ring-primary/20' : ''}`}
                    title={!voiceAvailable ? "Voice recognition unavailable" : ""}
                   >
                     {/* Real-time audio energy waveform (5 bars) */}
                     {isListening && (
                       <div style={{
                         position: 'absolute',
                         top: '-28px',
                         display: 'flex',
                         gap: '3px',
                         alignItems: 'flex-end',
                         height: '20px',
                       }}>
                         {[0.7, 1.0, 0.8, 1.0, 0.6].map((scale, i) => {
                           const barHeight = Math.max(3, voiceInput.audioEnergy * 20 * scale);
                           const barColor = (turnDetection.turnState === 'waiting' || turnDetection.turnState === 'confirming')
                             ? '#f59e0b'
                             : '#4ade80';
                           return (
                             <div key={i} style={{
                               width: '3px',
                               height: `${barHeight}px`,
                               backgroundColor: barColor,
                               borderRadius: '2px',
                               transition: 'height 0.08s ease-out, background-color 0.3s',
                             }} />
                           );
                         })}
                       </div>
                     )}
                     {isListening ? <Mic className="w-6 h-6 sm:w-8 sm:h-8 text-white" /> : <MicOff className="w-6 h-6 sm:w-8 sm:h-8 text-white" />}
                     <span className="text-[8px] font-black mt-1 uppercase tracking-tighter text-white">
                        {isListening
                          ? (turnDetection.turnState === 'waiting' || turnDetection.turnState === 'confirming')
                            ? '⏳ Waiting...'
                            : '🎤 Listening...'
                          : voiceAvailable ? '🎤 Start' : 'Off'
                        }
                     </span>
                     {isListening && turnDetection.turnState !== 'waiting' && turnDetection.turnState !== 'confirming' && (
                        <motion.div className="absolute inset-0 rounded-full border-4 border-red-400" animate={{ scale: [1, 1.4], opacity: [0.6, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />
                     )}
                   </motion.button>
                   {onboardingStep === 1 && (
                     <div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 w-56 p-4 bg-primary text-black rounded-2xl shadow-2xl z-[60] text-xs font-bold animate-in fade-in slide-in-from-bottom-2 text-center leading-tight">
                       <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rotate-45" />
                       Tap to start speaking. Our AI listens to your logic and tone in real-time.
                       <Button variant="ghost" size="sm" className="mt-2 h-7 px-3 text-[10px] hover:bg-black/20 font-black border border-black/10 rounded-lg" onClick={(e) => { e.stopPropagation(); completeStep(1); }}>GOT IT</Button>
                     </div>
                   )}
                 </div>

                 {/* Keep Listening escape hatch — appears during confirming state */}
                 <AnimatePresence>
                   {isListening && turnDetection.turnState === 'confirming' && (
                     <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                       <Button
                         onClick={() => turnDetection.keepListening()}
                         className="h-14 sm:h-16 px-6 sm:px-8 rounded-[2rem] bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-tighter shadow-xl text-sm sm:text-base animate-pulse"
                       >
                         🖐️ Keep Listening
                       </Button>
                     </motion.div>
                   )}
                 </AnimatePresence>

                 {/* Done Answering manual submit button */}
                 {isListening && (finalTranscript.trim().length > 0 || liveTranscript.trim().length > 0) && turnDetection.turnState !== 'confirming' && (
                   <Button
                     onClick={() => {
                       shouldContinueListeningRef.current = false;
                       voiceInput.stopListening();
                       const answer = (finalTranscript + liveTranscript).trim();
                       if (answer.length > 0) {
                         setGotItFlash(true);
                         setTimeout(() => {
                           setGotItFlash(false);
                           handleSendVoiceMessage(answer);
                           setFinalTranscript('');
                           setLiveTranscript('');
                           setHasFinalResult(false);
                           setLastFinalText('');
                           speakingStartRef.current = null;
                           setSpeakingStart(null);
                           turnDetection.reset();
                         }, 400);
                       }
                     }}
                     className="h-14 sm:h-16 px-6 sm:px-8 rounded-[2rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-tighter shadow-xl text-sm sm:text-base"
                   >
                     <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Done
                   </Button>
                 )}

                  {/* Retry button for failed AI responses */}
                  {lastFailedMessage && !isThinking && (
                    <Button
                      onClick={retryLastMessage}
                      className="h-14 sm:h-16 px-6 sm:px-8 rounded-[2rem] bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-tighter shadow-xl text-sm sm:text-base animate-in fade-in"
                    >
                      <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Retry
                    </Button>
                  )}

                  <Button onClick={endInterview} className="h-14 sm:h-16 px-6 sm:px-10 rounded-[2rem] bg-white text-black hover:bg-white/90 font-black uppercase tracking-tighter shadow-xl text-sm sm:text-base">
                     <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 rotate-[135deg] fill-current" /> End <span className="hidden sm:inline">Session</span>
                  </Button>
                </div>

                {/* Network offline banner */}
                <AnimatePresence>
                  {!isOnline && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
                    >
                      <WifiOff className="w-5 h-5" />
                      <span className="font-bold text-sm">You're offline. Your answers will be sent when reconnected.</span>
                    </motion.div>
                  )}
                  {wasOffline && isOnline && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-600/90 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-bold text-sm">Connection restored!</span>
                    </motion.div>
                  )}
                </AnimatePresence>

               <div className="flex-1 hidden sm:flex justify-end">
                  <Button variant="ghost" size="icon" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white/20 hover:text-white hover:bg-white/5 transition-all">
                     <Settings2 className="w-6 h-6" />
                  </Button>
               </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-[2.5rem] p-3 sm:p-5 flex gap-3 sm:gap-4 items-center shadow-lg group focus-within:border-primary/40 transition-all">
              <div className="flex-1 relative">
                <input 
                  ref={textInputRef}
                  className="w-full bg-black/40 border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-5 text-sm sm:text-base text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                  placeholder="Speak to the AI or type your comprehensive response here..."
                  value={inputMsg} 
                  onChange={(e) => setInputMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSend(e as any)}
                />
              </div>
              <Button onClick={(e) => handleManualSend(e as any)} size="lg" className="h-12 sm:h-16 px-4 sm:px-8 rounded-xl sm:rounded-2xl bg-primary hover:bg-primary-glow shadow-glow transition-all font-black uppercase tracking-tighter">
                <Send className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-3" /><span className="hidden sm:inline">Send</span>
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isTextChatOpen && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: '100%', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="md:max-w-[380px] bg-white/5 rounded-xl sm:rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden backdrop-blur-xl">
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