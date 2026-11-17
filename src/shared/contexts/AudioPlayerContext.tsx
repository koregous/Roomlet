'use client'

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react'

interface AudioPlayerState {
  audioUrl: string | null
  audioTitle?: string
  audioArtist?: string
  audioCoverUrl?: string
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
}

interface AudioPlayerContextType {
  state: AudioPlayerState
  audioRef: React.RefObject<HTMLAudioElement>
  play: (url: string, title?: string, artist?: string, coverUrl?: string) => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  updateTime: (time: number) => void
  updateDuration: (duration: number) => void
  stop: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null)

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [state, setState] = useState<AudioPlayerState>({
    audioUrl: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    isMuted: false,
  })

  const play = useCallback((url: string, title?: string, artist?: string, coverUrl?: string) => {
    if (audioRef.current) {
      // If it's a different track, load it
      if (state.audioUrl !== url) {
        audioRef.current.src = url
        setState(prev => ({
          ...prev,
          audioUrl: url,
          audioTitle: title,
          audioArtist: artist,
          audioCoverUrl: coverUrl,
          currentTime: 0,
        }))
      }
      
      audioRef.current.play()
      setState(prev => ({ ...prev, isPlaying: true }))
    }
  }, [state.audioUrl])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setState(prev => ({ ...prev, isPlaying: false }))
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause()
    } else if (state.audioUrl && audioRef.current) {
      audioRef.current.play()
      setState(prev => ({ ...prev, isPlaying: true }))
    }
  }, [state.isPlaying, state.audioUrl, pause])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setState(prev => ({ ...prev, currentTime: time }))
    }
  }, [])

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      setState(prev => ({ ...prev, volume, isMuted: false }))
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      const newMuted = !state.isMuted
      audioRef.current.volume = newMuted ? 0 : state.volume
      setState(prev => ({ ...prev, isMuted: newMuted }))
    }
  }, [state.isMuted, state.volume])

  const updateTime = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: time }))
  }, [])

  const updateDuration = useCallback((duration: number) => {
    setState(prev => ({ ...prev, duration }))
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setState({
      audioUrl: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: state.volume,
      isMuted: state.isMuted,
    })
  }, [state.volume, state.isMuted])

  return (
    <AudioPlayerContext.Provider
      value={{
        state,
        audioRef,
        play,
        pause,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        updateTime,
        updateDuration,
        stop,
      }}
    >
      {/* Global audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => updateTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => updateDuration(e.currentTarget.duration)}
        onEnded={() => setState(prev => ({ ...prev, isPlaying: false }))}
        onPlay={() => setState(prev => ({ ...prev, isPlaying: true }))}
        onPause={() => setState(prev => ({ ...prev, isPlaying: false }))}
      />
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
  }
  return context
}
