import { Rnd } from 'react-rnd'
import { useEditorStore } from '../stores/editorStore'

interface WatermarkOverlayProps {
    previewWidth: number
}

export function WatermarkOverlay({ previewWidth }: WatermarkOverlayProps) {
    const watermark = useEditorStore((s) => s.watermark)
    const setWatermark = useEditorStore((s) => s.setWatermark)
    const videoWidth = useEditorStore((s) => s.videoWidth)

    if (!watermark) return null

    const scale = previewWidth / videoWidth

    return (
        <Rnd
            size={{
                width: watermark.width * scale,
                height: watermark.height * scale
            }}
            position={{
                x: watermark.x * scale,
                y: watermark.y * scale
            }}
            onDragStop={(_e, d) => {
                setWatermark({
                    ...watermark,
                    x: Math.round(d.x / scale),
                    y: Math.round(d.y / scale)
                })
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) => {
                setWatermark({
                    ...watermark,
                    width: Math.round(parseInt(ref.style.width) / scale),
                    height: Math.round(parseInt(ref.style.height) / scale),
                    x: Math.round(pos.x / scale),
                    y: Math.round(pos.y / scale)
                })
            }}
            bounds="parent"
            style={{
                border: '1px dashed rgba(88, 166, 255, 0.5)',
                borderRadius: 4,
                zIndex: 5
            }}
        >
            <img
                src={`file://${watermark.path}`}
                alt="Watermark"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: watermark.opacity,
                    pointerEvents: 'none'
                }}
            />
        </Rnd>
    )
}
