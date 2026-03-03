import { NextResponse } from 'next/server'

/**
 * Validates a Bearer token from the Authorization header against
 * the DURINS_DOOR_API_TOKEN environment variable.
 *
 * If DURINS_DOOR_API_TOKEN is not set, ALL requests are denied by default
 * to prevent accidentally running an open API in production.
 * Returns null if auth is valid, or a 401 NextResponse if not.
 */
export function requireApiAuth(request: Request): NextResponse | null {
  const token = process.env.DURINS_DOOR_API_TOKEN

  if (!token) {
    // No token configured — deny all requests to avoid open-access deployments.
    // Set DURINS_DOOR_API_TOKEN in your environment to enable API access.
    return NextResponse.json(
      { error: 'API access is disabled: DURINS_DOOR_API_TOKEN is not configured' },
      { status: 401 },
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
