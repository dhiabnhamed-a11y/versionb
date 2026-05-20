'use client'

import { useState } from 'react'
import { Player } from '@lottiefiles/react-lottie-player'

interface LottiePlayerProps {
  src: string
  width?: number | string
  height?: number | string
  speed?: number
  className?: string
}

export default function LottiePlayer({ src, width = 500, height = 400, speed = 0.8, className }: LottiePlayerProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError) return null

  return (
    <div style={{ width: '100%', maxWidth: width }}>
      <Player
        autoplay
        loop
        src={src}
        speed={speed}
        style={{ width: '100%', height: height }}
        className={className}
        onEvent={(e) => { if (e === 'error') setHasError(true) }}
      />
    </div>
  )
}
