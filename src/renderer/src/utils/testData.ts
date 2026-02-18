import { CaptionSegment, Metadata } from '../stores/editorStore'
import { v4 as uuidv4 } from 'uuid'

export const getTestMetadata = (): Metadata => ({
  surah: 'Al-Fatiha',
  verses: '1-7'
})

export const getTestCaptions = (): CaptionSegment[] => [
  {
    id: uuidv4(),
    start: 0,
    end: 4.0,
    arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    bengali: 'শুরু করছি আল্লাহর নামে যিনি পরম করুণাময়, অতি দয়ালু।',
    arabicLines: ['بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'],
    bengaliLines: ['শুরু করছি আল্লাহর নামে যিনি', 'পরম করুণাময়, অতি দয়ালু।']
  },
  {
    id: uuidv4(),
    start: 4.0,
    end: 8.0,
    arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    bengali: 'যাবতীয় প্রশংসা আল্লাহ তাআলার যিনি সকল সৃষ্টি জগতের পালনকর্তা।',
    arabicLines: ['ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ'],
    bengaliLines: ['যাবতীয় প্রশংসা আল্লাহ তাআলার যিনি', 'সকল সৃষ্টি জগতের পালনকর্তা।']
  },
  {
    id: uuidv4(),
    start: 8.0,
    end: 11.5,
    arabic: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    bengali: 'যিনি নিতান্ত মেহেরবান ও দয়ালু।',
    arabicLines: ['ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'],
    bengaliLines: ['যিনি নিতান্ত মেহেরবান ও দয়ালু।']
  },
  {
    id: uuidv4(),
    start: 11.5,
    end: 15.0,
    arabic: 'مَٰلِكِ يَوْمِ ٱلدِّينِ',
    bengali: 'যিনি বিচার দিনের মালিক।',
    arabicLines: ['مَٰلِكِ يَوْمِ ٱلدِّينِ'],
    bengaliLines: ['যিনি বিচার দিনের মালিক।']
  },
  {
    id: uuidv4(),
    start: 15.0,
    end: 19.5,
    arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
    bengali: 'আমরা একমাত্র তোমারই ইবাদত করি এবং শুধুমাত্র তোমারই সাহায্য প্রার্থনা করি।',
    arabicLines: ['إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ'],
    bengaliLines: ['আমরা একমাত্র তোমারই ইবাদত করি', 'এবং শুধুমাত্র তোমারই সাহায্য প্রার্থনা করি।']
  },
  {
    id: uuidv4(),
    start: 19.5,
    end: 24.0,
    arabic: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
    bengali: 'আমাদেরকে সরল পথ দেখাও।',
    arabicLines: ['ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ'],
    bengaliLines: ['আমাদেরকে সরল পথ দেখাও।']
  },
  {
    id: uuidv4(),
    start: 24.0,
    end: 30.0,
    arabic: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ',
    bengali: 'সে সমস্ত লোকদের পথ, যাদেরকে তুমি নেয়ামত দান করেছ।',
    arabicLines: ['صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ'],
    bengaliLines: ['সে সমস্ত লোকদের পথ, যাদেরকে', 'তুমি নেয়ামত দান করেছ।']
  },
  {
    id: uuidv4(),
    start: 30.0,
    end: 36.0,
    arabic: 'غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    bengali: 'তাদের পথ নয়, যাদের প্রতি তোমার গজব নাযিল হয়েছে এবং যারা পথভ্রষ্ট হয়েছে।',
    arabicLines: ['غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ', 'وَلَا ٱلضَّآلِّينَ'],
    bengaliLines: ['তাদের পথ নয়, যাদের প্রতি তোমার', 'গজব নাযিল হয়েছে এবং যারা পথভ্রষ্ট হয়েছে।']
  },
  // --- Surah Al-Ikhlas (repeat to fill time) ---
  {
    id: uuidv4(),
    start: 36.0,
    end: 39.5,
    arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
    bengali: 'বলুন, তিনি আল্লাহ, এক।',
    arabicLines: ['قُلْ هُوَ ٱللَّهُ أَحَدٌ'],
    bengaliLines: ['বলুন, তিনি আল্লাহ, এক।']
  },
  {
    id: uuidv4(),
    start: 39.5,
    end: 43.0,
    arabic: 'ٱللَّهُ ٱلصَّمَدُ',
    bengali: 'আল্লাহ অমুখাপেক্ষী।',
    arabicLines: ['ٱللَّهُ ٱلصَّمَدُ'],
    bengaliLines: ['আল্লাহ অমুখাপেক্ষী।']
  },
  {
    id: uuidv4(),
    start: 43.0,
    end: 47.0,
    arabic: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
    bengali: 'তিনি কাউকে জন্ম দেননি এবং কেউ তাঁকে জন্ম দেয়নি।',
    arabicLines: ['لَمْ يَلِدْ وَلَمْ يُولَدْ'],
    bengaliLines: ['তিনি কাউকে জন্ম দেননি', 'এবং কেউ তাঁকে জন্ম দেয়নি।']
  },
  {
    id: uuidv4(),
    start: 47.0,
    end: 51.0,
    arabic: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
    bengali: 'এবং তাঁর সমতুল্য কেউ নেই।',
    arabicLines: ['وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ'],
    bengaliLines: ['এবং তাঁর সমতুল্য কেউ নেই।']
  },
  // --- Surah An-Nas (more fill) ---
  {
    id: uuidv4(),
    start: 51.0,
    end: 55.0,
    arabic: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
    bengali: 'বলুন, আমি আশ্রয় গ্রহণ করি মানুষের পালনকর্তার।',
    arabicLines: ['قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ'],
    bengaliLines: ['বলুন, আমি আশ্রয় গ্রহণ করি', 'মানুষের পালনকর্তার।']
  },
  {
    id: uuidv4(),
    start: 55.0,
    end: 58.5,
    arabic: 'مَلِكِ ٱلنَّاسِ',
    bengali: 'মানুষের অধিপতির।',
    arabicLines: ['مَلِكِ ٱلنَّاسِ'],
    bengaliLines: ['মানুষের অধিপতির।']
  },
  {
    id: uuidv4(),
    start: 58.5,
    end: 62.0,
    arabic: 'إِلَٰهِ ٱلنَّاسِ',
    bengali: 'মানুষের মাবুদের।',
    arabicLines: ['إِلَٰهِ ٱلنَّاسِ'],
    bengaliLines: ['মানুষের মাবুদের।']
  }
]

/**
 * Generates a synthetic test audio WAV file (60s sine wave)
 * and returns its Blob URL for use as audioPath.
 */
export function generateTestAudioBlob(): Blob {
  const sampleRate = 44100
  const durationSec = 62
  const numSamples = sampleRate * durationSec
  const numChannels = 1
  const bitsPerSample = 16

  // WAV header + data
  const dataSize = numSamples * numChannels * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true) // byte rate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true) // block align
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Generate a gentle 440Hz sine wave with volume envelope
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    // Soft fade in/out at start and end
    let amplitude = 0.15
    if (t < 1) amplitude *= t
    if (t > durationSec - 1) amplitude *= (durationSec - t)
    // Mix two frequencies for a richer tone
    const sample = amplitude * (
      0.6 * Math.sin(2 * Math.PI * 440 * t) +
      0.4 * Math.sin(2 * Math.PI * 554.37 * t) // C#5, a major third
    )
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clamped * 32767, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
