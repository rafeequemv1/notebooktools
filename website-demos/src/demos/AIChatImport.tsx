import { ArrowUp, ChevronDown, FileText, Globe, MessageSquare, Plus } from 'lucide-react'
import { Bar, Check, Collapse, Count, Popover, Spinner, Stage, States, Text, Window, type Act, type Rect } from '../kit'
import { ICON, LOGO, TOKENS } from './shared'
import './aichat.css'

// Feels-like-use story: in an AI chat, the "Send to NotebookLM" pill in the
// chat's top bar sends the whole conversation to a notebook as one source.
// The panel shows what it found (title, segments); the notebook's Sources card
// (satellite) receives it and its count rolls. platform-button.js,
// platform-import.html/js

type Phase = 'idle' | 'busy' | 'done'
type S = { open: boolean; phase: Phase; added: boolean; count: number }

const initial: S = { open: false, phase: 'idle', added: false, count: 12 }
const POSTER: S = { open: true, phase: 'done', added: true, count: 13 }
const CHAT = 'RAG evaluation methods'
const SOURCE = `[CHATGPT] ${CHAT}`
const NOTEBOOK = 'Research — AI tools'

async function script(a: Act<S>) {
  await a.wait(700)
  await a.move('nt-pill')
  await a.wait(250)
  await a.click()
  await a.set({ open: true })
  await a.wait(1100)
  await a.move('send')
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

const PICKER_W = { wide: 300, compact: 280 }

function pickerAt(pill: Rect, layout: 'wide' | 'compact') {
  const width = PICKER_W[layout]
  const left = layout === 'wide' ? pill.x + pill.width - width : Math.max(12, pill.x + pill.width - width)
  return { left, top: pill.y + pill.height + 8, width }
}

export default function AIChatImport() {
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
      cursor={{ at: { wide: { x: 620, y: 300 }, compact: { x: 200, y: 300 } } }}
      className="nt-ai"
    >
      {(s, rect, layout) => {
        const wide = layout === 'wide'
        return (
          <>
            <Window url="chatgpt.com/c/6a1f2b9e-rag" nav urlShape="pill" className="nt-ai__win">
              <div className="nt-ai__page">
                {wide && (
                  <aside className="nt-ai__side">
                    <span className="nt-ai__new"><Plus {...ICON} size={15} />New chat</span>
                    <span className="nt-ai__side-label">Chats</span>
                    <span className="nt-ai__chat is-active">{CHAT}</span>
                    {[70, 56, 64, 48].map((w, i) => <span key={i} className="nt-ai__chat"><Bar w={`${w}%`} h={6} tone={2} /></span>)}
                  </aside>
                )}
                <div className="nt-ai__main">
                  <div className="nt-ai__top">
                    <Text className="nt-ai__title">{CHAT}</Text>
                    <span className="nt-ai__spacer" />
                    <button type="button" className="nt-ai__pill" data-target="nt-pill" data-cursor="pointer" data-open={s.open || undefined}>
                      <img src={LOGO} alt="" width={16} height={16} />
                      Send to NotebookLM
                    </button>
                    {wide && <Bar className="nt-ai__ghost" w={64} h={30} r={15} tone={1} />}
                  </div>
                  <div className="nt-ai__thread">
                    <div className="nt-ai__ask">Compare three ways to evaluate a RAG system</div>
                    <div className="nt-ai__answer">
                      <Text className="nt-ai__lead">Three approaches work well together:</Text>
                      {['Retrieval recall', 'Answer faithfulness', 'Human review'].map((t, i) => (
                        <div key={t} className="nt-ai__point">
                          <span className="nt-ai__num">{i + 1}</span>
                          <div className="nt-ai__point-body">
                            <b>{t}</b>
                            <Bar w={wide ? `${[88, 80, 72][i]}%` : '92%'} h={6} tone={2} />
                            <Bar w={wide ? `${[62, 70, 54][i]}%` : '70%'} h={6} tone={2} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="nt-ai__composer">
                    <span className="nt-ai__composer-text">Ask anything</span>
                    <span className="nt-ai__send"><ArrowUp {...ICON} size={15} /></span>
                  </div>
                </div>
              </div>
            </Window>

            {/* The panel opens under the pill, as the extension draws it */}
            <Popover show={s.open} origin="top right" className="nt-ai__picker" style={pickerAt(rect('nt-pill'), layout)}>
              <div className="nt-ai__picker-head">
                <img src={LOGO} alt="" width={18} height={18} />
                <div className="nt-ai__picker-text">
                  <b>{SOURCE}</b>
                  <em>6 segments · chatgpt.com/c/6a1f…</em>
                </div>
              </div>
              <div className="nt-ai__label">Notebook</div>
              <div className="nt-ai__select">
                <span className="nt-ai__select-emoji" aria-hidden>🤖</span>
                <span className="nt-ai__select-name">{NOTEBOOK}</span>
                <ChevronDown {...ICON} className="nt-ai__select-caret" />
              </div>
              <button type="button" className="nt-ai__go" data-target="send" data-cursor="pointer" data-phase={s.phase}>
                <States
                  value={s.phase}
                  states={{
                    idle: <span>Send to notebook</span>,
                    busy: <span className="nt-ai__go-row"><Spinner size={14} /> Sending to NotebookLM</span>,
                    done: <span className="nt-ai__go-row"><Check on={s.phase === 'done'} size={15} /> Added to "{NOTEBOOK}"</span>,
                  }}
                />
              </button>
            </Popover>

            {/* Satellite: the notebook's Sources, straddling the window's left margin */}
            {wide && (
              <div className="nt-ai__sources">
                <div className="nt-ai__sources-head">
                  <span className="nt-ai__sources-emoji" aria-hidden>🤖</span>
                  <div className="nt-ai__sources-name">
                    <div className="nt-ai__sources-title">{NOTEBOOK}</div>
                    <div className="nt-ai__sources-sub"><Count value={s.count} /> sources</div>
                  </div>
                  <img className="nt-ai__gn" src="/assets/gemini-notebook-mark.png" alt="Gemini Notebook" width={22} height={22} />
                </div>
                <div className="nt-ai__list">
                  <Collapse open={s.added} reveal="drop">
                    <div className="nt-ai__src is-new">
                      <MessageSquare {...ICON} className="nt-ai__src-ico is-chat" />
                      <span className="nt-ai__src-name">{SOURCE}</span>
                    </div>
                  </Collapse>
                  <div className="nt-ai__src">
                    <FileText {...ICON} className="nt-ai__src-ico is-pdf" />
                    <span className="nt-ai__src-name">RAG explained.pdf</span>
                  </div>
                  <div className="nt-ai__src">
                    <Globe {...ICON} className="nt-ai__src-ico" />
                    <Bar w="62%" h={6} tone={2} />
                  </div>
                  <div className="nt-ai__src">
                    <FileText {...ICON} className="nt-ai__src-ico" />
                    <Bar w="48%" h={6} tone={2} />
                  </div>
                </div>
              </div>
            )}
            <span data-target="rest" className="nt-ai__rest" />
          </>
        )
      }}
    </Stage>
  )
}
