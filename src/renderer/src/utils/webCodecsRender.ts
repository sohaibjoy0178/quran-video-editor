import { computeCaptionLayout, CaptionLayout } from './captionLayout'
import { CaptionSegment, CaptionStyle } from '../stores/editorStore'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

interface RenderOptions {
  videoPath: string
  audioPath: string | null
  captions: CaptionSegment[]
  captionStyle: CaptionStyle
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
  aspectRatio?: '16:9' | '9:16' | '1:1'
  renderSettings: {
    encoder: string
    bitrate: string
    enableSlowMo: boolean
    slowMoFps: number
    videoFilter: string
    crossfadeEnabled: boolean
  }
  onProgress: (progress: number) => void
  appendDiagnostic?: (line: string) => void
}

function parseBitrate(bitrate: string): number {
  const num = parseFloat(bitrate)
  if (bitrate.toLowerCase().includes('m')) return num * 1_000_000
  if (bitrate.toLowerCase().includes('k')) return num * 1_000
  return num || 8_000_000
}

interface PreparedCaption {
  id: string
  start: number
  end: number
  wrappedArabic: string[]
  wrappedBengali: string[]
  layout: CaptionLayout
  arabicFontSize: number
  bengaliFontSize: number
}

// ─── HTMLVideoElement Frame Grabber ──────────────────────────────────────
// This is the professional approach: use the browser's native video decoder
// (same path as the preview player) instead of manual WebCodecs decoding.

/**
 * Create an offscreen <video> element and wait for it to be ready.
 */
async function createVideoElement(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true
  // Electron file:// protocol
  video.src = src.startsWith('blob:') || src.startsWith('http')
    ? src
    : `file://${src}`

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = (): void => resolve()
    video.onerror = (): void => reject(new Error(`Failed to load video: ${src}`))
  })

  return video
}

/**
 * Seek a <video> element to a specific time and wait for the frame to be ready.
 * Returns when the video has seeked and the frame is available for drawing.
 * Includes timeout protection and time clamping for robustness.
 */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  // Clamp time to valid range (avoid seeking past end or before start)
  const clampedTime = Math.max(0, Math.min(time, video.duration - 0.01 || 0))

  return new Promise<void>((resolve) => {
    // If already at target time (within ~1ms), resolve immediately
    if (Math.abs(video.currentTime - clampedTime) < 0.001) {
      resolve()
      return
    }

    // Timeout protection: resolve after 2s even if seeked event doesn't fire
    const timeout = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }, 2000)

    const onSeeked = (): void => {
      clearTimeout(timeout)
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = clampedTime
  })
}

// ─── Main Render Function ────────────────────────────────────────────────

export async function renderVideoWebCodecs(options: RenderOptions): Promise<Blob> {
  const {
    videoPath, audioPath, captions, captionStyle,
    videoWidth, videoHeight, videoDuration,
    metadata, watermark, renderSettings,
    onProgress
  } = options

  const log = (msg: string): void => {
    console.log(`[WebCodecs] ${msg}`)
    options.appendDiagnostic?.(msg)
  }

  // 1. Determine output resolution from user-selected aspect ratio
  const aspectRatio = options.aspectRatio || '9:16'
  let targetWidth = 1920
  let targetHeight = 1080
  if (aspectRatio === '9:16') {
    targetWidth = 1080
    targetHeight = 1920
  } else if (aspectRatio === '1:1') {
    targetWidth = 1080
    targetHeight = 1080
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d', { alpha: false })!

  log(`📐 Output: ${targetWidth}×${targetHeight} (${aspectRatio})`)

  // 2. Load video using native <video> element (same as preview!)
  log('📂 Loading video source...')
  const video = await createVideoElement(videoPath)
  const srcDuration = video.duration || videoDuration
  log(`🎞️ Video Ready: ${video.videoWidth}×${video.videoHeight}, ${srcDuration.toFixed(2)}s`)

  // Optional: second video element for crossfade blending
  let videoB: HTMLVideoElement | null = null
  const useCrossfade = renderSettings.crossfadeEnabled
  const crossfadeDuration = 1.0
  if (useCrossfade && srcDuration > 2.0) {
    videoB = await createVideoElement(videoPath)
    log('🔄 Crossfade video loaded')
  }

  // 3. Decode Audio
  const actx = new AudioContext()
  let audioData: AudioBuffer | null = null
  let audioSampleRate = 44100
  let audioChannels = 2
  if (audioPath) {
    const audioSrc = audioPath.startsWith('blob:') || audioPath.startsWith('http')
      ? audioPath
      : `file://${audioPath}`
    const resp = await fetch(audioSrc)
    audioData = await actx.decodeAudioData(await resp.arrayBuffer())
    audioSampleRate = audioData.sampleRate
    audioChannels = Math.min(audioData.numberOfChannels, 2)
    log(`🔊 Audio: ${audioSampleRate}Hz, ${audioChannels}ch, ${audioData.duration.toFixed(2)}s`)
  }

  // 4. Setup Encoder + Muxer
  if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs not supported')

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: targetWidth, height: targetHeight },
    audio: audioData
      ? { codec: 'aac', numberOfChannels: audioChannels, sampleRate: audioSampleRate }
      : undefined,
    fastStart: 'in-memory'
  })

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('Encoder Error:', e)
  })

  const FPS = 30
  const encoderConfig: VideoEncoderConfig = {
    codec: 'avc1.640028',
    width: targetWidth,
    height: targetHeight,
    bitrate: parseBitrate(renderSettings.bitrate),
    framerate: FPS,
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'annexb' }
  }
  try {
    videoEncoder.configure(encoderConfig)
    log('🖥️ Encoder: hardware acceleration')
  } catch {
    log('⚠️ Hardware encoder failed, falling back to software')
    videoEncoder.configure({ ...encoderConfig, hardwareAcceleration: 'no-preference' })
  }

  let audioEncoder: AudioEncoder | null = null
  if (audioData) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => console.error('AudioEncoder error:', e)
    })
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: audioChannels,
      sampleRate: audioSampleRate,
      bitrate: 192000
    })
  }

  // 5. Prepare Overlays
  const scale = targetHeight / 1080
  const maxTextWidth = targetWidth * 0.95
  const preparedCaptions = prepareCaptions(captions, captionStyle, ctx, maxTextWidth, targetHeight, scale)
  const bannerCanvas = prepareBanner(metadata, targetWidth, targetHeight)
  const watermarkImg = await loadWatermark(watermark)

  // ─── RENDER LOOP ──────────────────────────────────────────────────────
  const masterDuration = audioData ? audioData.duration : srcDuration
  const totalFrames = Math.ceil(masterDuration * FPS)
  const frameInterval = 1 / FPS

  log(`🎬 Render: ${totalFrames} frames @ ${FPS}fps, duration: ${masterDuration.toFixed(2)}s`)
  const renderStartTime = performance.now()

  // Video filter setup
  const videoFilter = renderSettings.videoFilter || 'none'
  const getFilterCSS = (): string => {
    switch (videoFilter) {
      case 'cinematic': return 'contrast(1.18) saturate(0.82) brightness(0.97)'
      case 'bw': return 'grayscale(1) contrast(1.08) brightness(1.02)'
      case 'warm': return 'sepia(0.15) saturate(1.1) hue-rotate(-8deg)'
      case 'cool': return 'saturate(1.05) hue-rotate(10deg) brightness(0.95)'
      default: return 'none'
    }
  }

  const drawVideoFrame = (
    source: HTMLVideoElement,
    alpha: number
  ): void => {
    if (alpha <= 0.01) return

    const bmpWidth = source.videoWidth
    const bmpHeight = source.videoHeight

    ctx.save()
    ctx.globalAlpha = alpha

    // Apply video filter
    const filterVal = getFilterCSS()
    if (filterVal !== 'none') ctx.filter = filterVal

    // Crop/Fill to target aspect ratio
    const sAR = bmpWidth / bmpHeight
    const tAR = targetWidth / targetHeight
    let sx = 0, sy = 0, sw = bmpWidth, sh = bmpHeight
    if (sAR > tAR) {
      sw = bmpHeight * tAR
      sx = (bmpWidth - sw) / 2
    } else {
      sh = bmpWidth / tAR
      sy = (bmpHeight - sh) / 2
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
    ctx.filter = 'none'
    ctx.restore()
  }

  for (let f = 0; f < totalFrames; f++) {
    const elapsed = f * frameInterval
    const timeInLoop = elapsed % srcDuration

    // Seek main video to exact frame time
    await seekTo(video, timeInLoop)

    // Determine crossfade
    let alphaA = 1
    let alphaB = 0

    if (useCrossfade && videoB && srcDuration > 2.0) {
      const fadeStart = srcDuration - crossfadeDuration
      if (timeInLoop > fadeStart) {
        const fadeProg = (timeInLoop - fadeStart) / crossfadeDuration
        alphaA = 1 - fadeProg
        alphaB = fadeProg
        // Seek second video to early part for blending
        const blendTime = (timeInLoop - fadeStart)
        await seekTo(videoB, blendTime)
      }
    }

    // DRAW
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, targetWidth, targetHeight)
    drawVideoFrame(video, alphaA)
    if (alphaB > 0 && videoB) drawVideoFrame(videoB, alphaB)

    // Overlays
    if (watermark && watermarkImg) {
      const wmScaleX = targetWidth / (videoWidth || targetWidth)
      const wmScaleY = targetHeight / (videoHeight || targetHeight)
      ctx.save()
      ctx.globalAlpha = watermark.opacity
      ctx.drawImage(
        watermarkImg,
        watermark.x * wmScaleX,
        watermark.y * wmScaleY,
        watermark.width * wmScaleX,
        watermark.height * wmScaleY
      )
      ctx.restore()
    }
    if (bannerCanvas) ctx.drawImage(bannerCanvas, 0, 0)
    renderPreparedCaptions(ctx, elapsed, preparedCaptions, captionStyle, targetWidth, scale)

    // ENCODE
    const vFrame = new VideoFrame(canvas, {
      timestamp: elapsed * 1_000_000,
      duration: frameInterval * 1_000_000
    })
    videoEncoder.encode(vFrame, { keyFrame: f % 150 === 0 })
    vFrame.close()

    // AUDIO
    if (audioEncoder && audioData) {
      encodeAudioSegment(audioEncoder, audioData, elapsed, frameInterval, audioChannels)
    }

    // BACKPRESSURE
    if (videoEncoder.encodeQueueSize > 5) {
      while (videoEncoder.encodeQueueSize > 2) {
        await new Promise((r) => setTimeout(r, 1))
      }
    }

    // PROGRESS
    if (f % 10 === 0) onProgress(f / totalFrames)
    if (f > 0 && f % 30 === 0) {
      const sec = (performance.now() - renderStartTime) / 1000
      const fps = f / sec
      const pct = ((f / totalFrames) * 100).toFixed(0)
      log(`📊 ${pct}% - ${fps.toFixed(1)}fps`)
    }
  }

  onProgress(1)
  log('✅ Finalizing...')
  await Promise.all([videoEncoder.flush(), audioEncoder?.flush()])
  videoEncoder.close()
  audioEncoder?.close()
  muxer.finalize()

  // Cleanup video elements and audio context
  video.src = ''
  video.load()
  if (videoB) {
    videoB.src = ''
    videoB.load()
  }
  actx.close().catch(() => {})

  const { buffer } = muxer.target as { buffer: ArrayBuffer }
  const blob = new Blob([buffer], { type: 'video/mp4' })
  log(`🎉 Done. ${(blob.size / 1024 / 1024).toFixed(1)}MB`)
  return blob
}

// ─── Caption Helpers (unchanged) ─────────────────────────────────────────

function prepareCaptions(
  captions: CaptionSegment[],
  style: CaptionStyle,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number
): PreparedCaption[] {
  return captions.map((cap) => {
    const arabicFontSize = Math.max(8, Math.round(style.arabicSize * scale))
    const bengaliFontSize = Math.max(8, Math.round(style.bengaliSize * scale))

    ctx.font = `700 ${arabicFontSize}px "${style.arabicFont}", serif`
    const wrappedArabic: string[] = []
    for (const line of cap.arabicLines) wrappedArabic.push(...wrapText(ctx, line, width))

    ctx.font = `600 ${bengaliFontSize}px "${style.bengaliFont}", sans-serif`
    const wrappedBengali: string[] = []
    for (const line of cap.bengaliLines) wrappedBengali.push(...wrapText(ctx, line, width))

    const layout = computeCaptionLayout(
      height,
      style.positionY,
      arabicFontSize,
      wrappedArabic.length,
      bengaliFontSize,
      wrappedBengali.length,
      style.gap * scale
    )
    return {
      id: cap.id,
      start: cap.start,
      end: cap.end,
      wrappedArabic,
      wrappedBengali,
      layout,
      arabicFontSize,
      bengaliFontSize
    }
  })
}

function renderPreparedCaptions(
  ctx: CanvasRenderingContext2D,
  time: number,
  prepared: PreparedCaption[],
  style: CaptionStyle,
  width: number,
  scale: number
): void {
  const active = prepared.filter((c) => time >= c.start && time <= c.end)
  if (active.length === 0) return
  const animName = style.animation || 'none'
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
    const t = easeOut(tRaw)
    let alpha = 1
    let xOffset = 0
    let yOffset = 0
    let sizeMul = 1

    if (animName !== 'none') {
      alpha = tRaw
      if (animName === 'slide-up') yOffset = (1 - t) * 60 * scale
      if (animName === 'slide-down') yOffset = -(1 - t) * 60 * scale
      if (animName === 'slide-left') xOffset = (1 - t) * 120 * scale
      if (animName === 'slide-right') xOffset = -(1 - t) * 120 * scale
      if (animName === 'pop-in') {
        sizeMul = 0.3 + 0.7 * t
        yOffset = (1 - t) * 15 * scale
      }
      if (animName === 'bounce-up') yOffset = (1 - t) * 50 * scale * Math.abs(Math.cos(elapsed * 10))
      if (animName === 'bounce-down') yOffset = -(1 - t) * 50 * scale * Math.abs(Math.cos(elapsed * 10))
      if (animName === 'elastic-left') xOffset = (1 - t) * 80 * scale * Math.cos(elapsed * 14)
      if (animName === 'elastic-right') xOffset = -(1 - t) * 80 * scale * Math.cos(elapsed * 14)
      if (animName === 'zoom-in') sizeMul = 0.4 + 0.6 * t
      if (animName === 'zoom-out') sizeMul = 1.6 - 0.6 * t
    }

    ctx.save()
    ctx.globalAlpha = alpha
    const aFS = Math.round(cap.arabicFontSize * sizeMul)
    const bFS = Math.round(cap.bengaliFontSize * sizeMul)

    ctx.font = `700 ${aFS}px "${style.arabicFont}", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.direction = 'rtl'
    ctx.fillStyle = style.arabicColor
    for (let i = 0; i < cap.wrappedArabic.length; i++) {
      const y = cap.layout.arabicY + yOffset + i * (aFS + 12)
      const x = width / 2 + xOffset
      if (style.strokeWidth > 0) {
        ctx.strokeStyle = style.strokeColor
        ctx.lineWidth = style.strokeWidth * scale
        ctx.lineJoin = 'round'
        ctx.strokeText(cap.wrappedArabic[i], x, y)
      }
      ctx.shadowColor = style.shadowColor
      ctx.shadowBlur = style.shadowBlur * scale
      ctx.fillText(cap.wrappedArabic[i], x, y)
      ctx.shadowBlur = 0
    }

    ctx.font = `600 ${bFS}px "${style.bengaliFont}", sans-serif`
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = style.bengaliColor
    for (let i = 0; i < cap.wrappedBengali.length; i++) {
      const y = cap.layout.bengaliY + yOffset + i * (bFS + 12)
      const x = width / 2 + xOffset
      if (style.strokeWidth > 0) {
        ctx.strokeStyle = style.strokeColor
        ctx.lineWidth = style.strokeWidth * scale
        ctx.lineJoin = 'round'
        ctx.strokeText(cap.wrappedBengali[i], x, y)
      }
      ctx.shadowColor = style.shadowColor
      ctx.shadowBlur = style.shadowBlur * scale
      ctx.fillText(cap.wrappedBengali[i], x, y)
      ctx.shadowBlur = 0
    }
    ctx.restore()
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return []
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = test
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

// ─── Banner & Watermark Helpers (unchanged) ──────────────────────────────

function prepareBanner(
  metadata: RenderOptions['metadata'],
  width: number,
  height: number
): HTMLCanvasElement | null {
  if (!metadata || !metadata.surah) return null
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  drawBanner(c.getContext('2d')!, metadata, width, height)
  return c
}

function drawBanner(
  ctx: CanvasRenderingContext2D,
  metadata: NonNullable<RenderOptions['metadata']>,
  width: number,
  height: number
): void {
  const scale = height / 1080
  const top = 12 * scale
  const paddingX = 20 * scale
  const gap = 10 * scale
  const iconSize = 18 * scale
  const fontSizeName = 13 * scale
  const fontSizeVerse = 10 * scale

  ctx.font = `600 ${fontSizeName}px "Inter", sans-serif`
  const nameWidth = ctx.measureText(metadata.surah || '').width
  ctx.font = `400 ${fontSizeVerse}px "Inter", sans-serif`
  const verseWidth = metadata.verses ? ctx.measureText(`Ayah ${metadata.verses}`).width : 0
  const textColWidth = Math.max(nameWidth, verseWidth)
  ctx.font = `${iconSize}px "Amiri", serif`
  const iconWidth = ctx.measureText('﷽').width

  const totalWidth = paddingX * 2 + iconWidth + gap + textColWidth
  const totalHeight = 44 * scale
  const x = (width - totalWidth) / 2
  const y = top

  ctx.save()
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, totalWidth, totalHeight, 24 * scale)
  else ctx.rect(x, y, totalWidth, totalHeight)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'
  ctx.font = `${iconSize}px "Amiri", serif`
  ctx.textBaseline = 'middle'
  ctx.fillText('﷽', x + paddingX, y + totalHeight / 2)

  const textX = x + paddingX + iconWidth + gap
  const textCenterY = y + totalHeight / 2
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${fontSizeName}px "Inter", sans-serif`
  ctx.textBaseline = 'bottom'
  ctx.fillText(
    metadata.surah || '',
    textX,
    textCenterY + (metadata.verses ? -1 * scale : 6 * scale)
  )

  if (metadata.verses) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = `400 ${fontSizeVerse}px "Inter", sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(`Ayah ${metadata.verses}`, textX, textCenterY + 1 * scale)
  }
  ctx.restore()
}

async function loadWatermark(
  w: RenderOptions['watermark']
): Promise<HTMLImageElement | null> {
  if (!w) return null
  const img = new Image()
  let path = w.path
  if (path.includes('\\')) path = path.replace(/\\/g, '/')
  if (!path.startsWith('/')) path = '/' + path
  img.src = `file://${path}`
  await new Promise<void>((r) => {
    img.onload = (): void => r()
    img.onerror = (): void => r()
  })
  return img.complete ? img : null
}

// ─── Audio Encoder Helper (unchanged) ────────────────────────────────────

function encodeAudioSegment(
  encoder: AudioEncoder,
  data: AudioBuffer,
  startT: number,
  dur: number,
  ch: number
): void {
  const startSample = Math.floor(startT * data.sampleRate)
  const endSample = Math.floor((startT + dur) * data.sampleRate)
  const num = endSample - startSample
  if (num > 0 && startSample < data.length) {
    const actualEnd = Math.min(endSample, data.length)
    const actualNum = actualEnd - startSample
    const planar = new Float32Array(actualNum * ch)
    for (let c = 0; c < ch; c++) {
      planar.set(data.getChannelData(c).subarray(startSample, actualEnd), c * actualNum)
    }
    const af = new AudioData({
      format: 'f32-planar',
      sampleRate: data.sampleRate,
      numberOfFrames: actualNum,
      numberOfChannels: ch,
      timestamp: startT * 1_000_000,
      data: planar
    })
    encoder.encode(af)
    af.close()
  }
}
