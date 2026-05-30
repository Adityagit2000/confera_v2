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
import { InterviewSkeleton } from '@/components/InterviewSkeleton';
import AnimatedInterviewer from '@/components/AnimatedInterviewer';
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
  RotateCcw,
  Sparkles,
  X
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

const SessionTimer = () => {
  const [elapsedTime, setElapsedTime] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const m = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
  const s = (elapsedTime % 60).toString().padStart(2, '0');
  return <>{m}:{s}</>;
};

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
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [sessionScore, setSessionScore] = useState<number | null>(null);
  const [skipDisabled, setSkipDisabled] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredQuestionsCount, setAnsweredQuestionsCount] = useState(0);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(localStorage.getItem('confera_voice') || '');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const candidateVideoRef = useRef<HTMLVideoElement>(null);
  const shouldContinueListeningRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);
  
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
        // Answer too short - keep listening
        turnDetection.reset();
      }
    }
  }, [turnDetection.turnState]);

  // Voice engine initialization - handled by useVoiceSynthesis hook
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
    if (!loading && messages.length > 0) {
      const seenSpeakHint = localStorage.getItem('confera_seen_speak_hint');
      if (!seenSpeakHint) {
        setOnboardingStep(1);
        localStorage.setItem('confera_seen_speak_hint', 'true');
      } else {
        const seenAutocompleteHint = localStorage.getItem('confera_seen_autocomplete_hint');
        if (!seenAutocompleteHint) {
          setOnboardingStep(2);
          localStorage.setItem('confera_seen_autocomplete_hint', 'true');
        }
      }
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
        const count = parsedTranscript.filter((m: any) => m.role === 'assistant').length;
        setQuestionCount(count);
        setCurrentQuestionIndex(count > 0 ? count - 1 : 0);
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

  // Consolidated speak function - delegates to the production-grade voiceSynth hook
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
          setTimeout(() => {
            if (shouldContinueListeningRef.current && !voiceInput.isListening) {
              voiceInput.startListening();
            }
          }, 2000);
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
      setCurrentQuestionIndex(0);
      speak(aiMessage);
    } catch (err: any) {
      console.error('Start interview error:', err);
      setErrorStatus("AI interviewer is unavailable right now. Please try again.");
    } finally {
      setIsThinking(false);
      setLoading(false);
    }
  }, [canStartInterview, sessionId, speak]);

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
        .select('id, overall_score')
        .eq('session_id', sessionId)
        .single()
      if (data && !error) {
        if (!isPro && !isFounder) {
          setSessionScore(data.overall_score || 0);
          setShowCompletion(false);
          setShowInterstitial(true);
          setSkipDisabled(true);
          setTimeout(() => {
            setSkipDisabled(false);
          }, 3000);
        } else {
          navigate(`/report/${sessionId}`)
        }
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
          interviewType: session?.type || 'hr',
          currentQuestionIndex: currentQuestionIndexRef.current
        }
      });
      
      if (error) throw error;
      
      const aiMessage = data.response;
      setMessages(prev => [...prev, { role: 'assistant', content: aiMessage } as Message]);
      setQuestionCount(prev => prev + 1);
      setCurrentQuestionIndex(prev => prev + 1);
      setAnsweredQuestionsCount(prev => prev + 1);
      speak(aiMessage);
      
      const maxQuestions = session?.type === 'quick_practice' ? 3 : 10;
      if (data.is_complete || currentQuestionIndexRef.current >= maxQuestions) {
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
  }, [isThinking, isSpeaking, sessionId, session?.type, speak, toast, currentQuestionIndex, endInterview]);

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

  const handleDoneAnswering = useCallback(() => {
    const fullAnswer = (finalTranscript + liveTranscript).trim();
    if (fullAnswer.length > 0) {
      handleSendVoiceMessage(fullAnswer);
      setFinalTranscript('');
      setLiveTranscript('');
      setHasFinalResult(false);
      setLastFinalText('');
      speakingStartRef.current = null;
      setSpeakingStart(null);
      turnDetection.reset();
    } else {
      toast({
        title: "Speak first",
        description: "Please speak or enter some text before marking as done.",
        variant: "destructive"
      });
    }
  }, [finalTranscript, liveTranscript, handleSendVoiceMessage, turnDetection, toast]);

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
    return <InterviewSkeleton />;
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

  const handleExitClick = () => {
    setShowExitModal(true);
  };

  return (
    <div className="h-screen bg-[#09090b] text-white flex flex-col font-sans overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

      {/* Brand Header */}
      <header className="px-6 py-4 flex items-center justify-between z-50 w-full relative border-b border-white/[0.04] bg-[#09090b]/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={handleExitClick}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
            <Sparkles className="w-4 h-4 text-black font-bold" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white font-sans">Confera</span>
        </div>

        <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {session?.type?.replace('_', ' ')} Interview
          </span>
        </div>

        <Button 
          variant="ghost" 
          onClick={handleExitClick}
          className="rounded-xl px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all font-semibold"
        >
          Exit
        </Button>
      </header>

      {/* Network offline banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600/90 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="font-bold text-sm">Connection restored!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex p-6 gap-6 relative z-10 overflow-hidden w-full h-full">
        {/* Main Video Area */}
        <div className={`flex flex-col gap-6 transition-all duration-300 ease-in-out h-full ${isTextChatOpen ? 'w-full lg:w-[70%]' : 'w-full'}`}>
          <div className="flex-1 bg-[#121214] border border-white/[0.04] rounded-3xl overflow-hidden relative shadow-lg backdrop-blur-sm flex items-center justify-center">
             <div className="w-full h-full flex flex-col md:flex-row relative">
               
               {/* Confera Avatar */}
               <div className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-br from-[#0f0f12] to-[#1a1a24]">
                 <div className="w-full h-full flex items-center justify-center">
                   <AnimatedInterviewer isSpeaking={isSpeaking} isListening={isListening} isThinking={isThinking} />
                 </div>
                 {/* Voice Energy Indicator Overlay */}
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                   <div className="flex items-center gap-2 mb-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/[0.05]">
                      <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-indigo-500 animate-pulse' : 'bg-white/20'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                        {isSpeaking ? 'Confera Speaking' : isListening ? 'Listening to you' : isThinking ? 'Thinking...' : 'Ready'}
                      </span>
                   </div>
                   {isListening && (
                     <div className="flex items-center justify-center gap-[2px] h-8 px-4 bg-black/60 rounded-full border border-white/[0.05]">
                        {Array.from({ length: 24 }).map((_, i) => {
                          const centerDist = Math.abs(i - 11.5);
                          const scale = Math.max(0.1, 1 - centerDist / 12);
                          const height = Math.max(4, Math.round(voiceInput.audioEnergy * 30 * scale * (0.8 + Math.random() * 0.4)));
                          return (
                            <div
                              key={i}
                              style={{ height: `${height}px`, transition: 'height 0.1s ease' }}
                              className={`w-1 rounded-full ${turnDetection.turnState === 'confirming' ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            />
                          );
                        })}
                     </div>
                   )}
                 </div>
               </div>

               {/* Candidate Camera */}
               <div className="w-full md:w-[35%] border-l border-white/[0.05] bg-[#09090b] relative flex flex-col shrink-0">
                  <video
                    ref={candidateVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!cameraAvailable && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f11] p-4 text-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                        <span className="text-xl font-bold text-primary uppercase">
                          {profile?.name?.substring(0, 2) || user?.email?.substring(0, 2) || 'ME'}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40 font-semibold tracking-wider uppercase">Camera Off</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/[0.05] flex items-center gap-1.5 z-10">
                    <span className={`w-1.5 h-1.5 rounded-full ${cameraAvailable ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">You</span>
                  </div>
               </div>
             </div>
          </div>
          
          {/* Bottom Control Bar */}
          <div className="bg-[#121214] border border-white/[0.04] rounded-2xl p-4 flex items-center justify-between shadow-lg backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-6">
              <Button variant="ghost" onClick={() => setIsTextChatOpen(!isTextChatOpen)} className="gap-2 text-white/60 hover:text-white rounded-xl bg-white/5">
                <MessageSquare className="w-4 h-4" />
                {isTextChatOpen ? 'Hide Chat' : 'Show Chat'}
              </Button>
              <div className="flex items-center gap-2 text-white/50 font-mono text-sm font-semibold">
                <Clock className="w-4 h-4" /> <SessionTimer />
              </div>
            </div>

            <div className="flex items-center gap-4">
               <Button
                  onClick={() => toggleMic()}
                  disabled={!voiceAvailable}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isListening ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.3)] text-white border-2 border-indigo-400/20'
                  }`}
                >
                  {isListening ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6" />}
                </Button>

                {isListening && (finalTranscript.trim().length > 0 || liveTranscript.trim().length > 0) && (
                  <Button
                    onClick={handleDoneAnswering}
                    className="rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 h-12 text-sm uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                  >
                    <CheckCircle className="w-4 h-4" /> Done Answering
                  </Button>
                )}

                {lastFailedMessage && !isThinking && (
                  <Button
                    onClick={retryLastMessage}
                    className="rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 h-12 text-xs uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Retry
                  </Button>
                )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Auto-submit</span>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Chat Sidebar */}
        <AnimatePresence>
          {isTextChatOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0, marginLeft: 0 }}
              animate={{ width: '30%', opacity: 1, marginLeft: 24 }}
              exit={{ width: 0, opacity: 0, marginLeft: 0 }}
              className="h-full hidden lg:flex flex-col bg-[#121214] border border-white/[0.04] rounded-3xl overflow-hidden shadow-lg backdrop-blur-sm shrink-0"
            >
               <div className="p-5 border-b border-white/[0.05] flex items-center justify-between shrink-0 bg-[#0f0f12]">
                 <h3 className="font-bold text-sm text-white/90 uppercase tracking-widest flex items-center gap-2">
                   <Layout className="w-4 h-4 text-primary" /> Transcript
                 </h3>
                 <span className="text-xs font-semibold text-white/50 bg-white/5 px-2 py-1 rounded-md">Q {Math.max(1, questionCount)}/{session?.type === 'quick_practice' ? 3 : 10}</span>
               </div>
               
               <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                  {messages.map((msg, idx) => {
                    const isAi = msg.role === 'assistant';
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 max-w-[90%] ${isAi ? 'self-start' : 'self-end flex-row-reverse ml-auto'}`}
                      >
                        {isAi ? (
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                            <Sparkles className="w-4 h-4 text-primary" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                            <User className="w-4 h-4 text-white/60" />
                          </div>
                        )}
                        <div className={`p-4 text-[14px] leading-relaxed shadow-sm ${
                          isAi 
                            ? 'bg-[#18181b] border-l-2 border-l-indigo-500 border-y border-r border-white/[0.02] text-white/90 rounded-2xl rounded-tl-sm' 
                            : 'bg-[#1c1c1f] border border-white/[0.04] text-white/90 rounded-2xl rounded-tr-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </motion.div>
                    );
                  })}

                  {isListening && (liveTranscript || finalTranscript) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 max-w-[90%] self-end flex-row-reverse ml-auto"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 animate-pulse">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="p-4 rounded-2xl text-sm bg-[#1c1c21]/40 border border-dashed border-primary/30 text-white/60 italic">
                        {(finalTranscript + liveTranscript).trim() || "Listening..."}
                      </div>
                    </motion.div>
                  )}

                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3 max-w-[85%] self-start"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      </div>
                      <div className="p-4 rounded-2xl bg-[#18181c] border border-white/[0.03] flex items-center gap-1.5 py-3">
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
               </div>
               
               <div className="p-4 border-t border-white/[0.05] shrink-0 bg-[#0f0f12]">
                  <form onSubmit={handleManualSend} className="flex gap-2 w-full">
                    <input
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary/40 font-medium"
                      placeholder="Type response instead..."
                      value={inputMsg}
                      onChange={(e) => setInputMsg(e.target.value)}
                    />
                    <Button type="submit" size="icon" className="rounded-xl h-11 w-11 bg-primary hover:bg-primary/80 shrink-0">
                      <Send className="w-4 h-4 text-black" />
                    </Button>
                  </form>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Exit confirmation modal */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className="w-full max-w-sm bg-[#121214] border border-white/[0.04] rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-4 right-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowExitModal(false)}
                  className="rounded-full w-8 h-8 text-white/40 hover:text-white hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-col items-center text-center mt-2">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Exit Session?</h3>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">
                  Are you sure you want to exit the session? You can end the interview now to generate a report based on your responses, or exit to the dashboard immediately.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <Button
                  onClick={() => {
                    setShowExitModal(false);
                    endInterview();
                  }}
                  className="w-full h-11 bg-indigo-500 text-white font-semibold hover:bg-indigo-400 rounded-xl"
                >
                  End & Generate Report
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowExitModal(false);
                    navigate('/dashboard');
                  }}
                  className="w-full h-11 bg-white/5 text-white hover:bg-white/10 rounded-xl font-semibold border border-white/5"
                >
                  Exit to Dashboard
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowExitModal(false)}
                  className="w-full h-11 text-white/40 hover:text-white/60 rounded-xl font-semibold animate-none"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompletion && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-[#09090b]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-12">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
            </motion.div>
            <h2 className="text-5xl font-black mb-4 tracking-tighter">Session Complete</h2>
            <p className="text-white/50 text-xl font-medium mb-12 max-w-md text-center">Finalizing insights and generating your report...</p>
            <div className="flex items-center gap-3 text-indigo-400 font-bold">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Analyzing Responses</span>
            </div>
          </motion.div>
        )}
        
        {showInterstitial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[60] bg-[#0a0a0f]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center">
            <motion.div 
              initial={{ scale: 0.8, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              transition={{ type: "spring", damping: 20 }}
              className="max-w-2xl mx-auto flex flex-col items-center"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(var(--primary),0.3)]">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-6xl font-black text-white mb-2 tracking-tighter">
                Score: <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">{sessionScore}%</span>
              </h2>
              <p className="text-2xl font-medium text-white/90 mb-8 max-w-xl leading-snug">
                Pro users improve their score by an average of 24 points in 2 weeks.
              </p>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-10 w-full max-w-md">
                <h3 className="font-bold text-lg mb-4 text-white">Unlock Pro to get:</h3>
                <ul className="space-y-3 text-left">
                  <li className="flex items-center gap-3 text-white/80 font-medium"><CheckCircle className="w-5 h-5 text-primary" /> Unlimited mock interviews</li>
                  <li className="flex items-center gap-3 text-white/80 font-medium"><CheckCircle className="w-5 h-5 text-primary" /> All 200+ company tracks</li>
                  <li className="flex items-center gap-3 text-white/80 font-medium"><CheckCircle className="w-5 h-5 text-primary" /> Priority AI feedback</li>
                </ul>
              </div>

              <div className="flex flex-col items-center gap-4 w-full max-w-md">
                <Button 
                  onClick={() => navigate('/pricing')}
                  className="w-full h-14 text-lg font-bold bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.4)] rounded-xl"
                >
                  Upgrade to Pro
                </Button>
                <Button 
                  variant="ghost" 
                  disabled={skipDisabled}
                  onClick={() => navigate(`/report/${sessionId}`)}
                  className="text-white/50 hover:text-white/80 font-semibold"
                >
                  {skipDisabled ? 'Please wait...' : 'View my report'}
                </Button>
              </div>
            </motion.div>
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