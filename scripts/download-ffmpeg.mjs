/**
 * Auto-download FFmpeg binary with QSV support for Windows.
 * Run: node scripts/download-ffmpeg.mjs
 */
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESOURCES_DIR = join(__dirname, '..', 'resources', 'ffmpeg')
const FFMPEG_PATH = join(RESOURCES_DIR, 'ffmpeg.exe')
const FFPROBE_PATH = join(RESOURCES_DIR, 'ffprobe.exe')

// Using gyan.dev full build which includes QSV support
const FFMPEG_URL =
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading FFmpeg from:\n  ${url}`)
    const follow = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        const file = createWriteStream(dest)
        res.on('data', (chunk) => {
          downloaded += chunk.length
          if (total) {
            const pct = ((downloaded / total) * 100).toFixed(1)
            process.stdout.write(`\r  Progress: ${pct}% (${(downloaded / 1048576).toFixed(1)} MB)`)
          }
        })
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          console.log('\n  Download complete.')
          resolve()
        })
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

async function main() {
  if (existsSync(FFMPEG_PATH) && existsSync(FFPROBE_PATH)) {
    console.log('FFmpeg already exists at:', FFMPEG_PATH)
    console.log('FFprobe already exists at:', FFPROBE_PATH)
    return
  }

  mkdirSync(RESOURCES_DIR, { recursive: true })

  const zipPath = join(RESOURCES_DIR, 'ffmpeg.zip')
  await download(FFMPEG_URL, zipPath)

  console.log('Extracting ffmpeg.exe and ffprobe.exe...')
  const psCmd = `
    $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, '\\\\')}')
    $ffmpegEntry = $zip.Entries | Where-Object { $_.Name -eq 'ffmpeg.exe' } | Select-Object -First 1
    $ffprobeEntry = $zip.Entries | Where-Object { $_.Name -eq 'ffprobe.exe' } | Select-Object -First 1
    if ($ffmpegEntry) {
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($ffmpegEntry, '${FFMPEG_PATH.replace(/\\/g, '\\\\')}', $true)
      Write-Host "Extracted ffmpeg.exe"
    } else {
      Write-Host "ffmpeg.exe not found in archive"
    }
    if ($ffprobeEntry) {
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($ffprobeEntry, '${FFPROBE_PATH.replace(/\\/g, '\\\\')}', $true)
      Write-Host "Extracted ffprobe.exe"
    } else {
      Write-Host "ffprobe.exe not found in archive"
    }
    $zip.Dispose()
    Remove-Item '${zipPath.replace(/\\/g, '\\\\')}' -Force
  `.trim()

  execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; ${psCmd}"`, {
    stdio: 'inherit'
  })

  if (existsSync(FFMPEG_PATH) && existsSync(FFPROBE_PATH)) {
    console.log('FFmpeg ready at:', FFMPEG_PATH)
    console.log('FFprobe ready at:', FFPROBE_PATH)
  } else {
    console.error('ERROR: Failed to extract ffmpeg/ffprobe binaries')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Failed to download FFmpeg:', err.message)
  process.exit(1)
})
