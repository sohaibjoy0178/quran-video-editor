import { useCallback, useEffect } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { CaptionControls } from './CaptionControls'
import { CaptionTimingEditor } from './CaptionTimingEditor'

export function Sidebar() {
    const activePanel = useEditorStore((s) => s.activePanel)
    const setActivePanel = useEditorStore((s) => s.setActivePanel)
    const videoPath = useEditorStore((s) => s.videoPath)
    const audioPath = useEditorStore((s) => s.audioPath)
    const setVideoPath = useEditorStore((s) => s.setVideoPath)
    const setAudioPath = useEditorStore((s) => s.setAudioPath)
    const setVideoDuration = useEditorStore((s) => s.setVideoDuration)
    const setAudioDuration = useEditorStore((s) => s.setAudioDuration)
    const setVideoResolution = useEditorStore((s) => s.setVideoResolution)
    const watermark = useEditorStore((s) => s.watermark)
    const setWatermark = useEditorStore((s) => s.setWatermark)
    const renderSettings = useEditorStore((s) => s.renderSettings)
    const setRenderSettings = useEditorStore((s) => s.setRenderSettings)
    const geminiStatus = useEditorStore((s) => s.geminiStatus)
    const captions = useEditorStore((s) => s.captions)

    const probeMedia = async (path: string) => {
        return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
            const video = document.createElement('video')
            video.preload = 'metadata'
            video.src = `file://${path}`
            video.onloadedmetadata = () => {
                resolve({
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight
                })
                video.remove()
            }
            video.onerror = (e) => reject(e)
        })
    }

    const handleImportVideo = useCallback(async () => {
        const path = await window.api.dialog.openFile([
            { name: 'Video', extensions: ['mp4', 'mkv', 'webm', 'avi', 'mov'] }
        ])
        if (path) {
            setVideoPath(path)
            try {
                // Use client-side probing
                const info = await probeMedia(path)
                setVideoDuration(info.duration)
                setVideoResolution(info.width, info.height)
            } catch (e) {
                console.warn('Could not probe video:', e)
            }
        }
    }, [setVideoPath, setVideoDuration, setVideoResolution])

    const handleImportAudio = useCallback(async () => {
        // Allow video files too, since we extract audio from them
        const path = await window.api.dialog.openFile([
            { name: 'Media Files', extensions: ['mp3', 'wav', 'mp4', 'mkv', 'mov', 'avi'] }
        ])
        if (path) {
            // Determine if it's video or audio based on extension for preview logic
            // But mainly we treat it as audio source.
            setAudioPath(path)

            // Get duration of reference
            try {
                const info = await probeMedia(path)
                setAudioDuration(info.duration)
            } catch (e) {
                console.warn('Could not probe audio:', e)
            }
        }
    }, [setAudioPath, setAudioDuration])

    const handleImportWatermark = useCallback(async () => {
        const path = await window.api.dialog.openFile([
            { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
        ])
        if (path) {
            const newWm = {
                path,
                x: 20,
                y: 20,
                width: 120,
                height: 120,
                opacity: 0.8
            }
            setWatermark(newWm)
            window.api.store.set('watermark', newWm)
        }
    }, [setWatermark])

    // Load persisted watermark on mount
    // Load persisted watermark on mount
    useEffect(() => {
        window.api.store.get('watermark').then((wm: any) => {
            if (wm) setWatermark(wm)
        })
    }, [setWatermark])



    const tabs = [
        { id: 'media' as const, label: 'Media' },
        { id: 'captions' as const, label: 'Captions' },
        { id: 'watermark' as const, label: 'Logo' },
        { id: 'render' as const, label: 'Render' }
    ]

    return (
        <div className="sidebar">
            <div className="sidebar__tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`sidebar__tab ${activePanel === tab.id ? 'sidebar__tab--active' : ''}`}
                        onClick={() => setActivePanel(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="sidebar__content">
                {/* ─── Media Panel ───── */}
                {activePanel === 'media' && (
                    <div className="panel">
                        <div
                            className={`dropzone ${videoPath ? 'dropzone--loaded' : ''}`}
                            onClick={handleImportVideo}
                        >
                            <div className="dropzone__icon">🎥</div>
                            <div className="dropzone__text">
                                {videoPath ? videoPath.split(/[\\/]/).pop() : 'Import Background Video'}
                            </div>
                            <div className="dropzone__hint">MP4, MKV, WebM, AVI, MOV</div>
                        </div>

                        <div
                            className={`dropzone ${audioPath ? 'dropzone--loaded' : ''}`}
                            onClick={handleImportAudio}
                        >
                            <div className="dropzone__icon">🎵</div>
                            <div className="dropzone__text">
                                {audioPath ? audioPath.split(/[\\\\/]/).pop() : 'Import Reference Video (Quran)'}
                            </div>
                            <div className="dropzone__hint">MP4, MKV, MOV, AVI, MP3, WAV</div>
                        </div>

                        {geminiStatus && (
                            <div className="panel__section">
                                <span className="panel__label">AI Status</span>
                                <span className={`badge ${geminiStatus.includes('Error') ? 'badge--error' : 'badge--info'}`}>
                                    {geminiStatus}
                                </span>
                            </div>
                        )}

                        {captions.length > 0 && (
                            <div className="panel__section">
                                <span className="panel__label">Captions</span>
                                <span className="badge badge--success">
                                    ✓ {captions.length} segments loaded
                                </span>
                            </div>
                        )}

                        <div className="panel__section" style={{ marginTop: 'auto', paddingTop: 16 }}>
                            <button
                                className="btn btn--secondary btn--sm"
                                style={{ width: '100%', opacity: 0.8 }}
                                onClick={async () => {
                                    const { getTestCaptions, getTestMetadata } = await import('../utils/testData')
                                    const testCaps = getTestCaptions()
                                    const testMeta = getTestMetadata()
                                    useEditorStore.getState().setCaptions(testCaps)
                                    useEditorStore.getState().setMetadata(testMeta)
                                    useEditorStore.getState().setGeminiStatus('Test Data Loaded')
                                }}
                            >
                                ⚡ Load Test Data (No API)
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Captions Panel ───── */}
                {activePanel === 'captions' && (
                    <>
                        <CaptionControls />
                        <CaptionTimingEditor />
                    </>
                )}

                {/* ─── Watermark Panel ───── */}
                {activePanel === 'watermark' && (
                    <div className="panel">
                        <div
                            className={`dropzone ${watermark ? 'dropzone--loaded' : ''}`}
                            onClick={handleImportWatermark}
                        >
                            <div className="dropzone__icon">🖼️</div>
                            <div className="dropzone__text">
                                {watermark ? watermark.path.split(/[\\/]/).pop() : 'Import Watermark / Logo'}
                            </div>
                            <div className="dropzone__hint">PNG, JPG, WebP</div>
                        </div>

                        {watermark && (
                            <>
                                <div className="form-group">
                                    <label>Opacity ({Math.round(watermark.opacity * 100)}%)</label>
                                    <input
                                        type="range"
                                        className="form-range"
                                        min={0}
                                        max={100}
                                        value={watermark.opacity * 100}
                                        onChange={(e) =>
                                            setWatermark({ ...watermark, opacity: parseInt(e.target.value) / 100 })
                                        }
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Position X</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={watermark.x}
                                            onChange={(e) => {
                                                const newWm = { ...watermark, x: parseInt(e.target.value) || 0 }
                                                setWatermark(newWm)
                                                window.api.store.set('watermark', newWm)
                                            }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Position Y</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={watermark.y}
                                            onChange={(e) => {
                                                const newWm = { ...watermark, y: parseInt(e.target.value) || 0 }
                                                setWatermark(newWm)
                                                window.api.store.set('watermark', newWm)
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Width</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={watermark.width}
                                            onChange={(e) => {
                                                const newWm = { ...watermark, width: parseInt(e.target.value) || 100 }
                                                setWatermark(newWm)
                                                window.api.store.set('watermark', newWm)
                                            }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Height</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={watermark.height}
                                            onChange={(e) => {
                                                const newWm = { ...watermark, height: parseInt(e.target.value) || 100 }
                                                setWatermark(newWm)
                                                window.api.store.set('watermark', newWm)
                                            }}
                                        />
                                    </div>
                                </div>
                                <button
                                    className="btn btn--danger btn--sm"
                                    onClick={() => {
                                        setWatermark(null)
                                        window.api.store.set('watermark', null)
                                    }}
                                >
                                    Remove Watermark
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* ─── Render Panel ───── */}
                {activePanel === 'render' && (
                    <div className="panel">
                        <div className="form-group">
                            <label>Video Encoder</label>
                            <select
                                className="form-select"
                                value={renderSettings.encoder}
                                onChange={(e) => setRenderSettings({ encoder: e.target.value as any })}
                            >
                                <option value="av1_qsv">AV1 (Intel Arc QSV) ⚡</option>
                                <option value="hevc_qsv">HEVC (Intel Arc QSV) ⚡</option>
                                <option value="libsvtav1">AV1 (Software - SVT)</option>
                                <option value="libx265">HEVC (Software - x265)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Bitrate</label>
                            <select
                                className="form-select"
                                value={renderSettings.bitrate}
                                onChange={(e) => setRenderSettings({ bitrate: e.target.value })}
                            >
                                <option value="4M">4 Mbps (Small)</option>
                                <option value="8M">8 Mbps (Standard)</option>
                                <option value="15M">15 Mbps (High)</option>
                                <option value="25M">25 Mbps (Ultra)</option>
                            </select>
                        </div>

                        <div
                            className={`toggle ${renderSettings.enableSlowMo ? 'toggle--active' : ''}`}
                            onClick={() => setRenderSettings({ enableSlowMo: !renderSettings.enableSlowMo })}
                        >
                            <div className="toggle__switch" />
                            <span className="toggle__label">🎥 Optical Flow Slow-Mo</span>
                        </div>

                        {renderSettings.enableSlowMo && (
                            <div className="form-group">
                                <label>Target FPS</label>
                                <select
                                    className="form-select"
                                    value={renderSettings.slowMoFps}
                                    onChange={(e) => setRenderSettings({ slowMoFps: parseInt(e.target.value) })}
                                >
                                    <option value={30}>30 FPS</option>
                                    <option value={60}>60 FPS</option>
                                    <option value={120}>120 FPS</option>
                                </select>
                            </div>
                        )}

                        <div className="panel__section">
                            <span className="panel__label">Visual Effects</span>
                            <div className="form-group">
                                <label>Video Filter</label>
                                <select
                                    className="form-select"
                                    value={renderSettings.videoFilter}
                                    onChange={(e) => setRenderSettings({ videoFilter: e.target.value as any })}
                                >
                                    <option value="none">None (Original)</option>
                                    <option value="cinematic">Cinematic (Vintage)</option>
                                    <option value="warm">Warm (Sunset)</option>
                                    <option value="cool">Cool (Night)</option>
                                    <option value="bw">Black & White</option>
                                </select>
                            </div>
                        </div>

                        <div className="panel__section" style={{ marginTop: 8 }}>
                            <span className="panel__label">Info</span>
                            <p className="panel__value" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                                • Video shorter than audio → auto-loop with 1s crossfade<br />
                                • Bengali_Y = Arabic_Y + Arabic_Height + Gap<br />
                                • QSV encoders require Intel Arc GPU drivers
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
