'use client'

import { useState, useEffect } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions } from '@tsparticles/engine'

interface AtmosphericParticlesProps {
  embers?: boolean
}

const starsConfig: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 60,
  particles: {
    number: { value: 180, density: { enable: true } },
    color: {
      value: ['#dad2ba', '#dad2ba', '#dad2ba', '#dad2ba', '#9bd7ff'],
    },
    opacity: {
      value: { min: 0.1, max: 0.85 },
      animation: {
        enable: true,
        speed: 0.4,
        sync: false,
      },
    },
    size: {
      value: { min: 0.3, max: 1.6 },
    },
    move: {
      enable: false,
    },
    shape: { type: 'circle' },
  },
  detectRetina: true,
}

const embersConfig: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 60,
  particles: {
    number: { value: 25, density: { enable: true } },
    color: {
      value: ['#c9a84c', '#f0c060', '#e8a030', '#d4883c'],
    },
    opacity: {
      value: { min: 0.05, max: 0.35 },
      animation: {
        enable: true,
        speed: 0.6,
        sync: false,
      },
    },
    size: {
      value: { min: 0.5, max: 2.2 },
      animation: {
        enable: true,
        speed: 0.3,
        sync: false,
      },
    },
    move: {
      enable: true,
      speed: { min: 0.1, max: 0.4 },
      direction: 'top',
      outModes: { default: 'out' },
      straight: false,
      random: true,
    },
    shape: { type: 'circle' },
    wobble: {
      enable: true,
      distance: 8,
      speed: 2,
    },
  },
  detectRetina: true,
}

export default function AtmosphericParticles({ embers = false }: AtmosphericParticlesProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <>
      <Particles
        id="stars-particles"
        options={starsConfig}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          height: '75vh',
        }}
      />
      {embers && (
        <Particles
          id="ember-particles"
          options={embersConfig}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  )
}
