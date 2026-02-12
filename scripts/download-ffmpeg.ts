import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { get } from 'https';
import { execSync } from 'child_process';
import { finished } from 'stream/promises';
import { Readable } from 'stream';

// Simplified download script for FFmpeg (Windows)
const FFMPEG_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
const RESOURCES_DIR = join(process.cwd(), 'resources', 'ffmpeg');
const ZIP_PATH = join(process.cwd(), 'ffmpeg.zip');

async function downloadFile(url: string, dest: string) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('Downloading FFmpeg...');
  if (!existsSync(RESOURCES_DIR)) {
    mkdirSync(RESOURCES_DIR, { recursive: true });
  }

  await downloadFile(FFMPEG_URL, ZIP_PATH);
  console.log('Download complete. Extracting...');

  // Use powershell to extract
  try {
      // Clean previous extraction
      // Extract specific file if possible, or extract all and move
      execSync(`powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${process.cwd()}' -Force"`);
      
      // Move ffmpeg.exe to resources/ffmpeg/
      // The zip has a folder structure like ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
      const extractedRoot = join(process.cwd(), 'ffmpeg-master-latest-win64-gpl');
      const binPath = join(extractedRoot, 'bin', 'ffmpeg.exe');
      const ffprobePath = join(extractedRoot, 'bin', 'ffprobe.exe');
      
      const destFfmpeg = join(RESOURCES_DIR, 'ffmpeg.exe');
      // const destFfprobe = join(RESOURCES_DIR, 'ffprobe.exe'); // probe uses ffmpeg command too? No, ffprobe is separate.
      // Wait, my code uses `spawn(ffmpegPath, ...)`?
      // In `ffmpeg.ts`: `ipcMain.handle('ffmpeg:probe', ...)` uses `ffmpegPath`?
      // No, let's check `ffmpeg.ts`.
      
      // Check ffmpeg.ts:
      // const ffprobe = spawn(ffmpegPath, ... -v error ...)
      // Wait, `ffmpeg -i file` can probe, but `ffprobe` is a separate binary usually.
      // My code spawns `ffmpegPath` with arguments.
      // Line 33: `const ffprobe = spawn(ffmpegPath, ...)`
      // Is it invoking `ffmpeg` or `ffprobe`?
      // Arguments: `['-v', 'error', '-select_streams', 'v:0', '-show_entries', ...]`
      // These are `ffprobe` arguments! `ffmpeg` doesn't support `-show_entries` directly in the same way without `-f ffmetadata` or acts differently.
      // Actually `ffprobe` arguments are specific.
      // If `ffmpegPath` points to `ffmpeg.exe`, running `ffmpeg.exe -show_entries` might fail or work depending on version/build, but usually `ffprobe.exe` is needed.
      // Standard `ffmpeg` binary does NOT include `ffprobe` functionality in `ffmpeg` command.
      // I MUST have `ffprobe.exe` and point to it, OR use `ffmpeg -i input` and parse stderr.
      // My code uses `spawn(ffmpegPath, ...)` where `ffmpegPath` is `ffmpeg.exe`.
      
      // FIX: I need `ffprobe.exe` as well and `ffmpeg.ts` should likely use it.
      // Or I should parse `ffmpeg -i` output which is less reliable json.
      // Correct approach: Download both.
      
      const fs = require('fs');
      if (fs.existsSync(binPath)) {
          fs.renameSync(binPath, destFfmpeg);
          console.log(`Moved ffmpeg.exe to ${destFfmpeg}`);
      }
      
      // Also move ffprobe if present
      const destProbe = join(RESOURCES_DIR, 'ffprobe.exe'); 
      if (fs.existsSync(ffprobePath)) {
          fs.renameSync(ffprobePath, destProbe);
           console.log(`Moved ffprobe.exe to ${destProbe}`);
      }

      // Cleanup
      fs.rmSync(extractedRoot, { recursive: true, force: true });
      fs.unlinkSync(ZIP_PATH);
      console.log('Done!');
      
  } catch (e) {
      console.error('Extraction failed:', e);
  }
})();
