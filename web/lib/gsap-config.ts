'use client'

import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, SplitText, DrawSVGPlugin, ScrollTrigger)

export { gsap, useGSAP, SplitText, DrawSVGPlugin, ScrollTrigger }
