import { useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../stores/editorStore'

/**
 * Hook for frame-accurate caption sync using requestVideoFrameCallback.
 * Falls back to requestAnimationFrame for browsers without RVFC support.
 */
export function useVideoSync(mediaRef: React.RefObject<HTMLMediaElement | null>): {
  startSync: () => void
  stopSync: () => void
} {
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const rafId = useRef<number>(0)
  const cbRef = useRef<((now: number, metadata: { mediaTime: number }) => void) | null>(null)

  const onFrame = useCallback(
    (now: number, metadata: { mediaTime: number }): void => {
      void now
      setCurrentTime(metadata.mediaTime)
      const media = mediaRef.current
      if (media && 'requestVideoFrameCallback' in media) {
        // Use cbRef to avoid recursion error during variable declaration
        const m = media as unknown as { requestVideoFrameCallback: (cb: unknown) => void }
        m.requestVideoFrameCallback(cbRef.current!)
      }
    },
    [setCurrentTime, mediaRef]
  )

  // Initialize cbRef
  useEffect(() => {
    cbRef.current = onFrame
  }, [onFrame])

  const startSync = useCallback((): void => {
    const media = mediaRef.current
    if (!media) return

    if ('requestVideoFrameCallback' in media) {
      const m = media as unknown as { requestVideoFrameCallback: (cb: unknown) => void }
      m.requestVideoFrameCallback(onFrame)
    } else {
      const tick = (): void => {
        if (media && !media.paused) {
          setCurrentTime(media.currentTime)
        }
        rafId.current = requestAnimationFrame(tick)
      }
      rafId.current = requestAnimationFrame(tick)
    }
  }, [mediaRef, onFrame, setCurrentTime])

  const stopSync = useCallback((): void => {
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
