/**
 * Voice Diagnostics Engine for Confera
 * 
 * Runs comprehensive environment checks before interview start.
 * Returns a structured report with pass/fail/warn per check,
 * actionable fix instructions, and a recommended voice mode.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
  fix?: string;
}

export interface BrowserInfo {
  name: string;
  version: string;
  os: string;
  isMobile: boolean;
  isIOS: boolean;
}

export interface DiagnosticReport {
  checks: DiagnosticCheck[];
  canUseSpeechAPI: boolean;
  canUseMediaRecorder: boolean;
  canProceed: boolean;
  browser: BrowserInfo;
  recommendedMode: 'speech-api' | 'media-recorder' | 'text-only';
  timestamp: string;
}

// ── Browser Detection ────────────────────────────────────────────────────────

export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = '0';

  const isBrave = (navigator as any).brave !== undefined;

  // Order matters — Edge/Opera must be checked before Chrome
  if (isBrave) {
    name = 'Brave';
    // Brave uses Chrome's UA string, so we extract the underlying Chromium version
    version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Edg/')) {
    name = 'Edge';
    version = ua.match(/Edg\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    name = 'Opera';
    version = ua.match(/(?:OPR|Opera)\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Chrome/') && !ua.includes('Chromium/')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Firefox/')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    name = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || '0';
  }

  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isMobile = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  let os = 'Unknown';
  if (isIOS) os = 'iOS';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('CrOS')) os = 'ChromeOS';

  return { name, version, os, isMobile, isIOS };
}

// ── Individual Checks ────────────────────────────────────────────────────────

function checkHTTPS(): DiagnosticCheck {
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
  return {
    id: 'https',
    label: 'Secure Connection (HTTPS)',
    status: isSecure ? 'pass' : 'fail',
    detail: isSecure
      ? 'Running on a secure origin'
      : 'Not running over HTTPS — microphone access will be blocked',
    fix: isSecure ? undefined : 'Access this page via HTTPS. Microphone and speech APIs require a secure context.',
  };
}

function checkBrowserSupport(browser: BrowserInfo): DiagnosticCheck {
  const supported = ['Chrome', 'Edge', 'Safari', 'Opera', 'Brave'];
  const partialSupport = ['Firefox'];
  
  if (supported.includes(browser.name)) {
    const minVersions: Record<string, number> = { Chrome: 80, Edge: 80, Safari: 14, Opera: 67, Brave: 80 };
    const minVersion = minVersions[browser.name] || 0;
    const currentVersion = parseInt(browser.version);
    
    if (currentVersion >= minVersion) {
      return {
        id: 'browser',
        label: 'Browser Compatibility',
        status: 'pass',
        detail: `${browser.name} ${browser.version} — fully supported`,
      };
    }
    return {
      id: 'browser',
      label: 'Browser Compatibility',
      status: 'warn',
      detail: `${browser.name} ${browser.version} is outdated. Minimum: v${minVersion}`,
      fix: `Update ${browser.name} to the latest version for the best experience.`,
    };
  }
  
  if (partialSupport.includes(browser.name)) {
    return {
      id: 'browser',
      label: 'Browser Compatibility',
      status: 'warn',
      detail: `${browser.name} has limited speech recognition support. Using audio recording fallback.`,
      fix: 'For the best voice interview experience, use Chrome, Edge, or Safari.',
    };
  }

  return {
    id: 'browser',
    label: 'Browser Compatibility',
    status: 'warn',
    detail: `${browser.name} — compatibility unknown. Will attempt to use available APIs.`,
    fix: 'For guaranteed compatibility, use Chrome, Edge, or Safari.',
  };
}

function checkSpeechRecognition(browser: BrowserInfo): DiagnosticCheck {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  // Firefox has SpeechRecognition but it's unreliable
  if (browser.name === 'Firefox') {
    return {
      id: 'speech-recognition',
      label: 'Speech Recognition API',
      status: 'warn',
      detail: 'Firefox speech recognition is unreliable. Using audio recording mode instead.',
    };
  }

  // iOS doesn't support SpeechRecognition reliably
  if (browser.isIOS) {
    return {
      id: 'speech-recognition',
      label: 'Speech Recognition API',
      status: 'warn',
      detail: 'iOS does not support Web Speech API. Using Whisper AI transcription instead.',
    };
  }

  if (SpeechRecognition) {
    return {
      id: 'speech-recognition',
      label: 'Speech Recognition API',
      status: 'pass',
      detail: 'Web Speech API is available and supported',
    };
  }

  return {
    id: 'speech-recognition',
    label: 'Speech Recognition API',
    status: 'fail',
    detail: 'Web Speech API is not available in this browser',
    fix: browser.name === 'Brave' 
      ? 'Brave Shields may block the Speech API. Use the fallback mode, or disable Shields for this site.'
      : 'Use Chrome, Edge, or Safari for real-time speech recognition. Text input will still work.',
  };
}

function checkMediaDevices(): DiagnosticCheck {
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    return {
      id: 'media-devices',
      label: 'Media Device API',
      status: 'pass',
      detail: 'getUserMedia API is available',
    };
  }
  return {
    id: 'media-devices',
    label: 'Media Device API',
    status: 'fail',
    detail: 'getUserMedia is not available — cannot access microphone',
    fix: 'Ensure you are on HTTPS and using a modern browser.',
  };
}

async function checkMicPermission(): Promise<DiagnosticCheck> {
  try {
    // Try the Permissions API first (Chrome/Edge)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') {
          return {
            id: 'mic-permission',
            label: 'Microphone Permission',
            status: 'pass',
            detail: 'Microphone access is granted',
          };
        }
        if (result.state === 'denied') {
          return {
            id: 'mic-permission',
            label: 'Microphone Permission',
            status: 'fail',
            detail: 'Microphone access has been denied',
            fix: 'Click the lock icon in the address bar → Site Settings → Microphone → Allow. Then reload this page.',
          };
        }
        // state === 'prompt' — permission not yet asked
        return {
          id: 'mic-permission',
          label: 'Microphone Permission',
          status: 'warn',
          detail: 'Microphone permission not yet granted — you will be prompted when the interview starts',
        };
      } catch {
        // permissions.query may not support 'microphone' in all browsers
      }
    }

    // Fallback: attempt to get a stream briefly
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop()); // immediately release
    return {
      id: 'mic-permission',
      label: 'Microphone Permission',
      status: 'pass',
      detail: 'Microphone access confirmed via stream test',
    };
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      return {
        id: 'mic-permission',
        label: 'Microphone Permission',
        status: 'fail',
        detail: 'Microphone access was denied',
        fix: 'Click the lock icon in the address bar → Site Settings → Microphone → Allow. Then reload this page.',
      };
    }
    if (err.name === 'NotFoundError') {
      return {
        id: 'mic-permission',
        label: 'Microphone Permission',
        status: 'fail',
        detail: 'No microphone device found',
        fix: 'Connect a microphone or headset and reload the page.',
      };
    }
    return {
      id: 'mic-permission',
      label: 'Microphone Permission',
      status: 'fail',
      detail: `Microphone check failed: ${err.message}`,
      fix: 'Ensure a microphone is connected and browser permissions are allowed.',
    };
  }
}

async function checkAudioDevices(): Promise<DiagnosticCheck> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return {
        id: 'audio-devices',
        label: 'Audio Input Devices',
        status: 'warn',
        detail: 'Cannot enumerate audio devices in this browser',
      };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');

    if (audioInputs.length === 0) {
      return {
        id: 'audio-devices',
        label: 'Audio Input Devices',
        status: 'fail',
        detail: 'No microphone devices detected',
        fix: 'Connect a microphone or headset to your device.',
      };
    }

    // Check if labels are available (requires permission)
    const hasLabels = audioInputs.some(d => d.label && d.label.length > 0);
    return {
      id: 'audio-devices',
      label: 'Audio Input Devices',
      status: 'pass',
      detail: `${audioInputs.length} microphone${audioInputs.length > 1 ? 's' : ''} detected${hasLabels ? `: ${audioInputs.map(d => d.label).join(', ')}` : ''}`,
    };
  } catch {
    return {
      id: 'audio-devices',
      label: 'Audio Input Devices',
      status: 'warn',
      detail: 'Could not enumerate audio devices',
    };
  }
}

function checkAudioContext(): DiagnosticCheck {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return {
        id: 'audio-context',
        label: 'Audio Context',
        status: 'warn',
        detail: 'AudioContext not available — some audio features may not work',
      };
    }

    const ctx = new AudioCtx();
    const state = ctx.state;
    ctx.close().catch(() => {});

    if (state === 'running') {
      return {
        id: 'audio-context',
        label: 'Audio Context',
        status: 'pass',
        detail: 'AudioContext initialized successfully',
      };
    }

    return {
      id: 'audio-context',
      label: 'Audio Context',
      status: 'warn',
      detail: `AudioContext is ${state} — will be resumed on user interaction`,
    };
  } catch {
    return {
      id: 'audio-context',
      label: 'Audio Context',
      status: 'warn',
      detail: 'Could not create AudioContext',
    };
  }
}

function checkSpeechSynthesis(): DiagnosticCheck {
  if (!window.speechSynthesis) {
    return {
      id: 'speech-synthesis',
      label: 'Text-to-Speech',
      status: 'warn',
      detail: 'SpeechSynthesis API not available — AI interviewer responses will be text-only',
    };
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    return {
      id: 'speech-synthesis',
      label: 'Text-to-Speech',
      status: 'pass',
      detail: `${englishVoices.length} English voice${englishVoices.length !== 1 ? 's' : ''} available`,
    };
  }

  // Voices may not be loaded yet (Firefox/Safari load async)
  return {
    id: 'speech-synthesis',
    label: 'Text-to-Speech',
    status: 'warn',
    detail: 'Voices not loaded yet — they will be available when the interview starts',
  };
}

function checkMediaRecorder(): DiagnosticCheck {
  if (typeof MediaRecorder === 'undefined') {
    return {
      id: 'media-recorder',
      label: 'Audio Recording (Fallback)',
      status: 'fail',
      detail: 'MediaRecorder API not available',
      fix: 'Update your browser to the latest version.',
    };
  }

  const supportedTypes = ['audio/webm', 'audio/mp4', 'audio/ogg'].filter(
    t => MediaRecorder.isTypeSupported(t)
  );

  if (supportedTypes.length === 0) {
    return {
      id: 'media-recorder',
      label: 'Audio Recording (Fallback)',
      status: 'warn',
      detail: 'No supported audio recording formats found',
    };
  }

  return {
    id: 'media-recorder',
    label: 'Audio Recording (Fallback)',
    status: 'pass',
    detail: `Supported formats: ${supportedTypes.join(', ')}`,
  };
}

// ── Main Diagnostic Runner ───────────────────────────────────────────────────

export async function runDiagnostics(): Promise<DiagnosticReport> {
  const browser = detectBrowser();

  // Run synchronous checks first
  const checks: DiagnosticCheck[] = [
    checkHTTPS(),
    checkBrowserSupport(browser),
    checkSpeechRecognition(browser),
    checkMediaDevices(),
    checkAudioContext(),
    checkSpeechSynthesis(),
    checkMediaRecorder(),
  ];

  // Run async checks
  const [micPermission, audioDevices] = await Promise.all([
    checkMicPermission(),
    checkAudioDevices(),
  ]);

  // Insert async results after media-devices check
  const mediaDevicesIdx = checks.findIndex(c => c.id === 'media-devices');
  checks.splice(mediaDevicesIdx + 1, 0, micPermission, audioDevices);

  // Determine capabilities
  const hasSpeechAPI = checks.find(c => c.id === 'speech-recognition')?.status === 'pass';
  const hasMediaRecorder = checks.find(c => c.id === 'media-recorder')?.status !== 'fail';
  const hasMic = micPermission.status !== 'fail';
  const hasHTTPS = checks.find(c => c.id === 'https')?.status === 'pass';

  const canUseSpeechAPI = hasSpeechAPI && hasMic && hasHTTPS;
  const canUseMediaRecorder = hasMediaRecorder && hasMic && hasHTTPS;

  // Determine recommended mode
  let recommendedMode: 'speech-api' | 'media-recorder' | 'text-only' = 'text-only';
  if (canUseSpeechAPI && !browser.isIOS && browser.name !== 'Firefox') {
    recommendedMode = 'speech-api';
  } else if (canUseMediaRecorder) {
    recommendedMode = 'media-recorder';
  }

  // Can proceed if at least text input works (always true) or voice works
  const hasCriticalFailure = checks.some(
    c => c.status === 'fail' && ['https'].includes(c.id)
  );
  const canProceed = !hasCriticalFailure;

  return {
    checks,
    canUseSpeechAPI,
    canUseMediaRecorder,
    canProceed,
    browser,
    recommendedMode,
    timestamp: new Date().toISOString(),
  };
}

// ── AudioContext Resume Utility ──────────────────────────────────────────────

let sharedAudioContext: AudioContext | null = null;

/**
 * Get or create a shared AudioContext and ensure it's in 'running' state.
 * Must be called from a user interaction handler (click/tap).
 */
export async function ensureAudioContext(): Promise<AudioContext | null> {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioCtx();
    }

    if (sharedAudioContext.state === 'suspended') {
      await sharedAudioContext.resume();
    }

    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Close the shared AudioContext. Call on interview end/unmount.
 */
export function closeAudioContext(): void {
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    sharedAudioContext.close().catch(() => {});
    sharedAudioContext = null;
  }
}
