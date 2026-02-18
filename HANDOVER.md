# Quran Video Editor — Project Handover

A professional desktop application for creating high-quality Quran recitation videos with synchronized Arabic and Bengali captions, powered by Gemini AI and FFmpeg.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or later.
- **FFmpeg**: The application automatically downloads `ffmpeg.exe` and `ffprobe.exe` to a local directory on first run. If you want to use a system version, check `src/main/ffmpeg.ts`.
- **Gemini API Key**: You must provide a valid [Google Gemini API Key](https://aistudio.google.com/app/apikey) in the **Settings** panel (⚙️ icon).

### Installation

```bash
npm install
```

### Running in Development

```bash
npm run dev
```

### Building for Windows

```bash
npm run build:win
```

## 🛠️ Key Components

### 1. AI Caption Extraction (`src/main/gemini.ts`)

- **Engine**: Gemini 2.0 Flash via the Google AI File Manager.
- **Process**: Uploads the source video to Google's servers, reads on-screen Arabic/Bengali text frame-by-frame, and returns structured JSON with exact timestamps.
- **Priority**: Always prioritizes the source video for maximum visual accuracy.

### 2. Video Rendering Pipeline (`src/main/ffmpeg.ts`)

- **Intel Arc Optimization**: Specifically configured to use `av1_qsv` or `h264_qsv` with hardware acceleration (`-hwaccel qsv`).
- **Filter Complex**: Dynamically generates `drawtext` filters for crystal-clear caption burn-in.
- **Looping**: Automatically loops background videos to match audio duration using a 1-second `xfade` (cross-fade).

### 3. Interactive Timeline (`src/renderer/src/components/Timeline.tsx`)

- **Features**: Zooming (Ctrl+Scroll), dragging captions to adjust timing, and instant preview sync.
- **Accuracy**: Uses `requestVideoFrameCallback` for frame-perfect caption rendering in the browser.

## ✅ Recent Enhancements

- **Fixed Timeline Duration**: Captions extending beyond media length are now fully visible and editable.
- **Eliminated Console Warnings**: Fixed "Passive Event Listener" errors during mouse wheel zooming.
- **Improved Error Logging**: FFmpeg render failures now display the last 10 lines of `stderr` to help diagnose font or filter issues.
- **Video-First Analysis**: Upgraded Gemini integration to analyze video files directly instead of just audio, ensuring "exact" caption replicas.

## 🔮 Future Roadmap

- [ ] **Packaging**: Finalize the `.exe` installer configuration in `electron-builder.yml`.
- [ ] **Hardware profiles**: Add automatic detection for NVENC (NVIDIA) and AMF (AMD) encoders.
- [ ] **Cloud Export**: Optional direct upload to YouTube/TikTok/Instagram.

---

_Created by Antigravity_
