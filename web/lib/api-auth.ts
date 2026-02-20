import { NextResponse } from 'next/server'

/**
 * Validates a Bearer token from the Authorization header against
 * the DURINS_DOOR_API_TOKEN environment variable.
 *
 * Returns null if auth is valid, or a 401 NextResponse if not.
 */
export function requireApiAuth(request: Request): NextResponse | null {
  const token = process.env.DURINS_DOOR_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'API token not configured on server' },
      { status: 500 },
    )
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
