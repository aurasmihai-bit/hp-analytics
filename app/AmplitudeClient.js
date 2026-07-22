'use client'

import { useEffect } from 'react'
import * as amplitude from '@amplitude/unified'

const AMPLITUDE_BROWSER_API_KEY = 'b4f2ced493236e59198dcfb11288de4c'

export default function AmplitudeClient() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__hpAmplitudeUnifiedInitialized) return

    amplitude.initAll(AMPLITUDE_BROWSER_API_KEY, {
      analytics: {
        autocapture: true,
      },
      sessionReplay: {
        sampleRate: 1,
      },
    })

    window.__hpAmplitudeUnifiedInitialized = true
  }, [])

  return null
}
