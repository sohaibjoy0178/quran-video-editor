import { useState, useCallback, useEffect } from 'react'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [apiKey, setApiKey] = useState('')
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
    const [isTesting, setIsTesting] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        window.api.store.get('geminiApiKey').then((key) => {
            setApiKey(String(key || ''))
        })
    }, [isOpen])

    const handleSave = useCallback(async () => {
        await window.api.store.set('geminiApiKey', apiKey.trim())
        onClose()
    }, [apiKey, onClose])

    const handleTest = useCallback(async () => {
        setIsTesting(true)
        setTestResult(null)
        await window.api.store.set('geminiApiKey', apiKey.trim())
        const result = await window.api.gemini.testConnection()
        setTestResult(result)
        setIsTesting(false)
    }, [apiKey])

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h3 className="modal__title">Settings</h3>
                    <button className="btn btn--ghost btn--icon" onClick={onClose}>
                        X
                    </button>
                </div>
                <div className="modal__body">
                    <div className="form-group">
                        <label>Local OCR Engine</label>
                        <div className="panel__value" style={{ fontSize: '12px', lineHeight: 1.5 }}>
                            Captions are extracted locally with Tesseract (offline). Required language packs:
                            Arabic (`ara`) and Bengali (`ben`).
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Gemini API Key (Optional)</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Used only for automatic Surah/Ayah metadata"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                    </div>

                    <div className="form-row">
                        <button className="btn" onClick={handleTest} disabled={isTesting}>
                            {isTesting ? (
                                <>
                                    <span className="spinner" /> Checking...
                                </>
                            ) : (
                                'Check OCR + Gemini'
                            )}
                        </button>
                    </div>

                    {testResult && (
                        <div className={`badge ${testResult.success ? 'badge--success' : 'badge--error'}`}>
                            {testResult.success ? 'OK' : 'FAIL'} {testResult.message}
                        </div>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                    <div className="panel__section">
                        <span className="panel__label">About</span>
                        <p className="panel__value" style={{ fontSize: '11px' }}>
                            Quran Video Editor v1.0.0
                            <br />
                            Local OCR captions + optional Gemini metadata
                            <br />
                            Hardware accelerated with Intel Arc QSV
                        </p>
                    </div>
                </div>
                <div className="modal__footer">
                    <button className="btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn--primary" onClick={handleSave}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}
