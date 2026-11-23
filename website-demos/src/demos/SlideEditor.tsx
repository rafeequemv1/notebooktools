import { Download, Image as ImageIcon, Play, Shapes, Type } from 'lucide-react'
import { Bar, Popover, Spinner, Stage, States, Window, type Act } from '../kit'
import { DownloadButton, DownloadRow, ICON, LOGO, TOKENS, type DlState } from './shared'
import { Slide } from './SlidesToBlog'
import './slides.css'
import './editor.css'

// Feels-like-use story: a NotebookLM slide deck is a flat picture per slide.
// The slide editor reads it: text becomes text boxes, the chart a picture of its
// own. Click the title, change the year, download PowerPoint. slide-engine.js,
// slide-editor.js

/** read: 0 flat picture, 1 reading, 2 editable */
type S = { read: 0 | 1 | 2; sel: boolean; hl: boolean; year: string; dl: DlState; bubble: boolean }

const initial: S = { read: 0, sel: false, hl: false, year: '2025', dl: 'idle', bubble: false }
const POSTER: S = { read: 2, sel: true, hl: false, year: '2026', dl: 'done', bubble: true }
const FILE = 'Launch deck.pptx'

async function script(a: Act<S>) {
  await a.wait(600)
  await a.set({ read: 1 })
  await a.wait(1500)
  await a.set({ read: 2 })
  await a.wait(900)
  await a.move('title')
  await a.wait(200)
  await a.click()
  await a.set({ sel: true })
  await a.wait(500)
  await a.move('year')
  await a.click(undefined, { double: true })
  await a.set({ hl: true })
  await a.wait(450)
  await a.set({ hl: false, year: '' })
  await a.type('year', '2026', { interval: 110 })
  await a.wait(700)
  await a.move('dl-ppt')
  await a.wait(200)
  await a.click()
  await a.set({ dl: 'progress' })
  await a.wait(1000)
  await a.set({ dl: 'done', bubble: true })
  await a.wait(400)
  await a.move('rest')
  await a.wait(2600)
}

export default function SlideEditor() {
  return (
    <Stage
      width={960}
      height={600}
      compact={{ below: 640, width: 358, height: 540 }}
      initial={initial}
      poster={POSTER}
      script={script}
      play="once"
      tokens={TOKENS}
      greys="cool"
      cursor={{ at: { wide: { x: 700, y: 520 }, compact: { x: 300, y: 470 } } }}
      className="nt-se nt-sl"
    >
      {(s, rect, layout) => {
        const wide = layout === 'wide'
        const dl = rect('dl-btn')
        const bubbleW = wide ? 300 : 280
        const editable = s.read === 2
        return (
          <>
            <Window url="Slide editor · NotebookTools" nav urlShape="pill" className="nt-se__win" toolbar={<DownloadButton state={s.dl} />}>
              <div className="nt-se__app">
                <div className="nt-se__bar">
                  <img src={LOGO} alt="" width={18} height={18} />
                  <span className="nt-se__deck">Launch deck</span>
                  {wide && (
                    <span className="nt-se__tools">
                      <span className="nt-se__tool"><Type {...ICON} size={15} />Text</span>
                      <span className="nt-se__tool"><ImageIcon {...ICON} size={15} />Picture</span>
                      <span className="nt-se__tool"><Shapes {...ICON} size={15} />Shape</span>
                    </span>
                  )}
                  <span className="nt-se__spacer" />
                  {wide && <span className="nt-se__tool is-quiet"><Play {...ICON} size={15} />Present</span>}
                  <span className="nt-se__primary" data-target="dl-ppt" data-cursor="pointer"><Download {...ICON} size={15} />{wide ? 'Download PowerPoint' : 'PowerPoint'}</span>
                </div>
                <div className="nt-se__body">
                  {wide && (
                    <div className="nt-se__rail">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className="nt-se__thumb" data-on={i === 0 || undefined}>
                          <em>{i + 1}</em>
                          <Slide i={i === 0 ? 2 : [0, 1, 3, 4][i]} width={92} />
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="nt-se__canvas">
                    <div className="nt-se__slide" data-read={s.read}>
                      <span className="nt-se__box is-kicker" data-on={editable || undefined}><span className="nt-se__kicker">Pricing</span></span>
                      <span className="nt-se__box is-title" data-on={editable || undefined} data-sel={s.sel || undefined} data-target="title" data-cursor={editable ? 'text' : undefined}>
                        <span className="nt-se__title">
                          Launch plan <span className="nt-se__year" data-target="year" data-hl={s.hl || undefined}>{s.year}</span>
                          {s.sel && <i className="nt-se__caret" />}
                        </span>
                        {s.sel && <span className="nt-se__handles" aria-hidden><i /><i /><i /><i /><i /><i /><i /><i /></span>}
                      </span>
                      <span className="nt-se__box is-body" data-on={editable || undefined}>
                        <span className="nt-se__bullet">Usage-based, from $12</span>
                        <span className="nt-se__bullet">Free for teams under 5</span>
                        <span className="nt-se__bullet">Annual plans save 20%</span>
                      </span>
                      <span className="nt-se__box is-pic" data-on={editable || undefined}>
                        <span className="nt-se__chart"><i style={{ height: '38%' }} /><i style={{ height: '62%' }} /><i style={{ height: '90%' }} /></span>
                      </span>
                      <span className="nt-se__reading" data-show={s.read === 1 || undefined}><Spinner size={14} /> Reading text…</span>
                    </div>
                    <div className="nt-se__status">
                      <States value={s.read === 2 ? 'done' : 'flat'} states={{ flat: <span>1 picture per slide</span>, done: <span><b>3 text boxes</b> · 1 picture · editable</span> }} />
                    </div>
                  </div>
                  {wide && (
                    <aside className="nt-se__inspect">
                      <div className="nt-se__inspect-title">Text</div>
                      <div className="nt-se__field"><span>Font</span><b>Google Sans</b></div>
                      <div className="nt-se__field"><span>Size</span><b>40</b></div>
                      <div className="nt-se__styles"><i>B</i><i className="is-i">I</i><i className="is-c" /></div>
                      <div className="nt-se__inspect-title">Arrange</div>
                      <Bar w="80%" h={6} tone={2} />
                      <Bar w="60%" h={6} tone={2} />
                    </aside>
                  )}
                </div>
              </div>
            </Window>

            {/* Chrome's download bubble */}
            <Popover show={s.bubble} origin="top right" className="nt-dlb" style={{ left: Math.max(8, dl.x + dl.width - bubbleW + 6), top: dl.y + dl.height + 8, width: bubbleW }}>
              <DownloadRow name={FILE} size="2.4 MB" kind="doc" target="dl-file" />
            </Popover>
            <span data-target="rest" className="nt-se__rest" />
          </>
        )
      }}
    </Stage>
  )
}
