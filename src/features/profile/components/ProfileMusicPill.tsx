'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'

interface Props {
  audioUrl: string
  title: string
  artist: string
  coverUrl?: string
}

export default function ProfileMusicPill({ audioUrl, title, artist, coverUrl }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioData, setAudioData] = useState<number[]>(new Array(3).fill(0))
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()

  // Initialize audio visualization
  useEffect(() => {
    if (!audioRef.current || audioContextRef.current) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaElementSource(audioRef.current)
      
      analyser.fftSize = 32
      source.connect(analyser)
      analyser.connect(audioContext.destination)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
    } catch (err) {
      console.error('Audio visualization error:', err)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Animate visualizer
  useEffect(() => {
    if (!isPlaying || !analyserRef.current) {
      // Reset to idle animation when not playing
      if (!isPlaying) {
        setAudioData([0.2, 0.15, 0.2])
      }
      return
    }

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const updateVisualization = () => {
      analyser.getByteFrequencyData(dataArray)
      
      // Sample 3 frequency ranges for 3 bars
      const bar1 = dataArray.slice(0, 3).reduce((a, b) => a + b, 0) / 3 / 255
      const bar2 = dataArray.slice(3, 6).reduce((a, b) => a + b, 0) / 3 / 255
      const bar3 = dataArray.slice(6, 9).reduce((a, b) => a + b, 0) / 3 / 255
      
      setAudioData([bar1 || 0.2, bar2 || 0.15, bar3 || 0.2])
      
      animationFrameRef.current = requestAnimationFrame(updateVisualization)
    }

    updateVisualization()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying])

  // Handle play/pause toggle
  const togglePlay = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  return (
    <>
      <button
        onClick={togglePlay}
        className="
          flex items-center gap-2 px-3 py-1
          bg-black/30 backdrop-blur-sm
          border border-white/10
          rounded-full
          hover:bg-black/40 transition-all duration-300
          min-w-[280px] max-w-[400px]
          shadow-lg
        "
        title={`${isPlaying ? 'Pause' : 'Play'} ${title} - ${artist}`}
      >
        {/* Album Art */}
        <div className="w-6 h-6 rounded-full bg-gray-800 flex-shrink-0 overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />
          )}
        </div>

        {/* Play/Pause Icon */}
        <div className="flex-shrink-0">
          {isPlaying ? (
            <Pause size={12} fill="white" className="text-white" />
          ) : (
            <Play size={12} fill="white" className="text-white ml-0.5" />
          )}
        </div>

        {/* Audio Visualizer - 3 bars */}
        <div className="flex items-end gap-0.5 h-3">
          {audioData.map((value, i) => (
            <div
              key={i}
              className="w-0.5 bg-white rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(value * 100, 20)}%`,
                opacity: isPlaying ? 0.9 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Song Title - Truncated */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-xs text-white font-medium truncate">
            {title} - {artist}
          </div>
        </div>
      </button>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </>
  )
}
