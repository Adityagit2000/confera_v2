/**
 * Network Utilities for Confera
 * 
 * Provides:
 * - useOnlineStatus: React hook for network status awareness
 * - fetchWithRetry: Exponential backoff wrapper for fetch calls
 * - useSessionGuard: Hook to detect expired auth tokens
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

// ── useOnlineStatus ──────────────────────────────────────────────────────────

/**
 * React hook that tracks navigator.onLine and fires callbacks on transitions.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setWasOffline(true)
      // Auto-clear the "was offline" banner after 5 seconds
      setTimeout(() => setWasOffline(false), 5000)
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}

// ── fetchWithRetry ───────────────────────────────────────────────────────────

interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onRetry?: (attempt: number, error: Error) => void
}

/**
 * Fetch wrapper with exponential backoff retry logic.
 * Only retries on network errors and 5xx responses (not 4xx).
 */
export async function fetchWithRetry(
  fn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn()

      // Don't retry on client errors (4xx) — those won't fix themselves
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response
      }

      // Server error (5xx) — retry
      if (attempt < maxRetries) {
        lastError = new Error(`Server error: ${response.status}`)
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
        onRetry?.(attempt + 1, lastError)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      return response // Return the failed response on last attempt
    } catch (error: any) {
      lastError = error

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
        onRetry?.(attempt + 1, error)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      throw error // Rethrow on final attempt
    }
  }

  throw lastError || new Error('All retry attempts exhausted')
}

// ── useSessionGuard ──────────────────────────────────────────────────────────

/**
 * Hook that monitors the Supabase auth session and redirects to login if expired.
 * Useful for long-running pages like InterviewSession where the token might expire.
 */
export function useSessionGuard(options: { onExpired?: () => void } = {}) {
  const [isValid, setIsValid] = useState(true)
  const checkedRef = useRef(false)

  const checkSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIsValid(false)
        options.onExpired?.()
      }
    } catch {
      // Session check failed — assume valid to avoid false logout
    }
  }, [options.onExpired])

  useEffect(() => {
    // Check session validity on mount
    if (!checkedRef.current) {
      checkedRef.current = true
      checkSession()
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') {
          setIsValid(false)
          options.onExpired?.()
        }
      }
    })

    // Periodic check every 5 minutes (for long interview sessions)
    const interval = setInterval(checkSession, 5 * 60 * 1000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [checkSession])

  return { isSessionValid: isValid, checkSession }
}

// ── Concurrent Tab Detection ─────────────────────────────────────────────────

const INTERVIEW_LOCK_KEY = 'confera_interview_active'

/**
 * Acquire a "lock" indicating an interview is active in this tab.
 * Returns false if another tab already has an active interview.
 */
export function acquireInterviewLock(sessionId: string): boolean {
  try {
    const existing = localStorage.getItem(INTERVIEW_LOCK_KEY)
    if (existing) {
      const parsed = JSON.parse(existing)
      // If the lock is less than 30 minutes old and different session, reject
      if (parsed.sessionId !== sessionId && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
        return false
      }
    }
    localStorage.setItem(INTERVIEW_LOCK_KEY, JSON.stringify({
      sessionId,
      timestamp: Date.now()
    }))
    return true
  } catch {
    return true // Don't block on localStorage errors
  }
}

/**
 * Release the interview lock for this tab.
 */
export function releaseInterviewLock(sessionId: string): void {
  try {
    const existing = localStorage.getItem(INTERVIEW_LOCK_KEY)
    if (existing) {
      const parsed = JSON.parse(existing)
      if (parsed.sessionId === sessionId) {
        localStorage.removeItem(INTERVIEW_LOCK_KEY)
      }
    }
  } catch {
    // Ignore localStorage errors
  }
}
