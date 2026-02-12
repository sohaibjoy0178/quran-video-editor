import { useCallback, useEffect } from 'react'
import { renderVideoBrowser } from '../utils/browserRender'

import { useEditorStore } from '../stores/editorStore'

interface ToolbarProps {
    onOpenSettings: () => void
}

export function Toolbar({ onOpenSettings }: ToolbarProps) {
    const videoPath = useEditorStore((s) => s.videoPath)
    const audioPath = useEditorStore((s) => s.audioPath)
    const captions = useEditorStore((s) => s.captions)
    const isAnalyzing = useEditorStore((s) => s.isAnalyzing)
    const setIsAnalyzing = useEditorStore((s) => s.setIsAnalyzing)
    const setGeminiStatus = useEditorStore((s) => s.setGeminiStatus)
    const setCaptions = useEditorStore((s) => s.setCaptions)
    const setIsRendering = useEditorStore((s) => s.setIsRendering)
    const setRenderProgress = useEditorStore((s) => s.setRenderProgress)
    const clearRenderDiagnostics = useEditorStore((s) => s.clearRenderDiagnostics)
    const appendRenderDiagnostic = useEditorStore((s) => s.appendRenderDiagnostic)
    const setRenderStatus = useEditorStore((s) => s.setGeminiStatus)
    const captionStyle = useEditorStore((s) => s.captionStyle)
    const renderSettings = useEditorStore((s) => s.renderSettings)
    const watermark = useEditorStore((s) => s.watermark)
    const videoWidth = useEditorStore((s) => s.videoWidth)
    const videoHeight = useEditorStore((s) => s.videoHeight)
    const audioDuration = useEditorStore((s) => s.audioDuration)
    const videoDuration = useEditorStore((s) => s.videoDuration)

    const setMetadata = useEditorStore((s) => s.setMetadata)
    const metadata = useEditorStore((s) => s.metadata)

    useEffect(() => {
        if (!window.api?.gemini?.onProgress) return
        const removeListener = window.api.gemini.onProgress((data) => {
            setGeminiStatus(data.status)
        })
        return () => removeListener()
    }, [setGeminiStatus])

    const handleAnalyze = useCallback(async () => {
        // Analyze the reference media first (audioPath slot accepts reference video/audio).
        // Fall back to background video only if reference is not loaded.
        const mediaToAnalyze = audioPath || videoPath
        if (!mediaToAnalyze) {
            setGeminiStatus('Please load a video or audio file first.')
            return
        }
        const mediaName = mediaToAnalyze.split(/[\\/]/).pop() || mediaToAnalyze
        setIsAnalyzing(true)
        setGeminiStatus(`Analyzing reference media: ${mediaName} `)

        try {
            const result = await window.api.gemini.analyze(mediaToAnalyze)
            console.log('Gemini Result:', result)

            // Handle both new format { metadata, captions } and potentially old array format
            const rawCaptions = Array.isArray(result) ? result : result.captions
            const meta = Array.isArray(result) ? null : result.metadata

            if (meta) {
                setMetadata(meta)
            }

            if (!rawCaptions) {
                throw new Error('No captions returned from AI.')
            }

            const captionsWithIds = rawCaptions.map((c: any, i: number) => ({
                ...c,
                id: `cap - ${i} `,
                arabicLines: c.arabicLines || [c.arabic],
                bengaliLines: c.bengaliLines || [c.bengali]
            }))
            setCaptions(captionsWithIds)
            setGeminiStatus(`Done! ${captionsWithIds.length} verses analyzed.`)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            setGeminiStatus(`Error: ${message} `)
            console.error(err)
        } finally {
            setIsAnalyzing(false)
        }
    }, [audioPath, videoPath, setIsAnalyzing, setGeminiStatus, setCaptions, setMetadata])

    const handleRender = useCallback(async () => {
        // Fallback: Use video as audio source if explicit audio not provided
        const effectiveAudioPath = audioPath || videoPath
        if (!videoPath || !effectiveAudioPath || captions.length === 0) {
            console.warn('Render blocked: missing paths or captions', { videoPath, audioPath, captionsLen: captions.length })
            return
        }

        // Default filename based on metadata
        let defaultName = 'quran-output.mp4'
        if (metadata && metadata.surah) {
            // Sanitize filename
            const surah = metadata.surah.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            const verses = metadata.verses ? metadata.verses.replace(/[^a-z0-9-]/gi, '') : ''
            defaultName = `${surah}${verses ? '_' + verses : ''}.mp4`
        }

        const outputPath = await window.api.dialog.saveFile(defaultName)
        if (!outputPath) return

        clearRenderDiagnostics()
        setIsRendering(true)
        setRenderProgress(0)

        const width = videoWidth || 1920
        const height = videoHeight || 1080

        try {
            const blob = await renderVideoBrowser({
                videoPath,
                audioPath: audioPath || null, // If audioPath is set, it overrides video audio
                captions,
                captionStyle,
                videoWidth: width,
                videoHeight: height,
                videoDuration,
                audioDuration,
                metadata: metadata || undefined,
                watermark: watermark && watermark.path ? {
                    path: watermark.path,
                    x: watermark.x,
                    y: watermark.y,
                    width: watermark.width,
                    height: watermark.height,
                    opacity: watermark.opacity
                } : null,
                onProgress: (p) => setRenderProgress(p * 100)
            })

            setRenderStatus('Saving file...')
            const buffer = await blob.arrayBuffer()
            const result = await window.api.files.write(outputPath, buffer)

            if (result.success) {
                setRenderStatus('Render Complete!')
                appendRenderDiagnostic('Render saved successfully.')
            } else {
                throw new Error(result.error)
            }

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Render failed'
            console.error('Render error:', msg)
            setRenderStatus(`Render Error: ${msg} `)
            appendRenderDiagnostic(`Render Error: ${msg} `)
        } finally {
            setIsRendering(false)
            setRenderProgress(100)
        }
    }, [
        videoPath, audioPath, captions, captionStyle, renderSettings,
        watermark, videoWidth, videoHeight, audioDuration, videoDuration,
        setIsRendering, setRenderProgress, metadata, setRenderStatus, clearRenderDiagnostics, appendRenderDiagnostic
    ])

    return (
        <div className="toolbar">
            <span className="toolbar__title">
                <span className="toolbar__title-icon">🕌</span>
                Quran Video Editor
            </span>

            <div className="toolbar__actions">
                <button
                    className="btn btn--primary"
                    disabled={(!audioPath && !videoPath) || isAnalyzing}
                    onClick={handleAnalyze}
                >
                    {isAnalyzing ? (
                        <>
                            <span className="spinner" /> Analyzing...
                        </>
                    ) : (
                        '✨ AI Captions'
                    )}
                </button>

                <button
                    className="btn btn--success"
                    disabled={!videoPath || captions.length === 0}
                    onClick={handleRender}
                >
                    🎬 Render
                </button>

                <button className="btn btn--ghost btn--icon" onClick={onOpenSettings} title="Settings">
                    ⚙️
                </button>
            </div>
        </div>
    )
}
