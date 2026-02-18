import { useRef, useMemo, useCallback, useEffect, useState } from 'react'
import { useEditorStore, CaptionSegment } from '../stores/editorStore'
import { formatTimestamp } from '../utils/captionLayout'

const BASE_PPS = 80 // base pixels per second at zoom=1
const HANDLE_WIDTH = 6 // px — drag handle hit zone on each edge
const MIN_DURATION = 0.2 // minimum caption duration in seconds

/* ─── Draggable Caption Block ─── */
interface CaptionBlockProps {
  cap: CaptionSegment
  pxPerSec: number
  totalDuration: number
  variant: 'arabic' | 'bengali'
  onDragStart: () => void
  onDragEnd: () => void
}

function CaptionBlock({
  cap,
  pxPerSec,
  totalDuration,
  variant,
  onDragStart,
  onDragEnd
}: CaptionBlockProps) {
  const updateCaption = useEditorStore((s) => s.updateCaption)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const dragRef = useRef<{
    type: 'left' | 'right' | 'move'
    startX: number
    origStart: number
    origEnd: number
  } | null>(null)

  const blockLeft = cap.start * pxPerSec
  const blockWidth = Math.max((cap.end - cap.start) * pxPerSec, 4)
  const label = variant === 'arabic' ? cap.arabic : cap.bengali

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, type: 'left' | 'right' | 'move') => {
      e.stopPropagation()
      e.preventDefault()
      onDragStart()
      dragRef.current = {
        type,
        startX: e.clientX,
        origStart: cap.start,
        origEnd: cap.end
      }

      const onMove = (ev: MouseEvent): void => {
        if (!dragRef.current) return
        const dx = ev.clientX - dragRef.current.startX
        const dt = dx / pxPerSec
        const { origStart, origEnd } = dragRef.current

        if (dragRef.current.type === 'left') {
          const newStart = Math.max(0, Math.min(origStart + dt, origEnd - MIN_DURATION))
          updateCaption(cap.id, { start: Math.round(newStart * 10) / 10 })
          setCurrentTime(Math.round(newStart * 10) / 10)
        } else if (dragRef.current.type === 'right') {
          const newEnd = Math.max(origStart + MIN_DURATION, Math.min(origEnd + dt, totalDuration))
          updateCaption(cap.id, { end: Math.round(newEnd * 10) / 10 })
          setCurrentTime(Math.round(newEnd * 10) / 10)
        } else {
          // move entire block
          const dur = origEnd - origStart
          let newStart = origStart + dt
          newStart = Math.max(0, Math.min(newStart, totalDuration - dur))
          const rounded = Math.round(newStart * 10) / 10
          updateCaption(cap.id, { start: rounded, end: Math.round((rounded + dur) * 10) / 10 })
          setCurrentTime(rounded)
        }
      }

      const onUp = (): void => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // Delay clearing drag flag so the body click doesn't fire
        setTimeout(onDragEnd, 0)
      }

      document.body.style.cursor = type === 'left' || type === 'right' ? 'col-resize' : 'grabbing'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [
      cap.id,
      cap.start,
      cap.end,
      pxPerSec,
      totalDuration,
      updateCaption,
      setCurrentTime,
      onDragStart,
      onDragEnd
    ]
  )

  return (
    <div
      className={`timeline__caption-block timeline__caption-block--${variant}`}
      style={{ left: blockLeft, width: blockWidth }}
      title={label}
    >
      {/* Left edge handle */}
      <div
        className="timeline__drag-handle timeline__drag-handle--left"
        style={{ width: HANDLE_WIDTH }}
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      {/* Middle: drag to move */}
      <div className="timeline__drag-body" onMouseDown={(e) => handleMouseDown(e, 'move')}>
        {label}
      </div>
      {/* Right edge handle */}
      <div
        className="timeline__drag-handle timeline__drag-handle--right"
        style={{ width: HANDLE_WIDTH }}
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  )
}

/* ─── Timeline ─── */
export function Timeline() {
  const bodyRef = useRef<HTMLDivElement>(null)
  const captions = useEditorStore((s) => s.captions)
  const currentTime = useEditorStore((s) => s.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const audioDuration = useEditorStore((s) => s.audioDuration)
  const videoDuration = useEditorStore((s) => s.videoDuration)
  const zoom = useEditorStore((s) => s.timelineZoom)
  const setZoom = useEditorStore((s) => s.setTimelineZoom)

  const [bodyWidth, setBodyWidth] = useState(800)
  const isDraggingRef = useRef(false)

  const maxCaptionEnd = captions.length > 0 ? Math.max(...captions.map((c) => c.end)) : 0
  const totalDuration = Math.max(audioDuration, videoDuration, maxCaptionEnd + 2, 10)
  const pxPerSec = BASE_PPS * zoom
  const totalWidth = totalDuration * pxPerSec

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])
  const onDragEnd = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  // Track body width for fit-to-view
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBodyWidth(entry.contentRect.width)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Auto-fit when duration changes (new captions loaded, new media)
  useEffect(() => {
    if (totalDuration > 10 && bodyWidth > 0) {
      const fitZoom = bodyWidth / (totalDuration * BASE_PPS)
      setZoom(Math.max(0.01, Math.min(fitZoom * 0.95, 5))) // 95% fill with margin
    }
  }, [totalDuration, bodyWidth, setZoom])

  // Fit-to-view handler
  const fitToView = useCallback(() => {
    if (bodyWidth > 0 && totalDuration > 0) {
      const fitZoom = bodyWidth / (totalDuration * BASE_PPS)
      setZoom(Math.max(0.01, Math.min(fitZoom * 0.95, 5)))
    }
  }, [bodyWidth, totalDuration, setZoom])

  // Smart ruler interval based on effective px/sec
  const rulerMarks = useMemo(() => {
    const marks: { time: number; x: number }[] = []
    const targetSpacing = 80
    const rawInterval = targetSpacing / pxPerSec
    const niceIntervals = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
    let interval = niceIntervals[niceIntervals.length - 1]
    for (const ni of niceIntervals) {
      if (ni >= rawInterval) {
        interval = ni
        break
      }
    }
    for (let t = 0; t <= totalDuration; t += interval) {
      marks.push({ time: t, x: t * pxPerSec })
    }
    return marks
  }, [totalDuration, pxPerSec])

  const handleBodyClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't seek when finishing a drag
      if (isDraggingRef.current) return
      const rect = bodyRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left + (bodyRef.current?.scrollLeft || 0)
      const time = Math.max(0, Math.min(x / pxPerSec, totalDuration))
      setCurrentTime(time)
    },
    [pxPerSec, totalDuration, setCurrentTime]
  )

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.85 : 1.18
        setZoom(Math.max(0.01, Math.min(zoom * factor, 10)))
      }
    },
    [zoom, setZoom]
  )

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const px = currentTime * pxPerSec
    const scrollLeft = el.scrollLeft
    const viewWidth = el.clientWidth
    if (px < scrollLeft + 20 || px > scrollLeft + viewWidth - 20) {
      el.scrollLeft = px - viewWidth / 3
    }
  }, [currentTime, pxPerSec])

  const playheadX = currentTime * pxPerSec

  return (
    <div className="timeline">
      <div className="timeline__header">
        <span className="timeline__header-title">Timeline</span>
        <div className="timeline__zoom">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setZoom(Math.max(0.01, zoom * 0.7))}
            title="Zoom out"
          >
            −
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={fitToView}
            title="Fit to view"
            style={{ fontSize: '10px', padding: '2px 6px' }}
          >
            FIT
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setZoom(Math.min(10, zoom * 1.4))}
            title="Zoom in"
          >
            +
          </button>
          <span style={{ minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      <div className="timeline__body" ref={bodyRef} onClick={handleBodyClick}>
        {/* Ruler */}
        <div className="timeline__ruler" style={{ width: totalWidth }}>
          {rulerMarks.map((m) => (
            <div key={m.time} className="timeline__ruler-mark" style={{ left: m.x }}>
              {formatTimestamp(m.time)}
            </div>
          ))}
        </div>

        {/* Tracks */}
        <div className="timeline__tracks" style={{ width: totalWidth }}>
          {/* Waveform track */}
          <div className="timeline__track timeline__waveform">
            <span className="timeline__track-label">Audio</span>
          </div>

          {/* Arabic captions track */}
          <div className="timeline__track">
            <span className="timeline__track-label">Arabic</span>
            {captions.map((cap) => (
              <CaptionBlock
                key={`ar-${cap.id}`}
                cap={cap}
                pxPerSec={pxPerSec}
                totalDuration={totalDuration}
                variant="arabic"
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>

          {/* Bengali captions track */}
          <div className="timeline__track">
            <span className="timeline__track-label">Bengali</span>
            {captions.map((cap) => (
              <CaptionBlock
                key={`bn-${cap.id}`}
                cap={cap}
                pxPerSec={pxPerSec}
                totalDuration={totalDuration}
                variant="bengali"
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>

          {/* Playhead */}
          <div className="timeline__playhead" style={{ left: playheadX }} />
        </div>
      </div>
    </div>
  )
}
