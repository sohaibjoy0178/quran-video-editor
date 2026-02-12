import { useState, useCallback } from 'react'
import { useEditorStore } from '../stores/editorStore'

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

function parseTime(str: string): number | null {
    // Accept formats: "1:23.4", "83.4", "1:23"
    const colonMatch = str.match(/^(\d+):(\d+\.?\d*)$/)
    if (colonMatch) {
        return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2])
    }
    const num = parseFloat(str)
    return isNaN(num) ? null : num
}

export function CaptionTimingEditor() {
    const captions = useEditorStore((s) => s.captions)
    const updateCaption = useEditorStore((s) => s.updateCaption)
    const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const handleTimeChange = useCallback(
        (id: string, field: 'start' | 'end', value: string) => {
            const t = parseTime(value)
            if (t !== null && t >= 0) {
                updateCaption(id, { [field]: Math.round(t * 10) / 10 })
            }
        },
        [updateCaption]
    )

    const handleSeek = useCallback(
        (time: number) => {
            setCurrentTime(time)
        },
        [setCurrentTime]
    )

    if (captions.length === 0) {
        return (
            <div className="caption-timing-editor">
                <div className="caption-timing-editor__empty">
                    No captions loaded yet. Use <strong>✨ AI Captions</strong> to generate them.
                </div>
            </div>
        )
    }

    return (
        <div className="caption-timing-editor">
            <div className="caption-timing-editor__header">
                <span>📝 Caption Timing ({captions.length})</span>
            </div>
            <div className="caption-timing-editor__list">
                {captions.map((cap, i) => {
                    const isExpanded = expandedId === cap.id
                    const duration = cap.end - cap.start
                    return (
                        <div
                            key={cap.id}
                            className={`caption-item ${isExpanded ? 'caption-item--expanded' : ''}`}
                        >
                            <div
                                className="caption-item__summary"
                                onClick={() => setExpandedId(isExpanded ? null : cap.id)}
                            >
                                <span className="caption-item__index">#{i + 1}</span>
                                <span className="caption-item__preview" dir="rtl">
                                    {cap.arabicLines?.[0]?.substring(0, 25) || cap.arabic?.substring(0, 25) || '—'}
                                </span>
                                <span className="caption-item__duration">{duration.toFixed(1)}s</span>
                            </div>

                            {isExpanded && (
                                <div className="caption-item__details">
                                    <div className="caption-item__time-row">
                                        <div className="caption-item__time-field">
                                            <label>Start</label>
                                            <input
                                                type="text"
                                                className="form-input form-input--sm"
                                                defaultValue={formatTime(cap.start)}
                                                onBlur={(e) => handleTimeChange(cap.id, 'start', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        ; (e.target as HTMLInputElement).blur()
                                                    }
                                                }}
                                            />
                                            <button
                                                className="btn btn--ghost btn--xs"
                                                title="Seek to start"
                                                onClick={() => handleSeek(cap.start)}
                                            >
                                                ▶
                                            </button>
                                        </div>
                                        <div className="caption-item__time-field">
                                            <label>End</label>
                                            <input
                                                type="text"
                                                className="form-input form-input--sm"
                                                defaultValue={formatTime(cap.end)}
                                                onBlur={(e) => handleTimeChange(cap.id, 'end', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        ; (e.target as HTMLInputElement).blur()
                                                    }
                                                }}
                                            />
                                            <button
                                                className="btn btn--ghost btn--xs"
                                                title="Seek to end"
                                                onClick={() => handleSeek(cap.end)}
                                            >
                                                ▶
                                            </button>
                                        </div>
                                    </div>

                                    <div className="caption-item__nudge-row">
                                        <button
                                            className="btn btn--ghost btn--xs"
                                            title="Shift start -0.5s"
                                            onClick={() => updateCaption(cap.id, { start: Math.max(0, cap.start - 0.5) })}
                                        >
                                            ◀ -0.5s
                                        </button>
                                        <button
                                            className="btn btn--ghost btn--xs"
                                            title="Shift start +0.5s"
                                            onClick={() => updateCaption(cap.id, { start: cap.start + 0.5 })}
                                        >
                                            +0.5s ▶
                                        </button>
                                        <span className="caption-item__sep">|</span>
                                        <button
                                            className="btn btn--ghost btn--xs"
                                            title="Shift end -0.5s"
                                            onClick={() => updateCaption(cap.id, { end: Math.max(cap.start + 0.1, cap.end - 0.5) })}
                                        >
                                            ◀ -0.5s
                                        </button>
                                        <button
                                            className="btn btn--ghost btn--xs"
                                            title="Shift end +0.5s"
                                            onClick={() => updateCaption(cap.id, { end: cap.end + 0.5 })}
                                        >
                                            +0.5s ▶
                                        </button>
                                    </div>

                                    <div className="caption-item__text-preview">
                                        <div className="caption-item__text-block" dir="rtl">
                                            <small>Arabic</small>
                                            <p>{cap.arabicLines?.join(' ') || cap.arabic}</p>
                                        </div>
                                        <div className="caption-item__text-block">
                                            <small>Bengali</small>
                                            <p>{cap.bengaliLines?.join(' ') || cap.bengali}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
