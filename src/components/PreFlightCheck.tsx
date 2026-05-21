/**
 * PreFlightCheck — Pre-interview system health check component
 * 
 * Runs voiceDiagnostics suite before interview starts.
 * Shows animated checklist with pass/fail/warn indicators.
 * Provides actionable fix instructions and fallback options.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Mic,
  Monitor,
  Shield,
  Volume2,
  Wifi,
  Keyboard,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react';
import {
  runDiagnostics,
  type DiagnosticReport,
  type DiagnosticCheck,
} from '@/lib/voiceDiagnostics';

interface PreFlightCheckProps {
  onComplete: (report: DiagnosticReport) => void;
  onSkip: () => void;
}

const CHECK_ICONS: Record<string, any> = {
  https: Shield,
  browser: Monitor,
  'speech-recognition': Mic,
  'media-devices': Mic,
  'mic-permission': Mic,
  'audio-devices': Volume2,
  'audio-context': Volume2,
  'speech-synthesis': Volume2,
  'media-recorder': Mic,
};

function StatusIcon({ status }: { status: DiagnosticCheck['status'] }) {
  if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (status === 'fail') return <XCircle className="w-5 h-5 text-red-400" />;
  return <AlertTriangle className="w-5 h-5 text-amber-400" />;
}

export function PreFlightCheck({ onComplete, onSkip }: PreFlightCheckProps) {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [visibleChecks, setVisibleChecks] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    setVisibleChecks(0);
    setReport(null);

    const result = await runDiagnostics();
    setReport(result);

    // Animate checks appearing one by one
    for (let i = 0; i <= result.checks.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setVisibleChecks(i);
    }

    setIsRunning(false);
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const failedChecks = report?.checks.filter(c => c.status === 'fail') || [];
  const warnChecks = report?.checks.filter(c => c.status === 'warn') || [];
  const passedChecks = report?.checks.filter(c => c.status === 'pass') || [];
  const allPassed = failedChecks.length === 0;

  const getModeLabel = (mode: string) => {
    if (mode === 'speech-api') return 'Real-time Speech Recognition';
    if (mode === 'media-recorder') return 'AI Audio Transcription (Whisper)';
    return 'Text Input Only';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            {isRunning ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : allPassed ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isRunning ? 'Running System Checks...' : allPassed ? 'All Systems Ready' : 'System Check Complete'}
          </h2>
          <p className="text-sm text-white/50">
            {isRunning
              ? 'Verifying your browser, microphone, and speech capabilities'
              : report
                ? `${passedChecks.length} passed, ${warnChecks.length} warnings, ${failedChecks.length} failed`
                : ''
            }
          </p>
        </div>

        {/* Check List */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden mb-6">
          <AnimatePresence>
            {report?.checks.map((check, idx) => {
              if (idx >= visibleChecks) return null;
              const Icon = CHECK_ICONS[check.id] || Wifi;

              return (
                <motion.div
                  key={check.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`px-5 py-3.5 flex items-start gap-4 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.02] transition-colors ${
                    showDetails === check.id ? 'bg-white/[0.03]' : ''
                  }`}
                  onClick={() => setShowDetails(showDetails === check.id ? null : check.id)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      check.status === 'pass' ? 'bg-emerald-500/10' :
                      check.status === 'fail' ? 'bg-red-500/10' :
                      'bg-amber-500/10'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        check.status === 'pass' ? 'text-emerald-400' :
                        check.status === 'fail' ? 'text-red-400' :
                        'text-amber-400'
                      }`} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white truncate">{check.label}</p>
                      <StatusIcon status={check.status} />
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{check.detail}</p>

                    {/* Expandable fix instructions */}
                    <AnimatePresence>
                      {showDetails === check.id && check.fix && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                            <p className="text-xs text-amber-300/80 leading-relaxed">{check.fix}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Loading skeleton for remaining checks */}
          {isRunning && report && visibleChecks < report.checks.length && (
            <div className="px-5 py-3.5 flex items-center gap-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                <div className="h-2 w-48 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Recommended Mode Banner */}
        {!isRunning && report && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20"
          >
            <p className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-1">
              Recommended Mode
            </p>
            <p className="text-sm font-semibold text-white">
              {getModeLabel(report.recommendedMode)}
            </p>
            {report.recommendedMode === 'media-recorder' && (
              <p className="text-xs text-white/40 mt-1">
                Your answers will be transcribed using Whisper AI. Speak naturally — audio is processed every 6 seconds.
              </p>
            )}
            {report.recommendedMode === 'text-only' && (
              <p className="text-xs text-white/40 mt-1">
                Voice input is not available. You can type your answers using the text chat panel.
              </p>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        {!isRunning && report && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-3"
          >
            {report.canProceed && (
              <Button
                onClick={() => onComplete(report)}
                className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-glow transition-all hover:scale-[1.01]"
              >
                {allPassed ? 'Enter Interview Room' : 'Continue Anyway'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            )}

            {!report.canProceed && (
              <Button
                onClick={runChecks}
                className="w-full h-14 text-base font-bold rounded-xl bg-white/10 hover:bg-white/15 text-white"
              >
                <RefreshCcw className="w-5 h-5 mr-2" />
                Re-run Checks
              </Button>
            )}

            {report.recommendedMode === 'text-only' || !report.canProceed ? (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="w-full text-white/40 hover:text-white/60"
              >
                <Keyboard className="w-4 h-4 mr-2" />
                Continue with Text Input Only
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="w-full text-white/30 hover:text-white/50 text-xs"
              >
                Skip system check
              </Button>
            )}
          </motion.div>
        )}

        {/* Browser info footer */}
        {report && (
          <p className="text-center text-[10px] text-white/20 mt-6 font-mono">
            {report.browser.name} {report.browser.version} • {report.browser.os}
            {report.browser.isMobile ? ' • Mobile' : ''}
          </p>
        )}
      </motion.div>
    </div>
  );
}
