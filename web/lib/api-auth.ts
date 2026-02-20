import { NextResponse } from 'next/server'

/**
 * Validates a Bearer token from the Authorization header against
 * the DURINS_DOOR_API_TOKEN environment variable.
 *
 * If DURINS_DOOR_API_TOKEN is not set, auth is skipped (open access).
 * Returns null if auth is valid, or a 401 NextResponse if not.
 */
export function requireApiAuth(request: Request): NextResponse | null {
  const token = process.env.DURINS_DOOR_API_TOKEN
  if (!token) {
    // No token configured — API is open to anyone
    return null
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : ''

  if (!bearer || bearer !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
