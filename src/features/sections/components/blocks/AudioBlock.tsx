'use client'

import { useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { Block } from '@/shared/lib/types'
import { useAudioPlayer } from '@/shared/contexts/AudioPlayerContext'

interface Props {
  block: Block
}

export default function AudioBlock({ block }: Props) {
  const { state, play, pause, togglePlay, seek, setVolume, toggleMute } = useAudioPlayer()
  const { audioUrl, audioTitle, audioArtist, audioCoverUrl } = block.content

  if (!audioUrl) {
    return null
  }

  // Check if this block's audio is currently playing
  const isThisAudioPlaying = state.audioUrl === audioUrl && state.isPlaying

  const handlePlayPause = () => {
    if (state.audioUrl === audioUrl) {
      togglePlay()
    } else {
      // Play this new track
      play(audioUrl, audioTitle, audioArtist, audioCoverUrl)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    seek(time)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
  }

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Show progress only if this is the current track
  const currentTime = state.audioUrl === audioUrl ? state.currentTime : 0
  const duration = state.audioUrl === audioUrl ? state.duration : 0

  return (
    <div className="my-6 p-4 bg-gradient-to-br from-gray-900/40 to-gray-950/40 border border-gray-800/40 rounded-lg">
      <div className="flex gap-4 items-start">
        {audioCoverUrl && (
          <img
            src={audioCoverUrl}
            alt={audioTitle || 'Album cover'}
            className="w-20 h-20 rounded object-cover shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          {(audioTitle || audioArtist) && (
            <div className="mb-3">
              {audioTitle && <div className="text-sm font-medium text-gray-200 truncate">{audioTitle}</div>}
              {audioArtist && <div className="text-xs text-gray-500 mt-0.5 truncate">{audioArtist}</div>}
            </div>
          )}

          {/* Progress Bar - only interactive if this is the current track */}
          <div className="mb-3">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={state.audioUrl !== audioUrl}
              className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer
                         disabled:cursor-not-allowed disabled:opacity-50
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-white
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-moz-range-thumb]:w-3
                         [&::-moz-range-thumb]:h-3
                         [&::-moz-range-thumb]:rounded-full
                         [&::-moz-range-thumb]:bg-white
                         [&::-moz-range-thumb]:border-0
                         [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
              aria-label={isThisAudioPlaying ? 'Pause' : 'Play'}
            >
              {isThisAudioPlaying ? (
                <Pause size={18} className="text-white" fill="white" />
              ) : (
                <Play size={18} className="text-white ml-0.5" fill="white" />
              )}
            </button>

            {/* Volume - only show if this is the current track */}
            {state.audioUrl === audioUrl && (
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={toggleMute}
                  className="text-gray-400 hover:text-white transition"
                  aria-label={state.isMuted ? 'Unmute' : 'Mute'}
                >
                  {state.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.isMuted ? 0 : state.volume}
                  onChange={handleVolumeChange}
                  className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:w-2.5
                             [&::-webkit-slider-thumb]:h-2.5
                             [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-gray-400
                             [&::-webkit-slider-thumb]:cursor-pointer
                             [&::-moz-range-thumb]:w-2.5
                             [&::-moz-range-thumb]:h-2.5
                             [&::-moz-range-thumb]:rounded-full
                             [&::-moz-range-thumb]:bg-gray-400
                             [&::-moz-range-thumb]:border-0
                             [&::-moz-range-thumb]:cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
