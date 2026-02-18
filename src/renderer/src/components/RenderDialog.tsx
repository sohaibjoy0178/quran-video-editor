import { useEffect, useCallback, useRef } from 'react'
import { useEditorStore } from '../stores/editorStore'

export function RenderDialog() {
  const isRendering = useEditorStore((s) => s.isRendering)
  const renderProgress = useEditorStore((s) => s.renderProgress)
  const renderDiagnostics = useEditorStore((s) => s.renderDiagnostics)
  const setIsRendering = useEditorStore((s) => s.setIsRendering)
  const setRenderProgress = useEditorStore((s) => s.setRenderProgress)
  const diagnosticsRef = useRef<HTMLDivElement>(null)

  // Listeners removed: Progress is now updated directly by the renderer via the store.

  useEffect(() => {
    const el = diagnosticsRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [renderDiagnostics])

  const handleCancel = useCallback(async () => {
    // TODO: Implement abortion for webCodecsRender if needed.
    // For now, just close the dialog.
    setIsRendering(false)
    setRenderProgress(0)
  }, [setIsRendering, setRenderProgress])

  const handleCopyLogs = useCallback(async () => {
    const text = renderDiagnostics.join('\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Ignore clipboard failures.
    }
  }, [renderDiagnostics])

  if (!isRendering) return null

  return (
    <div className="modal-overlay">
      <div className="modal render-dialog-modal">
        <div className="modal__header">
          <h3 className="modal__title">Rendering</h3>
        </div>
        <div className="modal__body render-dialog">
          <div className="render-dialog__percent">{Math.round(renderProgress)}%</div>
          <div className="render-dialog__progress">
            <div className="render-dialog__progress-bar" style={{ width: `${renderProgress}%` }} />
          </div>
          <div className="render-dialog__status">
            {renderProgress < 100 ? 'Encoding video...' : 'Finalizing...'}
          </div>

          <div className="render-diagnostics">
            <div className="render-diagnostics__header">
              <span>Render Diagnostics</span>
              <button className="btn btn--ghost btn--sm" onClick={handleCopyLogs}>
                Copy Logs
              </button>
            </div>
            <div className="render-diagnostics__body" ref={diagnosticsRef}>
              {renderDiagnostics.length === 0 ? (
                <div className="render-diagnostics__empty">Waiting for encoder output...</div>
              ) : (
                renderDiagnostics.map((line, idx) => (
                  <div key={`${idx}-${line}`} className="render-diagnostics__line">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="modal__footer" style={{ justifyContent: 'center' }}>
          <button className="btn btn--danger" onClick={handleCancel}>
            Cancel Render
          </button>
        </div>
      </div>
    </div>
  )
}
