
import { ipcMain } from 'electron'
import { GoogleGenerativeAI, SchemaType, GenerationConfig } from '@google/generative-ai'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import { getStore } from './store'

interface RawCaption {
    start: string
    end: string
    arabic: string
    bengali: string
}

interface ProcessedCaption {
    start: number
    end: number
    arabic: string
    bengali: string
    arabicLines?: string[]
    bengaliLines?: string[]
}

const GENERATION_CONFIG: GenerationConfig = {
  temperature: 0.0,
  topP: 0.95,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      metadata: {
        type: SchemaType.OBJECT,
        properties: {
          surah: { type: SchemaType.STRING },
          verses: { type: SchemaType.STRING }
        },
        required: ['surah', 'verses']
      },
      captions: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            start: { type: SchemaType.STRING, description: 'Format MM:SS' },
            end: { type: SchemaType.STRING, description: 'Format MM:SS' },
            arabic: { type: SchemaType.STRING },
            bengali: { type: SchemaType.STRING }
          },
          required: ['start', 'end', 'arabic', 'bengali']
        }
      }
    },
    required: ['metadata', 'captions']
  }
}

const SYSTEM_PROMPT = `You are an expert video caption extraction system specializing in Quran recitation videos.
YOUR PRIMARY TASK: Extract the EXACT captions shown on-screen in the reference video and replicate them with precise timestamps.

STRICT RULES:
1. **Character-for-Character Accuracy**: matching the on-screen text EXACTLY.
   - Include ALL Arabic diacritics (Tashkeel) exactly as shown.
   - Include ALL Bengali punctuation and formatting.
   - Do NOT correct spelling or grammar. Copy what you see.
2. **Timestamps & Continuity**:
   - 'start' and 'end' must be in MM:SS format (e.g., "00:01", "01:25").
   - **CRITICAL**: Ensure captions are CONTINUOUS. If a reciter prolongs a verse (Tajweed), the caption must REMAIN VISIBLE until the next verse begins.
   - Do NOT leave gaps between captions unless there is a long silence (> 3 seconds) or a complete visual break.
   - Align start times perfectly with the visual appearance of new text.
   - Extend 'end' times to meet the 'start' of the next caption to prevent flickering.
3. **Segmentation**:
   - Create a new caption block WHENEVER the on-screen text changes.
   - Do not combine multiple screen changes into one.
4. **Metadata**:
   - Extract the Surah Name (English/Transliterated) and Verse Numbers (e.g., "1-5") if visible or inferred.
5. **No Hallucinations**:
   - If a segment has NO on-screen text, do NOT output a caption for that time.

OUTPUT FORMAT:
JSON with 'metadata' and 'captions' array.`

function parseTime(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.split(':')
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  }
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseFloat(timeStr)
}

function wrapText(text: string, limit: number, isChar = false): string[] {
    if (!text) return []
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const length = isChar ? testLine.length : testLine.split(' ').length
        
        if (length > limit && currentLine) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine = testLine
        }
    }
    if (currentLine) lines.push(currentLine)
    return lines
}

export function registerGeminiHandlers(): void {
  ipcMain.handle('gemini:analyze', async (event, mediaPath: string) => {
    const store = await getStore()
    const apiKey = String(store.get('geminiApiKey'))

    if (!apiKey) {
      throw new Error('Gemini API key not found. Please set it in Settings.')
    }

    const sendProgress = (status: string, error = false): void => {
      try {
          event.sender.send('gemini:progress', { status, error })
      } catch (e) { /* ignore */ }
    }

    try {
      sendProgress('Preparing video analysis...')
      
      const fileManager = new GoogleAIFileManager(apiKey)
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: GENERATION_CONFIG
      })

      // Upload the full file directly
      sendProgress('Uploading media to Gemini...')
      const uploadResult = await fileManager.uploadFile(mediaPath, {
        mimeType: 'video/mp4', // Simplification: assuming input is compat video. If logic gets complex, we might need mime detection.
        displayName: 'Quran Video Analysis'
      })

      let file = await fileManager.getFile(uploadResult.file.name)
      while (file.state === FileState.PROCESSING) {
        sendProgress('Processing media on Google servers...')
        await new Promise((resolve) => setTimeout(resolve, 2000))
        file = await fileManager.getFile(uploadResult.file.name)
      }

      if (file.state === FileState.FAILED) {
        throw new Error('Video processing failed on Google servers.')
      }

      sendProgress('Generating captions...')
      
      try {
        const result = await model.generateContent([
          { text: SYSTEM_PROMPT },
          {
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri
            }
          }
        ])

        const responseText = result.response.text()
        const json = JSON.parse(responseText)
        
        const captions: ProcessedCaption[] = (json.captions || []).map((cap: RawCaption) => ({
          start: parseTime(cap.start),
          end: parseTime(cap.end),
          arabic: cap.arabic,
          bengali: cap.bengali
        }))
        
        // Post-processing: Gap Filling
        // Close gaps aggressively to ensure captions persist during recitation pauses.
        // If the gap between end[i] and start[i+1] is reasonable (< 15s), extend end[i].
        for (let i = 0; i < captions.length - 1; i++) {
            const current = captions[i]
            const next = captions[i+1]
            const gap = next.start - current.end
            
            if (gap > 0 && gap < 15.0) {
                current.end = next.start
            }
        }

        // Post-process lines (word wrap)
        const processedCaptions = captions.map((c: ProcessedCaption) => ({
          ...c,
          arabicLines: wrapText(c.arabic, 6), 
          bengaliLines: wrapText(c.bengali, 35, true)
        }))

        const metadata = {
            surah: json.metadata?.surah || 'Unknown',
            verses: json.metadata?.verses || 'Unknown'
        }

        sendProgress(`Analysis complete! Extracted ${processedCaptions.length} captions.`)
        
        return {
            metadata,
            captions: processedCaptions
        }

      } finally {
        await fileManager.deleteFile(uploadResult.file.name)
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      sendProgress(`Error: ${errorMessage}`, true)
      throw err
    }
  })
}
