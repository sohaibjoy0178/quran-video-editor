import { spawn } from 'node:child_process'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn('electron-vite dev', {
  env,
  stdio: 'inherit',
  shell: true
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('Failed to start dev server:', error.message)
  process.exit(1)
})
