import posthog from 'posthog-js'

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

if (key) {
  posthog.init(key, {
    api_host: host || 'https://eu.i.posthog.com',
    defaults: '2026-01-30',
  })
}
