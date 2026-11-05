import type { ReactNode } from 'react'
import { ChevronDown, FileText, Folder, NotebookPen, Presentation } from 'lucide-react'
import { Bar, Check, Collapse, Count, Popover, Scroll, Spinner, Stage, States, Window, type Act } from '../kit'
import { DownloadButton, DownloadRow, ICON, LOGO, TOKENS, type DlState } from './shared'
import './slides.css'

// Flow story: a slide deck in Studio becomes a full blog post. Blog in the
// ribbon, pick the deck, Write blog: import the deck, write, embed every
// slide. The post downloads as HTML the way Chrome shows it (button, ring,
// bubble); open the file and it loads in a new tab, slides in place as figures.

type Step = 'idle' | 'import' | 'write' | 'images' | 'done'
/** load: 0 not opened, 1 tab open and loading, 2 painted, 3 images in */
type S = { menu: boolean; step: Step; images: number; dl: DlState; bubble: boolean; load: 0 | 1 | 2 | 3 }

const initial: S = { menu: false, step: 'idle', images: 0, dl: 'idle', bubble: false, load: 0 }
const POSTER: S = { menu: false, step: 'done', images: 6, dl: 'done', bubble: false, load: 3 }
const FILE = 'launch-plan-2026.html'
const GN_MARK = '/assets/gemini-notebook-mark.png'

const SLIDES = [
  { kicker: 'Launch 2026', title: 'Winning mid-market teams', kind: 'cover' },
  { kicker: 'Ideal customer', title: 'Teams of 20 to 200', kind: 'people' },
  { kicker: 'Pricing', title: 'Usage-based, from $12', kind: 'bars' },
  { kicker: 'Channels', title: 'Partners first', kind: 'split' },
  { kicker: 'First 90 days', title: 'Three launch waves', kind: 'timeline' },
  { kicker: 'Goal', title: '1,000 paying teams', kind: 'number' },
] as const

/** One slide of the "Launch deck", drawn at 320 x 180 and scaled to fit. */
export function Slide({ i, width }: { i: number; width: number }) {
  const s = SLIDES[i]
  return (
    <span className="nt-sl__slide-box" style={{ width, height: (width * 9) / 16 }}>
      <span className={`nt-sl__slide is-${s.kind}`} style={{ transform: `scale(${width / 320})` }}>
        <span className="nt-sl__slide-kicker">{s.kicker}</span>
        <span className="nt-sl__slide-title">{s.title}</span>
        {s.kind === 'people' && <span className="nt-sl__slide-people"><i /><i /><i /></span>}
        {s.kind === 'bars' && <span className="nt-sl__slide-bars"><i style={{ height: 24 }} /><i style={{ height: 38 }} /><i style={{ height: 56 }} /></span>}
        {s.kind === 'timeline' && <span className="nt-sl__slide-line"><i /><i /><i /></span>}
        {s.kind === 'number' && <span className="nt-sl__slide-num">1,000</span>}
        {s.kind === 'split' && <span className="nt-sl__slide-split"><i /><i /></span>}
        <span className="nt-sl__slide-page">{String(i + 1).padStart(2, '0')}</span>
      </span>
    </span>
  )
}

async function script(a: Act<S>) {
  await a.wait(700)
  await a.move('blog-btn')
  await a.wait(200)
  await a.click()
  await a.set({ menu: true })
  await a.wait(800)
  await a.move('write')
  await a.wait(200)
  await a.click()
  await a.set({ step: 'import' })
  await a.wait(700)
  await a.set({ step: 'write' })
  await a.wait(1100)
  await a.set({ step: 'images' })
  for (let n = 1; n <= 6; n++) {
    await a.wait(170)
    await a.set({ images: n })
  }
  await a.wait(350)
  await a.set({ step: 'done' })
  // Saved as HTML: Chrome's download button pops in and fills
  await a.wait(500)
  await a.set({ menu: false, dl: 'progress' })
  await a.wait(1000)
  await a.set({ dl: 'done', bubble: true })
  await a.wait(500)
  await a.move('dl-file')
  await a.wait(250)
  await a.click()
  // Opens in a new tab: blank, loading, then text, then the slide images
  await a.set({ bubble: false, load: 1 })
  await a.wait(650)
  await a.set({ load: 2 })
  await a.wait(350)
  await a.set({ load: 3 })
  await a.wait(1200)
  await a.scroll('post', 'fig-1', { offset: 70, duration: 1300 })
  await a.wait(1100)
  await a.scroll('post', 'fig-2', { offset: 70, duration: 1100 })
  await a.wait(1100)
  await a.scroll('post', 'fig-4', { offset: 70, duration: 1200 })
  await a.wait(1500)
  await a.move('rest')
  await a.wait(1500)
}

const STEP_ORDER: Step[] = ['import', 'write', 'images', 'done']
const reached = (s: Step, step: Step) => STEP_ORDER.indexOf(s) >= STEP_ORDER.indexOf(step)

function StepRow({ label, state, extra }: { label: string; state: 'wait' | 'busy' | 'done'; extra?: ReactNode }) {
  return (
    <div className="nt-sl__step" data-state={state}>
      <States value={state} align="center" states={{ wait: <span className="nt-sl__dot" />, busy: <Spinner size={15} />, done: <Check on size={16} /> }} />
      <span className="nt-sl__step-label">{label}</span>
      {extra}
    </div>
  )
}

export default function SlidesToBlog() {
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
      className="nt-sl"
    >
      {(s, rect, layout) => {
        const wide = layout === 'wide'
        const btn = rect('blog-btn')
        const dl = rect('dl-btn')
        const tab = s.load > 0
        const bubbleW = wide ? 300 : 280
        const busy = (step: Step) => (s.step === step ? 'busy' : reached(s.step, step) && s.step !== step ? 'done' : 'wait')
        return (
          <>
            <Window
              url={tab ? <span className="nt-sl__addr"><span className="nt-sl__addr-chip">File</span>/Users/you/Downloads/{FILE}</span> : 'notebook.google.com/notebook/5a17c0de'}
              nav
              urlShape="pill"
              className="nt-sl__win"
              tabs={['Product launch 2026 - Gemini Notebook', 'Launch 2026: how we win mid-market teams']}
              activeTab={tab ? 1 : 0}
              tabIcons={[
                <img key="nb" className="nt-sl__tab-ico" src={GN_MARK} alt="" width={14} height={14} />,
                <span key="blog" className="nt-sl__tab-ico" data-loading={s.load === 1 || undefined}>{s.load === 1 ? <Spinner size={12} /> : <FileText {...ICON} size={13} />}</span>,
              ]}
              toolbar={<DownloadButton state={s.dl} />}
              data-tab={tab || undefined}
            >
              <div className="nt-sl__view">
                <div className="nt-sl__page">
                  <div className="nt-sl__head">
                    <img src={GN_MARK} alt="Gemini Notebook" width={30} height={30} />
                    <span className="nt-sl__title">Product launch 2026</span>
                  </div>
                  <div className="nt-sl__ribbon">
                    <img src={LOGO} alt="" width={18} height={18} />
                    {wide && <span className="nt-sl__chip"><Folder {...ICON} size={14} />Marketing</span>}
                    {wide && <span className="nt-sl__gname">Create</span>}
                    <span className="nt-sl__rbtn" data-target="blog-btn" data-cursor="pointer" data-open={s.menu || undefined}>
                      <NotebookPen {...ICON} size={15} />Blog<ChevronDown {...ICON} size={13} />
                    </span>
                    {wide && <span className="nt-sl__rbtn is-quiet"><FileText {...ICON} size={15} />Snapshot doc</span>}
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
                        <div className="nt-sl__thumbs">{SLIDES.slice(0, 4).map((_, i) => <Slide key={i} i={i} width={78} />)}</div>
                      </section>
                    )}
                  </div>
                </div>

                {/* The downloaded post, open in its own tab */}
                <div className="nt-sl__blog" data-load={s.load}>
                  <span className="nt-sl__progress" />
                  <Scroll name="post" className="nt-sl__scroll" bar="overlay">
                    <article className="nt-sl__post">
                      <div className="nt-sl__post-kicker">Launch plan</div>
                      <div className="nt-sl__post-title">Launch 2026: how we win mid-market teams</div>
                      <div className="nt-sl__post-meta"><Bar w={90} h={6} tone={2} /><span>·</span><span>6 min read</span></div>
                      <figure className="nt-sl__fig" data-target="fig-0"><Slide i={0} width={wide ? 560 : 270} /></figure>
                      <div className="nt-sl__para"><Bar w="96%" h={7} tone={3} /><Bar w="92%" h={7} tone={3} /><Bar w="70%" h={7} tone={3} /></div>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <section key={i} className="nt-sl__sec">
                          <div className="nt-sl__h2">{['', 'Who we are building for', 'Pricing that grows with usage', 'Partners before paid ads', 'The first 90 days', 'What success looks like'][i]}</div>
                          <div className="nt-sl__para"><Bar w="94%" h={7} tone={3} /><Bar w="88%" h={7} tone={3} /><Bar w="60%" h={7} tone={3} /></div>
                          <figure className="nt-sl__fig" data-target={`fig-${i}`}>
                            <Slide i={i} width={wide ? 520 : 270} />
                            <figcaption>Slide {i + 1} · {SLIDES[i].kicker}</figcaption>
                          </figure>
                        </section>
                      ))}
                    </article>
                  </Scroll>
                </div>
              </div>
            </Window>

            {/* Chrome's download bubble */}
            <Popover show={s.bubble} origin="top right" className="nt-dlb" style={{ left: Math.max(8, dl.x + dl.width - bubbleW + 6), top: dl.y + dl.height + 8, width: bubbleW }}>
              <DownloadRow name={FILE} size="1.8 MB" kind="html" target="dl-file" />
            </Popover>

            {/* The Blog workflow, opened from the ribbon */}
            <Popover show={s.menu} origin="top left" className="nt-sl__menu" style={{ left: wide ? btn.x : 24, top: btn.y + btn.height + 6 }}>
              <div className="nt-sl__menu-label">Blog from a slide deck</div>
              <div className="nt-sl__select"><Presentation {...ICON} size={15} /><span>Launch deck · 6 slides</span><ChevronDown {...ICON} size={14} /></div>
              <Collapse open={s.step !== 'idle'}>
                <div className="nt-sl__steps">
                  <StepRow label="Import the deck PDF" state={busy('import')} />
                  <StepRow label="Write the article" state={busy('write')} />
                  <StepRow
                    label="Embed slide images"
                    state={busy('images')}
                    extra={<span className="nt-sl__count"><Count value={s.images} /> / 6</span>}
                  />
                  <div className="nt-sl__mini">{SLIDES.map((_, i) => <span key={i} className="nt-sl__mini-cell" data-on={i < s.images || undefined}><Slide i={i} width={wide ? 44 : 38} /></span>)}</div>
                </div>
              </Collapse>
              <button type="button" className="nt-sl__go" data-target="write" data-cursor="pointer" data-done={s.step === 'done' || undefined}>
                <States
                  value={s.step === 'done' ? 'open' : s.step === 'idle' ? 'write' : 'busy'}
                  states={{ write: <span>Write blog</span>, busy: <span className="nt-sl__go-row"><Spinner size={14} /> Writing…</span>, open: <span className="nt-sl__go-row"><Check on size={15} /> Saved to Downloads</span> }}
                />
              </button>
            </Popover>

            <span data-target="rest" className="nt-sl__rest" />
          </>
        )
      }}
    </Stage>
  )
}
