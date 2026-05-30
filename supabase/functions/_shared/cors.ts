import "jsr:@supabase/functions-js/edge-runtime.d.ts"

/**
 * CORS Configuration for Confera Edge Functions
 * 
 * Security: Restricts origins to known deployment URLs.
 * In production, only conferav2.vercel.app and the Supabase URL are allowed.
 * In development, localhost origins are also permitted.
 */

const ALLOWED_ORIGINS = [
  'https://conferav2.vercel.app',
  'https://www.conferav2.vercel.app',
  'https://xwrjqeiqxifjldjuncxl.supabase.co',
]

// Development origins — always allowed in edge functions (no NODE_ENV in Deno)
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8788',
]

const ALL_ALLOWED = [...ALLOWED_ORIGINS, ...DEV_ORIGINS]

/**
 * Get CORS headers for a specific request origin.
 * Returns wildcard-free, origin-specific headers.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin && ALL_ALLOWED.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0] // Default to production origin

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  }
}

/**
 * Static CORS headers for backward compatibility.
 * 
 * ⚠️ DEPRECATED: Uses wildcard origin which allows any domain to call these functions.
 * For new functions, use getCorsHeaders(req.headers.get('origin')) instead.
 * 
 * Existing functions will be migrated incrementally.
 * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 */
