import { create } from 'zustand'

export interface CaptionSegment {
  id: string
  start: number
  end: number
  arabic: string
  bengali: string
  arabicLines: string[]
  bengaliLines: string[]
}

export interface WatermarkConfig {
  path: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
}

export interface Metadata {
  surah?: string
  verses?: string
}

export interface CaptionStyle {
  arabicFont: string
  bengaliFont: string
  arabicSize: number
  bengaliSize: number
  arabicColor: string
  bengaliColor: string
  gap: number
  strokeColor: string
  strokeWidth: number
  shadowColor: string
  shadowBlur: number
  positionY: number
  animation?: 'none' | 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'bounce-up' | 'bounce-down' | 'elastic-left' | 'elastic-right' | 'zoom-in' | 'zoom-out' | 'cinematic' | 'typewriter' | 'pop-in'
}

export interface RenderSettings {
  encoder: 'av1_qsv' | 'hevc_qsv' | 'libsvtav1' | 'libx265'
  bitrate: string
  enableSlowMo: boolean
  slowMoFps: number
  videoFilter: 'none' | 'cinematic' | 'bw' | 'warm' | 'cool'
}

interface EditorState {
  // Media
  videoPath: string | null
  audioPath: string | null
  videoDuration: number
  audioDuration: number
  videoWidth: number
  videoHeight: number

  // Playback
  currentTime: number
  isPlaying: boolean

  // Captions
  captions: CaptionSegment[]
  captionStyle: CaptionStyle

  // Watermark
  watermark: WatermarkConfig | null

  // Render
  renderSettings: RenderSettings
  isRendering: boolean
  renderProgress: number
  renderDiagnostics: string[]

  // Gemini
  isAnalyzing: boolean
  geminiStatus: string
  metadata: Metadata | null

  // UI
  timelineZoom: number
  activePanel: 'media' | 'captions' | 'watermark' | 'render' | 'settings'

  // Actions
  setVideoPath: (path: string | null) => void
  setAudioPath: (path: string | null) => void
  setVideoDuration: (d: number) => void
  setAudioDuration: (d: number) => void
  setVideoResolution: (w: number, h: number) => void
  setCurrentTime: (t: number) => void
  setIsPlaying: (p: boolean) => void
  setCaptions: (c: CaptionSegment[]) => void
  updateCaption: (id: string, updates: Partial<CaptionSegment>) => void
  setCaptionStyle: (style: Partial<CaptionStyle>) => void
  setWatermark: (wm: WatermarkConfig | null) => void
  setRenderSettings: (s: Partial<RenderSettings>) => void
  setIsRendering: (r: boolean) => void
  setRenderProgress: (p: number) => void
  clearRenderDiagnostics: () => void
  appendRenderDiagnostic: (line: string) => void
  setIsAnalyzing: (a: boolean) => void
  setGeminiStatus: (s: string) => void
  setMetadata: (m: Metadata | null) => void
  setTimelineZoom: (z: number) => void
  setActivePanel: (p: EditorState['activePanel']) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  // Media
  videoPath: null,
  audioPath: null,
  videoDuration: 0,
  audioDuration: 0,
  videoWidth: 1920,
  videoHeight: 1080,

  // Playback
  currentTime: 0,
  isPlaying: false,

  // Captions
  captions: [],
  captionStyle: {
    arabicFont: 'Amiri',
    bengaliFont: 'Noto Sans Bengali',
    arabicSize: 48,
    bengaliSize: 36,
    arabicColor: '#ffffff',
    bengaliColor: '#f0e68c',
    gap: 16,
    strokeColor: '#000000',
    strokeWidth: 2,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    positionY: 75,
    animation: 'none'
  },

  // Watermark
  watermark: null,

  // Render
  renderSettings: {
    encoder: 'av1_qsv',
    bitrate: '8M',
    enableSlowMo: false,
    slowMoFps: 60,
    videoFilter: 'none'
  },
  isRendering: false,
  renderProgress: 0,
  renderDiagnostics: [],

  // Gemini
  isAnalyzing: false,
  geminiStatus: '',
  metadata: null,

  // UI
  timelineZoom: 1,
  activePanel: 'media',

  // Actions
  setVideoPath: (path) => set({ videoPath: path }),
  setAudioPath: (path) => set({ audioPath: path }),
  setVideoDuration: (d) => set({ videoDuration: d }),
  setAudioDuration: (d) => set({ audioDuration: d }),
  setVideoResolution: (w, h) => set({ videoWidth: w, videoHeight: h }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setCaptions: (c) => set({ captions: c }),
  updateCaption: (id, updates) =>
    set((state) => ({
      captions: state.captions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    })),
  setCaptionStyle: (style) =>
    set((state) => {
      const newStyle = { ...state.captionStyle, ...style }
      window.api.store.set('captionSettings', newStyle)
      return { captionStyle: newStyle }
    }),
  setWatermark: (wm) => {
    window.api.store.set('watermark', wm)
    return set({ watermark: wm })
  },
  setRenderSettings: (s) =>
    set((state) => {
      const newSettings = { ...state.renderSettings, ...s }
      window.api.store.set('renderSettings', newSettings)
      return { renderSettings: newSettings }
    }),
  setIsRendering: (r) => set({ isRendering: r }),
  setRenderProgress: (p) => set({ renderProgress: p }),
  clearRenderDiagnostics: () => set({ renderDiagnostics: [] }),
  appendRenderDiagnostic: (line) =>
    set((state) => ({
      renderDiagnostics: [...state.renderDiagnostics.slice(-299), line]
    })),
  setIsAnalyzing: (a) => set({ isAnalyzing: a }),
  setGeminiStatus: (s) => set({ geminiStatus: s }),
  setMetadata: (m) => set({ metadata: m }),
  setTimelineZoom: (z) => set({ timelineZoom: z }),
  setActivePanel: (p) => set({ activePanel: p })
}))

// Load persisted settings from electron-store on app startup
export async function loadPersistedSettings(): Promise<void> {
  try {
    const [captionSettings, renderSettings, watermark] = await Promise.all([
      window.api.store.get('captionSettings'),
      window.api.store.get('renderSettings'),
      window.api.store.get('watermark')
    ])
    const store = useEditorStore.getState()
    if (captionSettings) store.setCaptionStyle(captionSettings as CaptionStyle)
    if (renderSettings) store.setRenderSettings(renderSettings as RenderSettings)
    if (watermark) store.setWatermark(watermark as WatermarkConfig)
  } catch (e) {
    console.warn('Failed to load persisted settings:', e)
  }
}
