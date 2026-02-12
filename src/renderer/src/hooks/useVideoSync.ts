import { useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../stores/editorStore'

/**
 * Hook for frame-accurate caption sync using requestVideoFrameCallback.
 * Falls back to requestAnimationFrame for browsers without RVFC support.
 */
export function useVideoSync(mediaRef: React.RefObject<HTMLMediaElement | null>) {
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const rafId = useRef<number>(0)

  const onFrame = useCallback(
    (_now: number, metadata: { mediaTime: number }) => {
      setCurrentTime(metadata.mediaTime)
      if (mediaRef.current && 'requestVideoFrameCallback' in mediaRef.current) {
        ;(mediaRef.current as any).requestVideoFrameCallback(onFrame)
      }
    },
    [setCurrentTime, mediaRef]
  )

  const startSync = useCallback(() => {
    const media = mediaRef.current
    if (!media) return

    if ('requestVideoFrameCallback' in media) {
      ;(media as any).requestVideoFrameCallback(onFrame)
    } else {
      // Fallback: rAF-based sync
      // Fallback: rAF-based sync
      const tick = () => {
        if (media && !media.paused) {
          setCurrentTime(media.currentTime)
        }
        rafId.current = requestAnimationFrame(tick)
      }
      rafId.current = requestAnimationFrame(tick)
    }
  }, [mediaRef, onFrame, setCurrentTime])

  const stopSync = useCallback(() => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
      rafId.current = 0
    }
  }, [])

  useEffect(() => {
    return () => stopSync()
  }, [stopSync])

  return { startSync, stopSync }
}
