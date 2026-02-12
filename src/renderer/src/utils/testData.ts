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
    end: 3.5,
    arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    bengali: 'শুরু করছি আল্লাহর নামে যিনি পরম করুণাময়, অতি দয়ালু।',
    arabicLines: ['بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'],
    bengaliLines: ['শুরু করছি আল্লাহর নামে যিনি', 'পরম করুণাময়, অতি দয়ালু।']
  },
  {
    id: uuidv4(),
    start: 3.5,
    end: 7.0,
    arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    bengali: 'যাবতীয় প্রশংসা আল্লাহ তাআলার যিনি সকল সৃষ্টি জগতের পালনকর্তা।',
    arabicLines: ['ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ'],
    bengaliLines: ['যাবতীয় প্রশংসা আল্লাহ তাআলার যিনি', 'সকল সৃষ্টি জগতের পালনকর্তা।']
  },
  {
    id: uuidv4(),
    start: 7.0,
    end: 10.0,
    arabic: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    bengali: 'যিনি নিতান্ত মেহেরবান ও দয়ালু।',
    arabicLines: ['ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'],
    bengaliLines: ['যিনি নিতান্ত মেহেরবান ও দয়ালু।']
  },
  {
    id: uuidv4(),
    start: 10.0,
    end: 13.5,
    arabic: 'مَٰلِكِ يَوْمِ ٱلدِّينِ',
    bengali: 'যিনি বিচার দিনের মালিক।',
    arabicLines: ['مَٰلِكِ يَوْمِ ٱلدِّينِ'],
    bengaliLines: ['যিনি বিচার দিনের মালিক।']
  }
]
