import { ChevronDown, ChevronRight, FileText, Folder, LayoutGrid, NotebookPen, Plus, Presentation } from 'lucide-react'
import { Bar, Popover, Stage, Window, type Act } from '../kit'
import { DownloadButton, DownloadRow, ICON, LOGO, TOKENS, type DlState } from './shared'
import { Slide } from './SlidesToBlog'
import './slides.css'
import './carousel.css'

// Flow story: Create → Carousel in the in-notebook ribbon turns a Studio slide
// deck into a LinkedIn document carousel. Pick it, type your handle (it lands on
// every page), Download: Chrome's download button fills. workflows/carousel

type S = { menu: boolean; dialog: boolean; handle: string; dl: DlState; bubble: boolean }

const initial: S = { menu: false, dialog: false, handle: '', dl: 'idle', bubble: false }
const POSTER: S = { menu: false, dialog: true, handle: '@mayachen', dl: 'done', bubble: true }
const FILE = 'Launch deck carousel.pdf'
const GN_MARK = '/assets/gemini-notebook-mark.png'

async function script(a: Act<S>) {
  await a.wait(700)
  await a.move('create-btn')
  await a.wait(200)
  await a.click()
  await a.set({ menu: true })
  await a.wait(700)
  await a.move('carousel-item')
  await a.wait(200)
  await a.click()
  await a.set({ menu: false, dialog: true })
  await a.wait(900)
  await a.move('handle')
  await a.click()
  await a.type('handle', '@mayachen', { interval: 90 })
  await a.wait(800)
  await a.move('download')
  await a.wait(200)
  await a.click()
  await a.set({ dl: 'progress' })
  await a.wait(1000)
  await a.set({ dl: 'done', bubble: true })
  await a.wait(400)
  await a.move('rest')
  await a.wait(2600)
}

function Page({ i, n, handle, width }: { i: number; n: number; handle: string; width: number }) {
  return (
    <span className="nt-ca__page" style={{ width, height: width * 1.25 }}>
      <span className="nt-ca__page-slide"><Slide i={i} width={width - 16} /></span>
      <span className="nt-ca__page-foot">
        <span className="nt-ca__handle">{handle || ' '}</span>
        <span className="nt-ca__num">{n} / 6</span>
      </span>
      {n < 6 && <ChevronRight className="nt-ca__swipe" size={12} strokeWidth={2.2} />}
    </span>
  )
}

export default function Carousel() {
  return (
    <Stage
      width={960}
      height={600}
      compact={{ below: 640, width: 358, height: 560 }}
      initial={initial}
      poster={POSTER}
      script={script}
      play="once"
      tokens={TOKENS}
      greys="cool"
      cursor={{ at: { wide: { x: 560, y: 470 }, compact: { x: 280, y: 470 } } }}
      className="nt-ca nt-sl"
    >
      {(s, rect, layout) => {
        const wide = layout === 'wide'
        const btn = rect('create-btn')
        const dl = rect('dl-btn')
        const bubbleW = wide ? 300 : 280
        const dialogW = wide ? 470 : 318
        return (
          <>
            <Window url="notebook.google.com/notebook/5a17c0de" nav urlShape="pill" className="nt-sl__win" toolbar={<DownloadButton state={s.dl} />}>
              <div className="nt-sl__view">
                <div className="nt-sl__page">
                  <div className="nt-sl__head">
                    <img src={GN_MARK} alt="Gemini Notebook" width={30} height={30} />
                    <span className="nt-sl__title">Product launch 2026</span>
                  </div>
                  <div className="nt-sl__ribbon">
                    <img src={LOGO} alt="" width={18} height={18} />
                    {wide && <span className="nt-sl__chip"><Folder {...ICON} size={14} />Marketing</span>}
                    <span className="nt-sl__rbtn" data-target="create-btn" data-cursor="pointer" data-open={s.menu || undefined}>
                      <Plus {...ICON} size={15} />Create<ChevronDown {...ICON} size={13} />
                    </span>
                    {wide && <span className="nt-sl__rbtn is-quiet"><FileText {...ICON} size={15} />Export</span>}
                  </div>
                  <div className="nt-sl__panels">
                    {wide && (
                      <section className="nt-sl__panel">
                        <div className="nt-sl__panel-title">Sources</div>
                        {[62, 50, 70, 44].map((w, i) => <div key={i} className="nt-sl__src"><FileText {...ICON} size={15} /><Bar w={`${w}%`} h={6} tone={2} /></div>)}
                      </section>
                    )}
                    <section className="nt-sl__panel nt-sl__chat">
                      <Bar w="92%" h={6} tone={3} /><Bar w="86%" h={6} tone={3} /><Bar w="64%" h={6} tone={3} />
                      <div style={{ height: 10 }} />
                      <Bar w="90%" h={6} tone={2} /><Bar w="72%" h={6} tone={2} />
                    </section>
                    {wide && (
                      <section className="nt-sl__panel">
                        <div className="nt-sl__panel-title">Studio</div>
                        <div className="nt-sl__artifact">
                          <span className="nt-sl__artifact-ico"><Presentation {...ICON} size={16} /></span>
                          <span className="nt-sl__artifact-text"><b>Launch deck</b><em>Slide deck · 6 slides</em></span>
                        </div>
                        <div className="nt-sl__thumbs">{[0, 1, 2, 3].map((i) => <Slide key={i} i={i} width={78} />)}</div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </Window>

            {/* Create menu, from the ribbon */}
            <Popover show={s.menu} origin="top left" className="nt-ca__menu" style={{ left: btn.x, top: btn.y + btn.height + 6 }}>
              <div className="nt-ca__menu-title">Create from this notebook</div>
              <div className="nt-ca__item"><NotebookPen {...ICON} size={15} /><span><b>Blog post</b><em>with slide images</em></span></div>
              <div className="nt-ca__item" data-target="carousel-item" data-cursor="pointer"><LayoutGrid {...ICON} size={15} /><span><b>Carousel</b><em>from a slide deck</em></span></div>
              <div className="nt-ca__item"><Presentation {...ICON} size={15} /><span><b>Edit a slide deck</b><em>editable text, PowerPoint</em></span></div>
            </Popover>

            {/* The carousel dialog */}
            <Popover show={s.dialog} origin="top center" className="nt-ca__dialog" style={{ left: wide ? 245 : 20, top: wide ? 96 : 84, width: dialogW }}>
              <div className="nt-ca__dialog-title">Slide deck to carousel</div>
              <div className="nt-ca__row">
                <span className="nt-ca__label">For</span>
                <span className="nt-ca__seg"><i className="is-on">LinkedIn PDF</i><i>Instagram images</i></span>
              </div>
              <div className="nt-ca__row">
                <span className="nt-ca__label">Your handle</span>
                <span className="nt-ca__field" data-target="handle" data-cursor="text">{s.handle || <em>@yourname</em>}</span>
              </div>
              <div className="nt-ca__pages">
                {[0, 1, 2].map((i) => <Page key={i} i={i} n={i + 1} handle={s.handle} width={wide ? 128 : 88} />)}
              </div>
              <div className="nt-ca__actions">
                <span className="nt-ca__ghost">Cancel</span>
                <span className="nt-ca__go" data-target="download" data-cursor="pointer">Download</span>
              </div>
            </Popover>

            {/* Chrome's download bubble */}
            <Popover show={s.bubble} origin="top right" className="nt-dlb" style={{ left: Math.max(8, dl.x + dl.width - bubbleW + 6), top: dl.y + dl.height + 8, width: bubbleW }}>
              <DownloadRow name={FILE} size="3.1 MB" kind="doc" target="dl-file" />
            </Popover>
            <span data-target="rest" className="nt-ca__rest" />
          </>
        )
      }}
    </Stage>
  )
}
