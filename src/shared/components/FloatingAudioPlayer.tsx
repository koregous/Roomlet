'use client'

import { Play, Pause, X } from 'lucide-react'
import { useAudioPlayer } from '@/shared/contexts/AudioPlayerContext'

export default function FloatingAudioPlayer() {
  const { state, togglePlay, stop } = useAudioPlayer()

  // Don't show if no audio is loaded
  if (!state.audioUrl) return null

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-slideUp">
      <div className="flex items-center gap-3 bg-gradient-to-br from-gray-900 to-black border border-gray-700 rounded-full px-4 py-3 shadow-2xl backdrop-blur-sm">
        {state.audioCoverUrl && (
          <img
            src={state.audioCoverUrl}
            alt="Album cover"
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
        )}

        <div className="flex flex-col min-w-0 max-w-[200px]">
          {state.audioTitle && (
            <div className="text-sm font-medium text-white truncate">
              {state.audioTitle}
            </div>
          )}
          {state.audioArtist && (
            <div className="text-xs text-gray-400 truncate">
              {state.audioArtist}
            </div>
          )}
          {!state.audioTitle && !state.audioArtist && (
            <div className="text-sm text-gray-400">Playing audio...</div>
          )}
          <div className="text-[10px] text-gray-600">
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </div>
        </div>

        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition shrink-0"
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
        >
          {state.isPlaying ? (
            <Pause size={16} className="text-white" fill="white" />
          ) : (
            <Play size={16} className="text-white ml-0.5" fill="white" />
          )}
        </button>

        <button
          onClick={stop}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition text-gray-400 hover:text-white shrink-0"
          aria-label="Stop"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
