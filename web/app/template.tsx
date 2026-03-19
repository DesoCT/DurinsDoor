'use client'

import { LazyMotion, domAnimation, m } from 'motion/react'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ minHeight: '100dvh' }}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}
