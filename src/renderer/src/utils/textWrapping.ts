
export const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    if (!text) return []
    const measured = ctx.measureText(text)
    if (measured.width <= maxWidth) return [text]

    const words = text.split(/\s+/)
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const testWidth = ctx.measureText(testLine).width
        if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine = testLine
        }
    }
    if (currentLine) lines.push(currentLine)
    return lines.length > 0 ? lines : [text]
}
