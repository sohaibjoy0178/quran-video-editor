
import { computeCaptionLayout } from './captionLayout'
import { CaptionSegment } from '../stores/editorStore'

export interface RenderOptions {
  videoPath: string
  audioPath: string | null
  captions: CaptionSegment[]
  captionStyle: any // Use the actual type from store
  videoWidth: number
  videoHeight: number
  videoDuration: number
  audioDuration: number
  metadata?: {
      surah?: string
      verses?: string
  }
  watermark?: {
    path: string
    x: number
    y: number
    width: number
    height: number
    opacity: number
  } | null
  onProgress: (progress: number) => void
}

/**
 * Renders the video using HTML5 Canvas and MediaRecorder.
 * This plays the video in real-time (or as fast as the browser can render)
 * and captures the canvas stream.
 */
export async function renderVideoBrowser(options: RenderOptions): Promise<Blob> {
  const {
    videoPath,
    audioPath,
    captions,
    captionStyle,
    videoWidth,
    videoHeight,
    videoDuration,
    audioDuration,
    metadata,
    watermark,
    onProgress
  } = options

  // 1. Setup Canvas
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = videoWidth
  canvas.height = videoHeight
  const ctx = canvas.getContext('2d')!

  // 2. Setup Video Element
  const video = document.createElement('video')
  video.src = `file://${videoPath}`
  video.crossOrigin = 'anonymous'
  video.muted = true // We capture mixed audio separately
  video.playsInline = true
  
  // Wait for video load
  await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = (e) => reject(e)
      // Timeout fallback
      setTimeout(() => resolve(), 5000)
  })
  
  // Helper to safely play
  const safePlay = async (media: HTMLMediaElement) => {
      try {
          await media.play()
      } catch (e: any) {
          if (e.name !== 'AbortError') {
              console.error('Media play error:', e)
          }
      }
  }

  await safePlay(video)
  video.pause()
  video.currentTime = 0

  // 3. Setup Audio Element (if separate audio track)
  let audio: HTMLAudioElement | null = null
  if (audioPath) {
    audio = document.createElement('audio')
    audio.src = `file://${audioPath}`
    audio.crossOrigin = 'anonymous'
    
    // Wait for audio load
    await new Promise<void>((resolve, reject) => {
        if (!audio) {
            resolve()
            return
        }
        audio.onloadeddata = () => resolve()
        audio.onerror = (e) => reject(e)
        setTimeout(() => resolve(), 5000)
    })

    await safePlay(audio)
    audio.pause()
    audio.currentTime = 0
  }

  // 4. Setup AudioContext for mixing
  const actx = new AudioContext()
  const dest = actx.createMediaStreamDestination()
  
  // Video audio source
  const videoSource = actx.createMediaElementSource(video)
  
  if (audio) {
      const audioSource = actx.createMediaElementSource(audio)
      audioSource.connect(dest)
  } else {
      videoSource.connect(dest)
  }

  // 5. Setup MediaRecorder
  const canvasStream = canvas.captureStream(30) // 30 FPS target
  const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
  ])

  // Try to use high quality settings
  const mimeTypes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
  ]
  const selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
  
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(combinedStream, {
      mimeType: selectedMime,
      videoBitsPerSecond: 8000000 // 8 Mbps
  })

  recorder.ondataavailable = (e) => {
      console.log('Recorder data available:', e.data.size)
      if (e.data.size > 0) chunks.push(e.data)
  }

  recorder.onerror = (e) => console.error('Recorder error:', e)

  // Helper to append to DOM to ensure playback/rendering isn't throttled
  const container = document.createElement('div')
  Object.assign(container.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: '0',
      height: '0',
      overflow: 'hidden',
      zIndex: '-1',
      visibility: 'hidden' 
  })
  document.body.appendChild(container)
  container.appendChild(canvas)
  container.appendChild(video)
  if (audio) container.appendChild(audio)

  return new Promise((resolve, reject) => {
      recorder.onstop = () => {
          const blob = new Blob(chunks, { type: selectedMime })
          console.log('Recorder stopped. Blob size:', blob.size, 'Chunks:', chunks.length)
          resolve(blob)
          // Cleanup
          try {
              actx.close()
              // Elements are removed by removing container
              document.body.removeChild(container)
          } catch (e) {
              console.error('Cleanup error:', e)
          }
      }

      recorder.start()

      // 6. Animation Loop
      // Use the actual duration from the elements we loaded to be safe
      const realVideoDuration = video.duration || 0
      const realAudioDuration = audio ? (audio.duration || 0) : 0
      
      // If audioPath is present, it drives the duration (unless it's 0/invalid)
      // Otherwise video duration.
      let masterDuration = audioPath ? realAudioDuration : realVideoDuration
      
      // Fallback to options if element duration failed for some reason
      if (!masterDuration || isNaN(masterDuration)) {
          masterDuration = audioPath ? audioDuration : videoDuration
      }

      console.log('Starting render loop...', { 
          masterDuration, 
          realVideoDuration, 
          realAudioDuration, 
          optionsVideoDuration: videoDuration, 
          optionsAudioDuration: audioDuration,
          mimeType: selectedMime 
      })

      if (!masterDuration || masterDuration <= 0) {
          recorder.stop()
          reject(new Error('Invalid media duration (0 or NaN). Cannot render.'))
          return
      }
      
      const watermarkImg = new Image()
      if (watermark) {
          watermarkImg.src = `file://${watermark.path}`
      }

      // Pre-render Banner to offscreen canvas
      let bannerCanvas: HTMLCanvasElement | null = null
      if (metadata && metadata.surah) {
          bannerCanvas = document.createElement('canvas')
          bannerCanvas.width = videoWidth
          bannerCanvas.height = videoHeight
          const bannerCtx = bannerCanvas.getContext('2d')!
          drawBanner(bannerCtx, metadata, videoWidth, videoHeight)
      }

      if (audio) {
          safePlay(audio)
      }
      video.loop = true
      safePlay(video)

      const startTime = Date.now()
      let animId = 0
      let lastProgressTime = 0
      
      const draw = () => {
          // Check progress using wall-clock time to avoid loop resets affecting termination
          const now = Date.now()
          const elapsed = (now - startTime) / 1000
          const progress = Math.min(elapsed / masterDuration, 1)
          
          // Throttle progress updates to ~2fps (every 500ms) or on completion
          if (now - lastProgressTime > 500 || progress >= 1) {
              onProgress(progress)
              lastProgressTime = now
          }

          if (elapsed >= masterDuration) {
              console.log('Render complete. Stopping recorder.')
              cancelAnimationFrame(animId)
              
              // Stop everything
              if (recorder.state !== 'inactive') recorder.stop()
              if (audio) audio.pause()
              video.pause()
              return
          }

          // Draw Video
          try {
              ctx.drawImage(video, 0, 0, videoWidth, videoHeight)
          } catch(e) {
             // Occasionally can fail if video not ready, just skip frame
          }

          // Draw Watermark
          if (watermark && watermarkImg.complete) {
              ctx.globalAlpha = watermark.opacity
              ctx.drawImage(watermarkImg, watermark.x, watermark.y, watermark.width, watermark.height)
              ctx.globalAlpha = 1.0
          }
          
          // Draw Banner (Cached)
          if (bannerCanvas) {
              ctx.drawImage(bannerCanvas, 0, 0)
          }

          // Draw Captions
          const syncTime = audio ? audio.currentTime : video.currentTime
          drawCaptions(ctx, syncTime, captions, captionStyle, videoWidth, videoHeight)

          animId = requestAnimationFrame(draw)
      }
      
      animId = requestAnimationFrame(draw)
  })
}

// Helper to wrap text (duplicated to avoid dependency issues for now)
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
}

function drawBanner(
  ctx: CanvasRenderingContext2D, 
  metadata: { surah?: string, verses?: string }, 
  width: number, 
  height: number
) {
  if (!metadata.surah) return

  const scale = height / 1080
  
  // Styles based on CSS
  // .preview__surah-banner top: 12px
  const top = 12 * scale
  // padding: 8px 12px; gap 10px
  const paddingX = 20 * scale
  const gap = 10 * scale
  const iconSize = 18 * scale
  const fontSizeName = 13 * scale
  const fontSizeVerse = 10 * scale
  
  // Measure width to center it
  ctx.font = `600 ${fontSizeName}px "Inter", sans-serif`
  const nameWidth = ctx.measureText(metadata.surah).width
  
  ctx.font = `400 ${fontSizeVerse}px "Inter", sans-serif`
  const verseWidth = metadata.verses ? ctx.measureText(`Ayah ${metadata.verses}`).width : 0
  
  const textColWidth = Math.max(nameWidth, verseWidth)
  
  // Icon width approx (using '﷽' char)
  ctx.font = `${iconSize}px "Amiri", serif`
  const iconWidth = ctx.measureText('﷽').width

  const totalWidth = paddingX * 2 + iconWidth + gap + textColWidth
  const totalHeight = 44 * scale // approx from CSS or calculated

  const x = (width - totalWidth) / 2
  const y = top

  // Draw Pill Background
  // background: rgba(0, 0, 0, 0.55);
  // border: 1px solid rgba(255, 255, 255, 0.12);
  // border-radius: 24px;
  
  ctx.save()
  ctx.beginPath()
  if (ctx.roundRect) {
      ctx.roundRect(x, y, totalWidth, totalHeight, 24 * scale)
  } else {
      ctx.rect(x, y, totalWidth, totalHeight) // Fallback
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.stroke()
  
  // Draw Icon
  // color: rgba(255, 215, 0, 0.9);
  ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'
  ctx.font = `${iconSize}px "Amiri", serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('﷽', x + paddingX, y + totalHeight / 2)
  
  // Draw Text Column
  const textX = x + paddingX + iconWidth + gap
  const textCenterY = y + totalHeight / 2
  
  ctx.textAlign = 'left'
  
  // Name
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${fontSizeName}px "Inter", sans-serif`
  // Adjust Y for stacking. Name slightly above center.
  ctx.textBaseline = 'bottom'
  ctx.fillText(metadata.surah, textX, textCenterY + (metadata.verses ? -1 * scale : 6 * scale))
  
  // Verses
  if (metadata.verses) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.font = `400 ${fontSizeVerse}px "Inter", sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText(`Ayah ${metadata.verses}`, textX, textCenterY + 1 * scale)
  }
  
  ctx.restore()
}

// Debug logging throttle
let lastDebugTime = 0

function drawCaptions(
    ctx: CanvasRenderingContext2D,
    time: number,
    captions: CaptionSegment[],
    style: any,
    width: number,
    height: number
) {
    const active = captions.filter((c) => time >= c.start && time <= c.end)
    
    // Debug logging once every 2 seconds roughly
    const now = Date.now()
    if (now - lastDebugTime > 2000) {
        console.log('Rendering captions debug:', {
            currentTime: time,
            totalCaptions: captions.length,
            activeCount: active.length,
            videoDims: { width, height },
            firstActive: active[0] ? { txt: active[0].arabicLines, start: active[0].start, end: active[0].end } : 'none'
        })
        lastDebugTime = now
    }

    if (active.length === 0) return

    const maxTextWidth = width * 0.95
    // Preview uses fixed 1080p base for scaling logic
    const scale = height / 1080 
    const animName = style.animation || 'none'
    const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3)

    for (const cap of active) {
        const elapsed = Math.max(0, time - cap.start)
        const baseDur = animName === 'cinematic' ? 1.8 : 
                       animName === 'typewriter' || animName === 'pop-in' ? 0.3 : 0.7
        const tRaw = Math.min(elapsed / Math.max(baseDur, 0.001), 1)
        const t = easeOut(tRaw)

        let alpha = 1
        let xOffset = 0
        let yOffset = 0
        let sizeMul = 1

        if (animName !== 'none') {
            alpha = tRaw 
            switch (animName) {
                case 'slide-up': yOffset = (1 - t) * 60 * scale; break
                case 'slide-down': yOffset = -(1 - t) * 60 * scale; break
                case 'slide-left': xOffset = (1 - t) * 120 * scale; break
                case 'slide-right': xOffset = -(1 - t) * 120 * scale; break
                case 'pop-in': sizeMul = 0.3 + 0.7 * t; yOffset = (1 - t) * 15 * scale; break
                case 'bounce-up': yOffset = (1 - t) * 50 * scale * Math.abs(Math.cos(elapsed * 10)); break
                case 'bounce-down': yOffset = -(1 - t) * 50 * scale * Math.abs(Math.cos(elapsed * 10)); break
                case 'elastic-left': xOffset = (1 - t) * 80 * scale * Math.cos(elapsed * 14); break
                case 'elastic-right': xOffset = -(1 - t) * 80 * scale * Math.cos(elapsed * 14); break
                case 'zoom-in': sizeMul = 0.4 + 0.6 * t; break
                case 'zoom-out': sizeMul = 1.6 - 0.6 * t; break
            }
        }

        const arabicFontSize = Math.max(8, Math.round(style.arabicSize * scale * sizeMul))
        const bengaliFontSize = Math.max(8, Math.round(style.bengaliSize * scale * sizeMul))

        ctx.globalAlpha = alpha

        // Draw Arabic
        ctx.font = `700 ${arabicFontSize}px "${style.arabicFont}", serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.direction = 'rtl'
        const wrappedArabic: string[] = []
        for (const line of cap.arabicLines) wrappedArabic.push(...wrapText(ctx, line, maxTextWidth))

        // Draw Bengali
        ctx.font = `600 ${bengaliFontSize}px "${style.bengaliFont}", sans-serif`
        ctx.direction = 'ltr'
        const wrappedBengali: string[] = []
        for (const line of cap.bengaliLines) wrappedBengali.push(...wrapText(ctx, line, maxTextWidth))

        const layout = computeCaptionLayout(
            height, style.positionY, arabicFontSize, wrappedArabic.length,
            bengaliFontSize, wrappedBengali.length, style.gap * scale
        )

        // Render Arabic
        ctx.font = `700 ${arabicFontSize}px "${style.arabicFont}", serif`
        ctx.direction = 'rtl'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        for (let i = 0; i < wrappedArabic.length; i++) {
            const y = layout.arabicY + yOffset + i * (arabicFontSize + 12)
            const x = width / 2 + xOffset
            if (style.strokeWidth > 0) {
                ctx.strokeStyle = style.strokeColor
                ctx.lineWidth = style.strokeWidth * scale
                ctx.lineJoin = 'round'
                ctx.strokeText(wrappedArabic[i], x, y)
            }
            ctx.shadowColor = style.shadowColor
            ctx.shadowBlur = style.shadowBlur * scale
            ctx.fillStyle = style.arabicColor
            ctx.fillText(wrappedArabic[i], x, y)
            ctx.shadowBlur = 0
        }

        // Render Bengali
        ctx.font = `600 ${bengaliFontSize}px "${style.bengaliFont}", sans-serif`
        ctx.direction = 'ltr'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        for (let i = 0; i < wrappedBengali.length; i++) {
            const y = layout.bengaliY + yOffset + i * (bengaliFontSize + 12)
            const x = width / 2 + xOffset
            if (style.strokeWidth > 0) {
                ctx.strokeStyle = style.strokeColor
                ctx.lineWidth = style.strokeWidth * scale
                ctx.lineJoin = 'round'
                ctx.strokeText(wrappedBengali[i], x, y)
            }
            ctx.shadowColor = style.shadowColor
            ctx.shadowBlur = style.shadowBlur * scale
            ctx.fillStyle = style.bengaliColor
            ctx.fillText(wrappedBengali[i], x, y)
            ctx.shadowBlur = 0
        }
        
        ctx.globalAlpha = 1.0
    }
}
