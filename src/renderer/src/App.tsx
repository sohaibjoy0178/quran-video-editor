import React, { useState, useEffect } from 'react'
import { Toolbar } from './components/Toolbar'
import { Sidebar } from './components/Sidebar'
import { VideoPreview } from './components/VideoPreview'
import { Timeline } from './components/Timeline'
import { SettingsModal } from './components/SettingsModal'
import { RenderDialog } from './components/RenderDialog'
import { loadPersistedSettings } from './stores/editorStore'
import '../src/styles/index.css'

function App(): React.ReactElement {
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    loadPersistedSettings()
  }, [])

  return (
    <div className="app">
      <Toolbar onOpenSettings={() => setShowSettings(true)} />
      <Sidebar />
      <VideoPreview />
      <Timeline />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <RenderDialog />
      <div className="developer-credit">Developed by sohaibislamjoy</div>
    </div>
  )
}

export default App
