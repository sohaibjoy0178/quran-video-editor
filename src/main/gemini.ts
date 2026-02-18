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

interface IStore {
  get(key: string): unknown
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

const SYSTEM_PROMPT = `You are a high-precision video transcription and synchronization agent. Your specialized task is to extract text from Quran recitation videos with 100% fidelity.

### GOAL:
Replicate the EXACT captions seen on the reference video screen. What the user sees on the screen is what you must provide.

### STRICT RULES for TEXT EXTRACTION:
1. **Character-for-Character Accuracy**: Every symbol, diacritic (Tashkeel), and punctuation mark must match the screen EXACTLY.
2. **Arabic Excellence**: Maintain all Quranic symbols (end-of-verse markers, sajda signs, etc.) if they are visible.
3. **Bengali Translation**: Capture the exact Bengali translation text provided on screen. Do NOT use your own translation.
4. **No Correction**: If there is a typo or specific stylistic choice on the screen, COPY IT. Do not correct it.

### RULES for TIMESTAMPS & FLOW:
1. **Millisecond Precision**: Use MM:SS.mmm format (e.g., "00:04.250"). This ensures the text appears at the exact moment the video shows it.
2. **Seamless Continuity**: Subtitles must remain on screen until the very moment the NEXT subtitle appears. 
   - Set the 'end' time of a caption to be IDENTICAL to the 'start' time of the following caption.
   - Do NOT leave gaps unless there is a complete visual removal of text from the screen for more than 2 seconds.
3. **Visual Triggers**: Sync start/end times precisely to the visual fade-in/fade-out or hard cut of the text.

### OUTPUT FORMAT:
Provide a strictly valid JSON object with:
- 'metadata': { 'surah': '...', 'verses': '...' }
- 'captions': Array of { 'start', 'end', 'arabic', 'bengali' }`

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

export function registerGeminiHandlers(): void {
  ipcMain.handle('gemini:analyze', async (event, mediaPath: string) => {
    const store = (await getStore()) as IStore
    const apiKey = String(store.get('geminiApiKey'))

    if (!apiKey) {
      throw new Error('Gemini API key not found. Please set it in Settings.')
    }

    const sendProgress = (status: string, error = false): void => {
      try {
        event.sender.send('gemini:progress', { status, error })
      } catch {
        /* ignore */
      }
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
        // Post-processing: Resolve overlaps & Gap Filling
        for (let i = 0; i < captions.length - 1; i++) {
          const current = captions[i]
          const next = captions[i + 1]

          // 1. Force end of current to be start of next if there's an overlap
          if (current.end > next.start) {
            current.end = next.start
          }

          // 2. Fill gaps (extend end to next start if gap < 5.0 seconds)
          const gap = next.start - current.end
          if (gap > 0 && gap < 5.0) {
            current.end = next.start
          }
        }

        // Result
        const metadata = {
          surah: json.metadata?.surah || 'Unknown',
          verses: json.metadata?.verses || 'Unknown'
        }

        sendProgress(`Analysis complete! Extracted ${captions.length} captions.`)

        return {
          metadata,
          captions
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
