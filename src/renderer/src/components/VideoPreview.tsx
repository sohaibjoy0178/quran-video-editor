import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { computeCaptionLayout, formatTimestamp } from '../utils/captionLayout'
import { WatermarkOverlay } from './WatermarkOverlay'

/**
 * VideoPreview - native HTML5 <video> + <audio>
 *
 * - audioPath present -> <audio> is master clock, <video> loops silently
 * - only videoPath    -> <video> is master clock
 */
export function VideoPreview(): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const videoPath = useEditorStore((s) => s.videoPath)
  const audioPath = useEditorStore((s) => s.audioPath)
  const currentTime = useEditorStore((s) => s.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)
  const captions = useEditorStore((s) => s.captions)
  const captionStyle = useEditorStore((s) => s.captionStyle)
  const videoDuration = useEditorStore((s) => s.videoDuration)
  const audioDuration = useEditorStore((s) => s.audioDuration)
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration)
  const videoWidth = useEditorStore((s) => s.videoWidth)
  const videoHeight = useEditorStore((s) => s.videoHeight)
  const setVideoResolution = useEditorStore((s) => s.setVideoResolution)
  const metadata = useEditorStore((s) => s.metadata)
  const renderSettings = useEditorStore((s) => s.renderSettings)

  const [containerSize, setContainerSize] = useState({ width: 800, height: 450 })
  const [bannerVisible, setBannerVisible] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)

  const masterDuration = audioPath && audioDuration > 0 ? audioDuration : videoDuration
  // If we have separate audio, the video is treated as background and should always loop
  const shouldLoopBackground = !!audioPath

  const previewSize = useMemo(() => {
    const aspect = videoWidth / (videoHeight || 1)
    const maxW = containerSize.width - 32
    const maxH = containerSize.height - 32
    let w = maxW
    let h = w / aspect
    if (h > maxH) {
      h = maxH
      w = h * aspect
    }
    return { width: Math.round(w), height: Math.round(h) }
  }, [videoWidth, videoHeight, containerSize])

  const previewVideoFilter = useMemo((): string => {
    switch (renderSettings.videoFilter) {
      case 'cinematic':
        return 'contrast(1.18) saturate(0.82) brightness(0.97)'
      case 'bw':
        return 'grayscale(1) contrast(1.08) brightness(1.02)'
      case 'warm':
        return 'sepia(0.15) saturate(1.1) hue-rotate(-8deg)'
      case 'cool':
        return 'saturate(1.05) hue-rotate(10deg) brightness(0.95)'
      default:
        return 'none'
    }
  }, [renderSettings.videoFilter])

  useEffect((): (() => void) | void => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Wait for Google Fonts (Amiri, Noto Sans Bengali) to finish loading
  // so the canvas can properly shape Arabic/Bengali text.
  useEffect((): void => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])

  useEffect((): (() => void) | void => {
    const video = videoRef.current
    if (!video || !videoPath) return

    const onMeta = (): void => {
      setVideoDuration(video.duration || 0)
      setVideoResolution(video.videoWidth || 1920, video.videoHeight || 1080)
    }
    video.addEventListener('loadedmetadata', onMeta)
    return () => video.removeEventListener('loadedmetadata', onMeta)
  }, [videoPath, setVideoDuration, setVideoResolution])

  useEffect((): void | (() => void) => {
    if (metadata?.surah) {
      const timer = setTimeout(() => setBannerVisible(true), 100)
      return () => {
        clearTimeout(timer)
      }
    }
    return undefined
  }, [metadata?.surah])

  // Reset banner visibility when surah changes.
  useEffect((): void => {
    // We use a microtask to avoid the synchronous setState warning
    Promise.resolve().then(() => setBannerVisible(false))
  }, [metadata?.surah])

  useEffect((): (() => void) => {
    const tick = (): void => {
      const master = audioPath ? audioRef.current : videoRef.current
      if (master && !master.paused) {
        setCurrentTime(master.currentTime)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [audioPath, videoPath, setCurrentTime])

  useEffect((): void => {
    const master = audioPath ? audioRef.current : videoRef.current
    if (!master) return

    if (isPlaying) {
      master.play().catch(() => { })
      if (audioPath && videoRef.current) {
        videoRef.current.play().catch(() => { })
      }
    } else {
      master.pause()
      if (audioPath && videoRef.current) {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, audioPath, videoPath])

  useEffect((): void => {
    const effectiveVolume = isMuted ? 0 : volume
    if (audioRef.current) audioRef.current.volume = effectiveVolume
    if (videoRef.current) videoRef.current.volume = effectiveVolume
  }, [volume, isMuted])

  useEffect((): (() => void) | void => {
    const master = audioPath ? audioRef.current : videoRef.current
    if (!master) return

    const handleEnded = (): void => {
      setIsPlaying(false)
      const endTime = masterDuration > 0 ? masterDuration : master.currentTime
      setCurrentTime(endTime)
      if (videoRef.current && audioPath) {
        videoRef.current.pause()
      }
    }

    master.addEventListener('ended', handleEnded)
    return () => {
      master.removeEventListener('ended', handleEnded)
    }
  }, [audioPath, masterDuration, setCurrentTime, setIsPlaying, videoPath])

  useEffect((): void => {
    const master = audioPath ? audioRef.current : videoRef.current
    if (!master) return
    if (Math.abs(master.currentTime - currentTime) > 0.3) {
      master.currentTime = currentTime
    }
  }, [currentTime, audioPath, videoPath])

  const wrapText = useCallback(
    (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
      if (!text) return []
      const measured = ctx.measureText(text)
      if (measured.width <= maxWidth) return [text]

      const words = text.split(/\s+/)
      const lines: string[] = []
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const testWidth = ctx.measureText(testLine).width
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) lines.push(currentLine)
      return lines.length > 0 ? lines : [text]
    },
    []
  )

  // Keep a ref synced to the latest store currentTime so the draw loop
  // can always read the most recent value without being in the dep array.
  const currentTimeRef = useRef(currentTime)
  useEffect((): void => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  useEffect((): (() => void) => {
    const canvas = canvasRef.current
    if (!canvas) return (): void => { }

    let animId = 0
    const drawCaptions = (): void => {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        animId = requestAnimationFrame(drawCaptions)
        return
      }

      if (canvas.width !== previewSize.width || canvas.height !== previewSize.height) {
        canvas.width = previewSize.width
        canvas.height = previewSize.height
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Use the master element's currentTime when playing for smooth sync,
      // fall back to the store's currentTime (via ref) when paused/seeking.
      const master = audioPath ? audioRef.current : videoRef.current
      const time = master && !master.paused ? master.currentTime : currentTimeRef.current
      const active = captions.filter((c) => time >= c.start && time <= c.end)
      if (active.length === 0) {
        animId = requestAnimationFrame(drawCaptions)
        return
      }

      const maxTextWidth = previewSize.width * 0.95
      const scale = previewSize.height / 1080
      const animName = captionStyle.animation || 'none'

      // Smooth ease-out cubic function for natural motion
      const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3)

      for (const cap of active) {
        const elapsed = Math.max(0, time - cap.start)
        const baseDur =
          animName === 'cinematic'
            ? 1.8
            : animName === 'typewriter' || animName === 'pop-in'
              ? 0.3
              : 0.7
        const tRaw = Math.min(elapsed / Math.max(baseDur, 0.001), 1)
        const t = easeOut(tRaw) // Apply easing for smooth motion

        let alpha = 1
        let xOffset = 0
        let yOffset = 0
        let sizeMul = 1

        if (animName !== 'none') {
          alpha = tRaw // Keep linear alpha for smooth fade
          switch (animName) {
            case 'slide-up':
              yOffset = (1 - t) * 60 * scale
              break
            case 'slide-down':
              yOffset = -(1 - t) * 60 * scale
              break
            case 'slide-left':
              xOffset = (1 - t) * 120 * scale
              break
            case 'slide-right':
              xOffset = -(1 - t) * 120 * scale
              break
            case 'pop-in':
              sizeMul = 0.3 + 0.7 * t
              yOffset = (1 - t) * 15 * scale
              break
            case 'bounce-up':
              yOffset = (1 - t) * 50 * scale * Math.abs(Math.cos(elapsed * 10))
              break
            case 'bounce-down':
              yOffset = -(1 - t) * 50 * scale * Math.abs(Math.cos(elapsed * 10))
              break
            case 'elastic-left':
              xOffset = (1 - t) * 80 * scale * Math.cos(elapsed * 14)
              break
            case 'elastic-right':
              xOffset = -(1 - t) * 80 * scale * Math.cos(elapsed * 14)
              break
            case 'zoom-in':
              sizeMul = 0.4 + 0.6 * t
              break
            case 'zoom-out':
              sizeMul = 1.6 - 0.6 * t
              break
          }
        }

        const arabicFontSize = Math.max(8, Math.round(captionStyle.arabicSize * scale * sizeMul))
        const bengaliFontSize = Math.max(8, Math.round(captionStyle.bengaliSize * scale * sizeMul))

        ctx.font = `700 ${arabicFontSize}px "${captionStyle.arabicFont}", serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.direction = 'rtl'

        const wrappedArabic: string[] = []
        for (const line of cap.arabicLines) {
          wrappedArabic.push(...wrapText(ctx, line, maxTextWidth))
        }

        ctx.font = `600 ${bengaliFontSize}px "${captionStyle.bengaliFont}", sans-serif`
        const wrappedBengali: string[] = []
        for (const line of cap.bengaliLines) {
          wrappedBengali.push(...wrapText(ctx, line, maxTextWidth))
        }

        const layout = computeCaptionLayout(
          previewSize.height,
          captionStyle.positionY,
          arabicFontSize,
          wrappedArabic.length,
          bengaliFontSize,
          wrappedBengali.length,
          captionStyle.gap * scale
        )

        ctx.globalAlpha = alpha

        ctx.font = `700 ${arabicFontSize}px "${captionStyle.arabicFont}", serif`
        ctx.direction = 'rtl'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        for (let i = 0; i < wrappedArabic.length; i++) {
          const y = layout.arabicY + yOffset + i * (arabicFontSize + 12)
          const x = previewSize.width / 2 + xOffset

          if (captionStyle.strokeWidth > 0) {
            ctx.strokeStyle = captionStyle.strokeColor
            ctx.lineWidth = captionStyle.strokeWidth * scale
            ctx.lineJoin = 'round'
            ctx.strokeText(wrappedArabic[i], x, y)
          }
          ctx.shadowColor = captionStyle.shadowColor
          ctx.shadowBlur = captionStyle.shadowBlur * scale
          ctx.fillStyle = captionStyle.arabicColor
          ctx.fillText(wrappedArabic[i], x, y)
          ctx.shadowBlur = 0
        }

        ctx.font = `600 ${bengaliFontSize}px "${captionStyle.bengaliFont}", sans-serif`
        ctx.direction = 'ltr'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        for (let i = 0; i < wrappedBengali.length; i++) {
          const y = layout.bengaliY + yOffset + i * (bengaliFontSize + 12)
          const x = previewSize.width / 2 + xOffset

          if (captionStyle.strokeWidth > 0) {
            ctx.strokeStyle = captionStyle.strokeColor
            ctx.lineWidth = captionStyle.strokeWidth * scale
            ctx.lineJoin = 'round'
            ctx.strokeText(wrappedBengali[i], x, y)
          }
          ctx.shadowColor = captionStyle.shadowColor
          ctx.shadowBlur = captionStyle.shadowBlur * scale
          ctx.fillStyle = captionStyle.bengaliColor
          ctx.fillText(wrappedBengali[i], x, y)
          ctx.shadowBlur = 0
        }
      }

      ctx.globalAlpha = 1
      animId = requestAnimationFrame(drawCaptions)
    }

    animId = requestAnimationFrame(drawCaptions)
    return () => cancelAnimationFrame(animId)
  }, [captions, captionStyle, previewSize, audioPath, wrapText, fontsReady, videoPath])

  const togglePlay = useCallback((): void => {
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const time = parseFloat(e.target.value)
      setCurrentTime(time)
      const master = audioPath ? audioRef.current : videoRef.current
      if (master) master.currentTime = time
    },
    [audioPath, setCurrentTime]
  )

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const next = Math.max(0, Math.min(1, parseFloat(e.target.value)))
      setVolume(next)
      if (next > 0 && isMuted) setIsMuted(false)
    },
    [isMuted]
  )

  const toggleMute = useCallback((): void => {
    setIsMuted((prev) => !prev)
  }, [])

  if (!videoPath) {
    return (
      <div className="preview" ref={containerRef}>
        <div className="preview__empty">
          <div className="preview__empty-icon">🎬</div>
          <div>Import a video to get started</div>
        </div>
      </div>
    )
  }

  return (
    <div className="preview" ref={containerRef}>
      {audioPath && (
        <audio
          ref={audioRef}
          src={audioPath.startsWith('blob:') || audioPath.startsWith('http') ? audioPath : `file://${audioPath}`}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}

      <div
        className="preview__container"
        style={{ width: previewSize.width, height: previewSize.height }}
      >
        <video
          ref={videoRef}
          className="preview__video"
          src={`file://${videoPath}`}
          muted={!!audioPath || isMuted}
          loop={shouldLoopBackground}
          playsInline
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: previewVideoFilter
          }}
        />

        {metadata?.surah && (
          <div
            className={`preview__surah-banner ${bannerVisible ? 'preview__surah-banner--visible' : ''}`}
          >
            <span className="preview__surah-icon">﷽</span>
            <div className="preview__surah-info">
              <span className="preview__surah-name">{metadata.surah}</span>
              {metadata.verses && (
                <span className="preview__surah-verses">Ayah {metadata.verses}</span>
              )}
            </div>
          </div>
        )}

        <WatermarkOverlay previewWidth={previewSize.width} />
        <canvas
          ref={canvasRef}
          className="preview__caption-overlay"
          width={previewSize.width}
          height={previewSize.height}
        />
        <div className="preview__controls">
          <button className="btn btn--ghost btn--icon" onClick={togglePlay}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span className="preview__time">
            {formatTimestamp(currentTime)} / {formatTimestamp(masterDuration)}
          </span>
          <input
            type="range"
            className="preview__seek"
            min={0}
            max={masterDuration || 1}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
          />
          <div className="preview__volume-wrap">
            <button
              className="btn btn--ghost btn--icon preview__volume-icon"
              onClick={toggleMute}
              title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              type="range"
              className="preview__volume"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              title={`Volume ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
