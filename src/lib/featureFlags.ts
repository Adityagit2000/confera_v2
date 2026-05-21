/**
 * Feature Flags for Confera
 * 
 * Simple flag system backed by localStorage with compile-time defaults.
 * Allows runtime toggling via console: window.__confera_flags.set('FLAG_NAME', true)
 */

const FLAG_DEFAULTS = {
  /** Show voice pre-flight diagnostics before interview */
  VOICE_PREFLIGHT_CHECK: true,
  /** Use Whisper fallback on desktop browsers (not just iOS/Firefox) */
  WHISPER_FALLBACK_DESKTOP: false,
  /** Enable structured logging to event_logs table */
  STRUCTURED_LOGGING: true,
  /** Enable circuit breaker on AI provider calls */
  CIRCUIT_BREAKER: true,
  /** Enable prompt injection detection */
  PROMPT_INJECTION_DETECTION: true,
  /** Show voice diagnostics info in interview header */
  SHOW_VOICE_STATUS_BADGE: false,
} as const;

export type FeatureFlag = keyof typeof FLAG_DEFAULTS;

const STORAGE_KEY = 'confera_feature_flags';

function loadOverrides(): Partial<Record<FeatureFlag, boolean>> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveOverrides(overrides: Partial<Record<FeatureFlag, boolean>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {}
}

/**
 * Check if a feature flag is enabled.
 */
export function isEnabled(flag: FeatureFlag): boolean {
  const overrides = loadOverrides();
  if (flag in overrides) return overrides[flag] as boolean;
  return FLAG_DEFAULTS[flag];
}

/**
 * Set a feature flag override (persists to localStorage).
 */
export function setFlag(flag: FeatureFlag, value: boolean): void {
  const overrides = loadOverrides();
  overrides[flag] = value;
  saveOverrides(overrides);
}

/**
 * Reset a feature flag to its default value.
 */
export function resetFlag(flag: FeatureFlag): void {
  const overrides = loadOverrides();
  delete overrides[flag];
  saveOverrides(overrides);
}

/**
 * Get all flags with their current effective values.
 */
export function getAllFlags(): Record<FeatureFlag, { default: boolean; current: boolean; overridden: boolean }> {
  const overrides = loadOverrides();
  const result: any = {};

  for (const [key, defaultValue] of Object.entries(FLAG_DEFAULTS)) {
    const flag = key as FeatureFlag;
    result[flag] = {
      default: defaultValue,
      current: flag in overrides ? overrides[flag] : defaultValue,
      overridden: flag in overrides,
    };
  }

  return result;
}

// Expose to console for runtime debugging
if (typeof window !== 'undefined') {
  (window as any).__confera_flags = {
    get: isEnabled,
    set: setFlag,
    reset: resetFlag,
    list: getAllFlags,
    help: () => {
      console.table(getAllFlags());
      console.log('Usage: __confera_flags.set("FLAG_NAME", true/false)');
    },
  };
}
