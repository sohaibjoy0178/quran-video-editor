import { useEditorStore } from '../stores/editorStore'

export function CaptionControls() {
    const style = useEditorStore((s) => s.captionStyle)
    const setCaptionStyle = useEditorStore((s) => s.setCaptionStyle)

    return (
        <div className="panel">
            <div className="panel__section">
                <span className="panel__label">Arabic Font</span>
                <select
                    className="form-select"
                    value={style.arabicFont}
                    onChange={(e) => setCaptionStyle({ arabicFont: e.target.value })}
                >
                    <option value="Amiri">Amiri</option>
                    <option value="Scheherazade New">Scheherazade New</option>
                    <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
                    <option value="Lateef">Lateef</option>
                    <option value="Traditional Arabic">Traditional Arabic</option>
                    <option value="Sakkal Majalla">Sakkal Majalla</option>
                    <option value="Arabic Typesetting">Arabic Typesetting</option>
                    <option value="KFGQPC Uthmanic Script HGFS">KFGQPC Uthmanic Script HGFS</option>
                </select>
            </div>

            <div className="panel__section">
                <span className="panel__label">Bengali Font</span>
                <select
                    className="form-select"
                    value={style.bengaliFont}
                    onChange={(e) => setCaptionStyle({ bengaliFont: e.target.value })}
                >
                    <option value="Noto Sans Bengali">Noto Sans Bengali</option>
                    <option value="Hind Siliguri">Hind Siliguri</option>
                    <option value="Noto Serif Bengali">Noto Serif Bengali</option>
                    <option value="Kalpurush">Kalpurush</option>
                    <option value="Siyam Rupali">Siyam Rupali</option>
                    <option value="SolaimanLipi">SolaimanLipi</option>
                    <option value="Vrinda">Vrinda</option>
                </select>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Arabic Size</label>
                    <input
                        type="number"
                        className="form-input"
                        value={style.arabicSize}
                        min={16}
                        max={120}
                        onChange={(e) => setCaptionStyle({ arabicSize: parseInt(e.target.value) || 48 })}
                    />
                </div>
                <div className="form-group">
                    <label>Bengali Size</label>
                    <input
                        type="number"
                        className="form-input"
                        value={style.bengaliSize}
                        min={12}
                        max={96}
                        onChange={(e) => setCaptionStyle({ bengaliSize: parseInt(e.target.value) || 36 })}
                    />
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Arabic Color</label>
                    <input
                        type="color"
                        className="color-input"
                        value={style.arabicColor}
                        onChange={(e) => setCaptionStyle({ arabicColor: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label>Bengali Color</label>
                    <input
                        type="color"
                        className="color-input"
                        value={style.bengaliColor}
                        onChange={(e) => setCaptionStyle({ bengaliColor: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label>Stroke</label>
                    <input
                        type="color"
                        className="color-input"
                        value={style.strokeColor}
                        onChange={(e) => setCaptionStyle({ strokeColor: e.target.value })}
                    />
                </div>
            </div>

            <div className="form-group">
                <label>Gap Between Arabic & Bengali ({style.gap}px)</label>
                <input
                    type="range"
                    className="form-range"
                    min={0}
                    max={60}
                    value={style.gap}
                    onChange={(e) => setCaptionStyle({ gap: parseInt(e.target.value) })}
                />
            </div>

            <div className="form-group">
                <label>Caption Y Position ({style.positionY}%)</label>
                <input
                    type="range"
                    className="form-range"
                    min={10}
                    max={90}
                    value={style.positionY}
                    onChange={(e) => setCaptionStyle({ positionY: parseInt(e.target.value) })}
                />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Stroke Width</label>
                    <input
                        type="number"
                        className="form-input"
                        value={style.strokeWidth}
                        min={0}
                        max={10}
                        onChange={(e) => setCaptionStyle({ strokeWidth: parseInt(e.target.value) || 0 })}
                    />
                </div>
                <div className="form-group">
                    <label>Shadow Blur</label>
                    <input
                        type="number"
                        className="form-input"
                        value={style.shadowBlur}
                        min={0}
                        max={30}
                        onChange={(e) => setCaptionStyle({ shadowBlur: parseInt(e.target.value) || 0 })}
                    />
                </div>
            </div>

            <div className="panel__section">
                <span className="panel__label">Animation</span>
                <select
                    className="form-select"
                    value={style.animation || 'none'}
                    onChange={(e) => setCaptionStyle({ animation: e.target.value as any })}
                >
                    <option value="none">None</option>
                    <option value="fade-in">Fade In (Simple)</option>
                    <option value="cinematic">Cinematic (Slow Fade)</option>
                    <option value="typewriter">Typewriter (Fast)</option>
                    <option value="pop-in">Pop In (Fast)</option>
                    <option value="slide-up">Slide Up</option>
                    <option value="slide-down">Slide Down</option>
                    <option value="slide-left">Slide Left</option>
                    <option value="slide-right">Slide Right</option>
                    <option value="bounce-up">Bounce Up</option>
                    <option value="bounce-down">Bounce Down</option>
                    <option value="elastic-left">Elastic Left</option>
                    <option value="elastic-right">Elastic Right</option>
                    <option value="zoom-in">Zoom In</option>
                    <option value="zoom-out">Zoom Out</option>
                </select>
            </div>
        </div>
    )
}
