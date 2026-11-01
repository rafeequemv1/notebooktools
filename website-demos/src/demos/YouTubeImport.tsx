import { ChevronDown, FileText, Globe } from 'lucide-react'
import { Bar, Check, Collapse, Count, Popover, Spinner, Stage, States, Text, Window, type Act, type Rect } from '../kit'
import { ICON, LOGO, TOKENS, YouTubeMark } from './shared'
import './youtube.css'

// Feels-like-use story: on a YouTube video, the NotebookTools button sends the
// video to a notebook in two clicks. The notebook's Sources card (satellite)
// receives it, and its count rolls.

type Phase = 'idle' | 'busy' | 'done'
type S = { open: boolean; phase: Phase; added: boolean; count: number }

const initial: S = { open: false, phase: 'idle', added: false, count: 12 }
const POSTER: S = { open: true, phase: 'done', added: true, count: 13 }
const VIDEO = 'Introducing NotebookLM Video Overviews'
const NOTEBOOK = 'Research — AI tools'

async function script(a: Act<S>) {
  await a.wait(700)
  await a.move('nt-pill')
  await a.wait(250)
  await a.click()
  await a.set({ open: true })
  await a.wait(900)
  await a.move('import')
  await a.wait(250)
  await a.click()
  await a.set({ phase: 'busy' })
  await a.wait(1300)
  await a.set({ phase: 'done' })
  await a.wait(350)
  await a.set({ added: true })
  await a.wait(250)
  await a.set({ count: 13 })
  await a.wait(400)
  await a.move('rest')
  await a.wait(2400)
}

const PICKER_W = { wide: 288, compact: 268 }

function pickerAt(pill: Rect, layout: 'wide' | 'compact') {
  const width = PICKER_W[layout]
  const left = layout === 'wide' ? pill.x + pill.width - width : pill.x
  return { left, top: pill.y + pill.height + 8, width }
}

export default function YouTubeImport() {
  return (
    <Stage
      width={960}
      height={600}
      compact={{ below: 640, width: 358, height: 548 }}
      initial={initial}
      poster={POSTER}
      script={script}
      play="once"
      tokens={TOKENS}
      greys="cool"
      cursor={{ at: { wide: { x: 760, y: 150 }, compact: { x: 300, y: 90 } } }}
      className="nt-yt"
    >
      {(s, rect, layout) => (
        <>
          <Window url="youtube.com/watch?v=Qv3jF0sXc2Y" nav urlShape="pill" className="nt-yt__win">
            <div className="nt-yt__page">
              <div className="nt-yt__main">
                <div className="nt-yt__player">
                  <YouTubeMark size={56} className="nt-yt__play" />
                  <span className="nt-yt__progress"><i /></span>
                </div>
                <div className="nt-yt__title">{VIDEO}</div>
                {layout === 'compact' && (
                  <button type="button" className="nt-yt__pill is-solo" data-target="nt-pill" data-cursor="pointer" data-open={s.open || undefined}>
                    <img src={LOGO} alt="" width={18} height={18} />
                    NotebookLM
                  </button>
                )}
                <div className="nt-yt__meta">
                  <span className="nt-yt__avatar" />
                  <div className="nt-yt__channel">
                    <Text className="nt-yt__channel-name">Google</Text>
                    <Bar w={74} h={6} tone={2} />
                  </div>
                  <span className="nt-yt__spacer" />
                  {layout === 'wide' && (
                    <button type="button" className="nt-yt__pill" data-target="nt-pill" data-cursor="pointer" data-open={s.open || undefined}>
                      <img src={LOGO} alt="" width={18} height={18} />
                      NotebookLM
                    </button>
                  )}
                  {layout === 'wide' && <Bar className="nt-yt__ghost" w={88} h={34} r={17} tone={1} />}
                  {layout === 'wide' && <Bar className="nt-yt__ghost" w={64} h={34} r={17} tone={1} />}
                </div>
                <div className="nt-yt__desc">
                  <Bar w="72%" h={6} tone={2} />
                  <Bar w="58%" h={6} tone={2} />
                </div>
              </div>
              {layout === 'wide' && (
                <aside className="nt-yt__next">
                  {[64, 52, 70, 46].map((w, i) => (
                    <div key={i} className="nt-yt__next-row">
                      <span className="nt-yt__thumb" />
                      <div className="nt-yt__next-lines">
                        <Bar w={`${w + 20}%`} h={6} tone={3} />
                        <Bar w={`${w}%`} h={5} tone={2} />
                      </div>
                    </div>
                  ))}
                </aside>
              )}

            </div>
          </Window>

          {/* The picker opens under its button, as the extension draws it */}
          <Popover show={s.open} origin="top right" className="nt-yt__picker" style={pickerAt(rect("nt-pill"), layout)}>
            <div className="nt-yt__picker-head">Add to notebook</div>
            <div className="nt-yt__select">
              <span className="nt-yt__select-emoji" aria-hidden>🤖</span>
              <span className="nt-yt__select-name">{NOTEBOOK}</span>
              <ChevronDown {...ICON} className="nt-yt__select-caret" />
            </div>
            <button type="button" className="nt-yt__import" data-target="import" data-cursor="pointer" data-phase={s.phase}>
              <States
                value={s.phase}
                states={{
                  idle: <span>Import video</span>,
                  busy: <span className="nt-yt__import-row"><Spinner size={14} /> Importing</span>,
                  done: <span className="nt-yt__import-row"><Check on={s.phase === 'done'} size={15} /> Added to notebook</span>,
                }}
              />
            </button>
          </Popover>

          {/* Satellite: the notebook's Sources, straddling the window's left margin */}
          {layout === 'wide' && <div className="nt-yt__sources">
            <div className="nt-yt__sources-head">
              <span className="nt-yt__sources-emoji" aria-hidden>🤖</span>
              <div className="nt-yt__sources-name">
                <div className="nt-yt__sources-title">{NOTEBOOK}</div>
                <div className="nt-yt__sources-sub">
                  <Count value={s.count} className="nt-yt__count" /> sources
                </div>
              </div>
              <img className="nt-yt__gn" src="/assets/gemini-notebook-mark.png" alt="Gemini Notebook" width={22} height={22} />
            </div>
            <div className="nt-yt__list">
              <Collapse open={s.added} reveal="drop">
                <div className="nt-yt__src is-new">
                  <YouTubeMark size={16} />
                  <span className="nt-yt__src-name">{VIDEO}</span>
                </div>
              </Collapse>
              <div className="nt-yt__src">
                <FileText {...ICON} className="nt-yt__src-ico is-pdf" />
                <span className="nt-yt__src-name">RAG explained.pdf</span>
              </div>
              <div className="nt-yt__src">
                <Globe {...ICON} className="nt-yt__src-ico" />
                <Bar w="62%" h={6} tone={2} />
              </div>
              <div className="nt-yt__src">
                <FileText {...ICON} className="nt-yt__src-ico" />
                <Bar w="48%" h={6} tone={2} />
              </div>
            </div>
          </div>}
          <span data-target="rest" className="nt-yt__rest" />
        </>
      )}
    </Stage>
  )
}
