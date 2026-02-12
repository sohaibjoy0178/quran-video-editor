
import { wrapText } from './textWrapping'

interface SimpleCaption {
    start: number
    end: number
    arabicLines: string[]
    bengaliLines: string[]
    [key: string]: any
}

interface SimpleStyle {
    arabicSize: number
    arabicFont: string
    bengaliSize: number
    bengaliFont: string
    [key: string]: any
}

export const prepareRenderCaptions = (
    captions: SimpleCaption[],
    style: SimpleStyle,
    videoWidth: number
): SimpleCaption[] => {
    const canvas = document.createElement('canvas')
    // height doesn't matter for specific measuring
    canvas.width = videoWidth
    canvas.height = 100 
    const ctx = canvas.getContext('2d')
    if (!ctx) return captions

    const maxWidth = videoWidth * 0.95

    return captions.map(cap => {
        // Wrap Arabic
        ctx.font = `700 ${style.arabicSize}px "${style.arabicFont}", serif`
        const wrappedArabic = cap.arabicLines.flatMap((line: string) => wrapText(ctx, line, maxWidth))

        // Wrap Bengali
        ctx.font = `600 ${style.bengaliSize}px "${style.bengaliFont}", sans-serif`
        const wrappedBengali = cap.bengaliLines.flatMap((line: string) => wrapText(ctx, line, maxWidth))

        return {
            ...cap,
            arabicLines: wrappedArabic,
            bengaliLines: wrappedBengali
        }
    })
}
