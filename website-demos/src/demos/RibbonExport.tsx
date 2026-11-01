import type { ReactNode } from 'react'
import { ChevronDown, Copy, Download, FileText, Folder, Link2, Camera, NotebookPen } from 'lucide-react'
import { Bar, Popover, Spinner, Stage, States, Window, type Act } from '../kit'
import { ICON, LOGO, TOKENS } from './shared'
import './ribbon.css'

// Feels-like-use story: inside a notebook, the NotebookTools ribbon sits
// between the header and the panels. Export, Markdown, and the chat lands in
// Downloads as a file.

type Phase = 'idle' | 'busy' | 'done'
type S = { menu: boolean; phase: Phase; download: boolean }

const initial: S = { menu: false, phase: 'idle', download: false }
const POSTER: S = { menu: false, phase: 'done', download: true }
const TITLE = 'Graphene: Status and prospects'
const FILE = 'Graphene - chat.md'

async function script(a: Act<S>) {
  await a.wait(700)
  await a.move('export')
  await a.wait(250)
  await a.click()
  await a.set({ menu: true })
  await a.wait(800)
  await a.move('fmt-md')
  await a.wait(250)
  await a.click()
  await a.set({ menu: false, phase: 'busy' })
  await a.wait(700)
  await a.set({ phase: 'done', download: true })
  await a.wait(500)
  await a.move('rest')
  await a.wait(2400)
}

function Btn({ icon, label, target, open, caret }: { icon: ReactNode; label: string; target?: string; open?: boolean; caret?: boolean }) {
  return (
    <span className="nt-rb__btn" data-target={target} data-cursor={target ? 'pointer' : undefined} data-open={open || undefined}>
      {icon}
      <span>{label}</span>
      {caret && <ChevronDown {...ICON} size={13} className="nt-rb__caret" />}
    </span>
  )
}

export default function RibbonExport() {
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
      cursor={{ at: { wide: { x: 560, y: 420 }, compact: { x: 280, y: 400 } } }}
      className="nt-rb"
    >
      {(s, rect, layout) => {
        const wide = layout === 'wide'
        const exp = rect('export')
        return (
          <>
            <Window url="notebook.google.com/notebook/308bd2c1" nav urlShape="pill" className="nt-rb__win">
              <div className="nt-rb__page">
                <div className="nt-rb__head">
                  <img className="nt-rb__nb-icon" src="/assets/gemini-notebook-mark.png" alt="Gemini Notebook" width={32} height={32} />
                  <span className="nt-rb__title">{TITLE}</span>
                  {wide && <span className="nt-rb__head-tools"><Bar w={70} h={28} r={14} tone={1} /><Bar w={28} h={28} r={14} tone={1} /></span>}
                </div>

                {/* The NotebookTools ribbon */}
                <div className="nt-rb__ribbon">
                  <img src={LOGO} alt="" width={18} height={18} className="nt-rb__mark" />
                  {wide && (
                    <div className="nt-rb__group">
                      <span className="nt-rb__chip"><Folder {...ICON} size={14} />PhD</span>
                    </div>
                  )}
                  <div className="nt-rb__group">
                    {wide && <span className="nt-rb__gname">Chat</span>}
                    <Btn icon={<Copy {...ICON} size={15} />} label="Copy" />
                    <span className="nt-rb__btn" data-target="export" data-cursor="pointer" data-open={s.menu || undefined}>
                      <States
                        value={s.phase}
                        states={{
                          idle: <Download {...ICON} size={15} />,
                          busy: <Spinner size={14} />,
                          done: <Download {...ICON} size={15} />,
                        }}
                      />
                      <span>Export</span>
                      <ChevronDown {...ICON} size={13} className="nt-rb__caret" />
                    </span>
                  </div>
                  {wide && (
                    <div className="nt-rb__group">
                      <span className="nt-rb__gname">Sources</span>
                      <Btn icon={<Link2 {...ICON} size={15} />} label="Add links" />
                    </div>
                  )}
                  {wide && (
                    <div className="nt-rb__group">
                      <span className="nt-rb__gname">Create</span>
                      <Btn icon={<NotebookPen {...ICON} size={15} />} label="Blog" />
                      <Btn icon={<Camera {...ICON} size={15} />} label="Snapshot" />
                    </div>
                  )}
                  <span className="nt-rb__spacer" />
                  {wide && <span className="nt-rb__prompts">/ Prompts</span>}
                </div>

                <div className="nt-rb__panels">
                  {wide && (
                    <section className="nt-rb__panel nt-rb__sources">
                      <div className="nt-rb__panel-title">Sources</div>
                      {[62, 48, 70, 54, 66, 44].map((w, i) => (
                        <div key={i} className="nt-rb__src">
                          <FileText {...ICON} size={15} className={i === 0 ? 'is-pdf' : undefined} />
                          <Bar w={`${w}%`} h={6} tone={2} />
                        </div>
                      ))}
                    </section>
                  )}
                  <section className="nt-rb__panel nt-rb__chat">
                    <div className="nt-rb__ask">What makes graphene's electrons unusual?</div>
                    <div className="nt-rb__answer">
                      <Bar w="94%" h={6} tone={3} />
                      <Bar w="88%" h={6} tone={3} />
                      <Bar w="91%" h={6} tone={3} />
                      <Bar w="62%" h={6} tone={3} />
                    </div>
                    <div className="nt-rb__answer">
                      <Bar w="90%" h={6} tone={2} />
                      <Bar w="76%" h={6} tone={2} />
                    </div>
                    <div className="nt-rb__ask is-filler"><Bar w={180} h={6} tone={3} /></div>
                    <div className="nt-rb__answer">
                      <Bar w="92%" h={6} tone={2} />
                      <Bar w="85%" h={6} tone={2} />
                      <Bar w="58%" h={6} tone={2} />
                    </div>
                  </section>
                  {wide && (
                    <section className="nt-rb__panel nt-rb__studio">
                      <div className="nt-rb__panel-title">Studio</div>
                      <div className="nt-rb__tiles">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <Bar key={i} w="100%" h={38} r={12} tone={1} />)}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </Window>

            <Popover show={s.menu} origin="top left" className="nt-rb__menu" style={{ left: exp.x, top: exp.y + exp.height + 6 }}>
              <div className="nt-rb__menu-label">Export chat as</div>
              <div className="nt-rb__menu-item" data-target="fmt-md" data-cursor="pointer"><FileText {...ICON} size={15} />Markdown</div>
              <div className="nt-rb__menu-item"><FileText {...ICON} size={15} />PDF</div>
              <div className="nt-rb__menu-item"><FileText {...ICON} size={15} />Word (.docx)</div>
              <div className="nt-rb__menu-item"><FileText {...ICON} size={15} />HTML</div>
            </Popover>

            {/* Chrome's download bubble, where the browser shows it */}
            <div className="nt-rb__dl" data-show={s.download || undefined}>
              <span className="nt-rb__dl-ico"><FileText {...ICON} size={16} /></span>
              <span className="nt-rb__dl-text">
                <span className="nt-rb__dl-name">{FILE}</span>
                <span className="nt-rb__dl-meta">4.2 KB · Done</span>
              </span>
            </div>
            <span data-target="rest" className="nt-rb__rest" />
          </>
        )
      }}
    </Stage>
  )
}
