'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function GuideAnimations() {
  useEffect(() => {
    // Animate sections on scroll — fade in + slide up
    gsap.utils.toArray('.ms-section').forEach((el) => {
      gsap.from(el as Element, {
        scrollTrigger: {
          trigger: el as Element,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: 'power2.out',
      })
    })

    // Shield boxes — scale from 0.95 to 1 with opacity
    gsap.utils.toArray('.shield-box').forEach((el) => {
      gsap.from(el as Element, {
        scrollTrigger: {
          trigger: el as Element,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        scale: 0.95,
        duration: 0.6,
        ease: 'power2.out',
      })
    })

    // Headings — gold text-shadow pulse when entering viewport
    gsap.utils.toArray('.ms-heading').forEach((el) => {
      gsap.fromTo(
        el as Element,
        { textShadow: '0 0 0px rgba(201,168,76,0)' },
        {
          scrollTrigger: {
            trigger: el as Element,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
          textShadow: '0 0 12px rgba(201,168,76,0.5)',
          duration: 0.8,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
        }
      )
    })

    return () => ScrollTrigger.getAll().forEach((t) => t.kill())
  }, [])

  return null
}
