/**
 * Caption layout utility — guarantees zero-overlap between Arabic and Bengali.
 * Bengali_Y = Arabic_Y + Arabic_Height + User_Gap
 */

export interface CaptionLayout {
  arabicY: number
  bengaliY: number
  totalHeight: number
}

export function computeCaptionLayout(
  containerHeight: number,
  positionYPercent: number,
  arabicSize: number,
  arabicLineCount: number,
  bengaliSize: number,
  bengaliLineCount: number,
  gap: number
): CaptionLayout {
  const arabicBlockHeight = arabicLineCount * (arabicSize + 12) - 12
  const bengaliBlockHeight = bengaliLineCount * (bengaliSize + 12) - 12
  const totalHeight = arabicBlockHeight + gap + bengaliBlockHeight

  // positionYPercent is where the top of the Arabic block starts (% of container)
  const arabicY = Math.round((containerHeight * positionYPercent) / 100)
  const bengaliY = arabicY + arabicBlockHeight + gap

  return { arabicY, bengaliY, totalHeight }
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
