import { useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './kit/stageshow.css'
import './host.css'
import YouTubeImport from './demos/YouTubeImport'
import NotebooksTable from './demos/NotebooksTable'
import RibbonExport from './demos/RibbonExport'

// Every Stageshow demo the website can mount: <div data-stage="youtube"></div>
const DEMOS: Record<string, ComponentType> = {
  youtube: YouTubeImport,
  hub: NotebooksTable,
  'chat-export': RibbonExport,
}

function Host({ Demo, label }: { Demo: ComponentType; label: string }) {
  const [run, setRun] = useState(0)
  return (
    <div className="nt-stage-host">
      <Demo key={run} />
      <button type="button" className="nt-stage-replay" onClick={() => setRun((n) => n + 1)} aria-label={`Replay the ${label} demo`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Replay
      </button>
    </div>
  )
}

function mountAll() {
  document.querySelectorAll<HTMLElement>('[data-stage]').forEach((el) => {
    if (el.dataset.stageMounted) return
    const Demo = DEMOS[el.dataset.stage || '']
    if (!Demo) return
    el.dataset.stageMounted = '1'
    createRoot(el).render(<Host Demo={Demo} label={el.dataset.stageLabel || el.dataset.stage || 'feature'} />)
  })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll)
else mountAll()
;(window as unknown as { NTStage: { mountAll: () => void } }).NTStage = { mountAll }
