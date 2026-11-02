import type { ReactNode } from 'react'
import { CalendarDays, ChevronDown, Download, FileText, Share2 } from 'lucide-react'
import { Bar, Check, Collapse, Count, Scroll, Spinner, Stage, States, Window, between, type Act, type Point, type Rect } from '../kit'
import { ICON, LOGO, TOKENS } from './shared'
import './snapshots.css'

// Flow story: making a how-to guide for an app. Do a step in the app, press
// Alt+Shift+S, drag a box over the part that matters, Capture. Three steps,
// three snapshots in the tray. "Create how-to guide" writes the guide with
// each captured region in place; open it and scroll through the steps.

type Gen = 'idle' | 'upload' | 'write' | 'embed' | 'done'
type S = {
  step: number
  capturing: boolean
  sel: Rect | null
  flash: Rect | null
  shots: number
  gen: Gen
  doc: boolean
}

const initial: S = { step: 0, capturing: false, sel: null, flash: null, shots: 0, gen: 'idle', doc: false }
const POSTER: S = { ...initial, step: 4, shots: 3, gen: 'done', doc: true }

type Crop = { x: number; y: number; w: number; h: number }
/** What each snapshot captured, in app coordinates (the app is 560 x 400). */
const CAPTURES: { crop: Crop; step: number; title: string }[] = [
  { crop: { x: 0, y: 0, w: 380, h: 156 }, step: 1, title: 'Set the date range to Last 30 days' },
  { crop: { x: 300, y: 0, w: 260, h: 172 }, step: 3, title: 'Open Export report and choose CSV' },
  { crop: { x: 110, y: 322, w: 340, h: 72 }, step: 4, title: 'Find the CSV in your downloads' },
]

/** The app being documented, drawn at 560 x 400 and shown at any size. */
function AppScreen({ step, interactive = false }: { step: number; interactive?: boolean }) {
  const t = (name: string) => (interactive ? { 'data-target': name, 'data-cursor': 'pointer' } : {})
  return (
    <div className="nt-sn__app" data-target={interactive ? 'app' : undefined}>
      <div className="nt-sn__app-brand">Northwind Analytics</div>
      <div className="nt-sn__app-head">
        <span className="nt-sn__app-title">Reports</span>
        <span className="nt-sn__app-range" data-on={step >= 1 || undefined} {...t('range')}>
          <CalendarDays {...ICON} size={14} />{step >= 1 ? 'Last 30 days' : 'Last 7 days'}<ChevronDown {...ICON} size={13} />
        </span>
        <span className="nt-sn__app-spacer" />
        <span className="nt-sn__app-export" data-open={(step >= 2 && step < 4) || undefined} {...t('export')}>
          <Download {...ICON} size={14} />Export report
        </span>
      </div>
      <div className="nt-sn__app-cards">
        <div className="nt-sn__app-card is-main">
          <span className="nt-sn__app-label">Revenue</span>
          <span className="nt-sn__app-value">{step >= 1 ? '$198,420' : '$48,210'}</span>
          <span className="nt-sn__app-chart">{[30, 44, 38, 56, 50, 68, 74].map((h, i) => <i key={i} style={{ height: h * (step >= 1 ? 1 : 0.8) }} />)}</span>
        </div>
        <div className="nt-sn__app-card">
          <Bar w={64} h={6} tone={2} /><Bar w={90} h={14} r={4} tone={3} style={{ marginTop: 10 }} />
          <Bar w="100%" h={44} r={8} tone={1} style={{ marginTop: 14 }} />
        </div>
      </div>
      <div className="nt-sn__app-rows">
        {[70, 56, 64].map((w, i) => <div key={i} className="nt-sn__app-row"><Bar w={`${w}%`} h={6} tone={2} /><Bar w={48} h={6} tone={2} /></div>)}
      </div>
      {step >= 2 && step < 4 && (
        <div className="nt-sn__app-menu">
          <div className="nt-sn__app-item" data-on={step === 3 || undefined} {...t('csv')}><FileText {...ICON} size={14} />CSV</div>
          <div className="nt-sn__app-item"><FileText {...ICON} size={14} />PDF</div>
          <div className="nt-sn__app-item"><Share2 {...ICON} size={14} />Share link</div>
        </div>
      )}
      {step >= 4 && <div className="nt-sn__app-toast"><Check on size={15} />revenue-last-30-days.csv downloaded</div>}
    </div>
  )
}

/** A captured region of the app, shown `width` wide. */
function Shot({ crop, step, width }: { crop: Crop; step: number; width: number }) {
  const s = width / crop.w
  return (
    <span className="nt-sn__shot" style={{ width, height: crop.h * s }}>
      <span className="nt-sn__shot-inner" style={{ transform: `translate(${-crop.x * s}px, ${-crop.y * s}px) scale(${s})` }}>
        <AppScreen step={step} />
      </span>
    </span>
  )
}

/** App coordinates → stage coordinates, from the measured app. */
function toStage(a: Act<S>, x: number, y: number): Point {
  const app = a.rect('app')
  const k = app.width / 560
  return { x: app.x + x * k, y: app.y + y * k }
}

async function snap(a: Act<S>, crop: Crop, speed: number) {
  await a.key('alt+shift+s')
  await a.set({ capturing: true, sel: null })
  await a.wait(350 / speed)
  const from = toStage(a, crop.x + 4, crop.y + 4)
  const to = toStage(a, crop.x + crop.w - 4, crop.y + crop.h - 4)
  await a.move(from, { duration: 450 / speed })
  await a.wait(120)
  await a.drag(to, (at) => a.put({ sel: between(from, at) }), { duration: 900 / speed })
  await a.wait(220 / speed)
  await a.move('cap-btn', { duration: 380 / speed })
  await a.click()
  await a.set((s) => ({ flash: s.sel, capturing: false, sel: null }))
  await a.wait(160)
  await a.set((s) => ({ shots: s.shots + 1 }))
  await a.wait(380 / speed)
  await a.set({ flash: null })
}

async function script(a: Act<S>) {
  await a.wait(700)
  // Step 1 in the app, then snap it
  await a.move('range')
  await a.click()
  await a.set({ step: 1 })
  await a.wait(350)
  await snap(a, CAPTURES[0].crop, 1)
  // Step 2: open Export report, hover CSV, snap the menu
  await a.move('export', { duration: 420 })
  await a.click()
  await a.set({ step: 2 })
  await a.wait(250)
  await a.move('csv', { duration: 300 })
  await a.set({ step: 3 })
  await a.wait(200)
  await snap(a, CAPTURES[1].crop, 1.4)
  // Step 3: the download, snap the confirmation
  await a.move('csv', { duration: 250 })
  await a.click()
  await a.set({ step: 4 })
  await a.wait(350)
  await snap(a, CAPTURES[2].crop, 1.6)
  await a.wait(300)
  // Turn the snapshots into a guide
  await a.move('make-guide')
  await a.wait(200)
  await a.click()
  await a.set({ gen: 'upload' })
  await a.wait(700)
  await a.set({ gen: 'write' })
  await a.wait(1200)
  await a.set({ gen: 'embed' })
  await a.wait(700)
  await a.set({ gen: 'done' })
  await a.wait(400)
  await a.move('open-guide')
  await a.wait(200)
  await a.click()
  await a.set({ doc: true })
  await a.wait(1300)
  await a.scroll('guide', 'g-1', { offset: 40, duration: 1200 })
  await a.wait(1100)
  await a.scroll('guide', 'g-2', { offset: 40, duration: 1100 })
  await a.wait(1500)
  await a.move('rest')
  await a.wait(1500)
}

const ORDER: Gen[] = ['upload', 'write', 'embed', 'done']
function rowState(gen: Gen, at: Gen) {
  if (gen === at) return 'busy'
  return ORDER.indexOf(gen) > ORDER.indexOf(at) ? 'done' : 'wait'
}

function Row({ label, state, extra }: { label: string; state: 'wait' | 'busy' | 'done'; extra?: ReactNode }) {
  return (
    <div className="nt-sn__step" data-state={state}>
      <States value={state} states={{ wait: <span className="nt-sn__dot" />, busy: <Spinner size={15} />, done: <Check on size={16} /> }} />
      <span className="nt-sn__step-label">{label}</span>
      {extra}
    </div>
  )
}

export default function SnapshotsGuide() {
  return (
    <Stage
      width={960}
      height={600}
      compact={{ below: 640, width: 358, height: 610 }}
      initial={initial}
      poster={POSTER}
      script={script}
      play="once"
      tokens={TOKENS}
      greys="cool"
      keys="bottom-left"
      cursor={{ at: { wide: { x: 420, y: 520 }, compact: { x: 250, y: 330 } } }}
      className="nt-sn"
    >
      {(s, rect, layout) => {
        const wide = layout === 'wide'
        const view = rect('app-view')
        const thumbW = wide ? 128 : 98
        return (
          <>
            <Window url="analytics.northwind.app/reports" nav urlShape="pill" className="nt-sn__win" receded={s.doc}>
              <div className="nt-sn__app-wrap" data-target="app-view">
                <AppScreen step={s.step} interactive />
              </div>
            </Window>

            {/* The NotebookTools capture overlay (Alt+Shift+S) */}
            <div className="nt-sn__overlay" data-show={s.capturing || undefined} data-cursor="crosshair" style={{ left: view.x, top: view.y, width: view.width, height: view.height }}>
              <svg className="nt-sn__shade" width="100%" height="100%" aria-hidden>
                <defs>
                  <mask id="nt-sn-hole">
                    <rect width="100%" height="100%" fill="#fff" />
                    {s.sel && <rect x={s.sel.x - view.x} y={s.sel.y - view.y} width={s.sel.width} height={s.sel.height} rx="4" fill="#000" />}
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(15,20,30,.45)" mask="url(#nt-sn-hole)" />
              </svg>
              {s.sel && (
                <div className="nt-sn__sel" style={{ left: s.sel.x - view.x, top: s.sel.y - view.y, width: s.sel.width, height: s.sel.height }}>
                  <span className="nt-sn__sel-size">{Math.round(s.sel.width)} × {Math.round(s.sel.height)}</span>
                </div>
              )}
              <div className="nt-sn__bar">
                {wide && <span>Drag to select · Esc cancel</span>}
                {wide && <span className="nt-sn__bar-btn is-quiet">Full page</span>}
                <span className="nt-sn__bar-btn" data-target="cap-btn" data-cursor="pointer" data-ready={s.sel ? '' : undefined}>Capture</span>
                <span className="nt-sn__bar-btn is-quiet">Cancel</span>
              </div>
            </div>
            {s.flash && <span key={`${s.shots}`} className="nt-sn__flash" style={{ left: s.flash.x, top: s.flash.y, width: s.flash.width, height: s.flash.height }} />}

            {/* NotebookTools Snapshots tray */}
            <aside className="nt-sn__tray" data-phase={s.gen === 'idle' ? 'capture' : 'guide'}>
              <div className="nt-sn__tray-head">
                <img src={LOGO} alt="" width={20} height={20} />
                <span className="nt-sn__tray-title">Snapshots</span>
                <span className="nt-sn__tray-count"><Count value={s.shots} /></span>
                <span className="nt-sn__kbd"><kbd>Alt</kbd><kbd>Shift</kbd><kbd>S</kbd></span>
              </div>
              <div className="nt-sn__grid">
                {CAPTURES.map((c, i) => (
                  <span key={i} className="nt-sn__cell" data-on={i < s.shots || undefined}>
                    <span className="nt-sn__cell-frame" style={{ width: thumbW, height: thumbW * 0.62 }}>
                      <Shot crop={c.crop} step={c.step} width={thumbW} />
                    </span>
                    <em>{i + 1}</em>
                  </span>
                ))}
              </div>
              <Collapse open={s.gen !== 'idle'}>
                <div className="nt-sn__steps">
                  <Row label="Upload 3 snapshots" state={rowState(s.gen, 'upload')} />
                  <Row label="Write the how-to guide" state={rowState(s.gen, 'write')} />
                  <Row label="Embed screenshots" state={rowState(s.gen, 'embed')} />
                </div>
              </Collapse>
              <button type="button" className="nt-sn__go" data-target={s.gen === 'done' ? 'open-guide' : 'make-guide'} data-cursor="pointer" data-done={s.gen === 'done' || undefined}>
                <States
                  value={s.gen === 'done' ? 'open' : s.gen === 'idle' ? 'make' : 'busy'}
                  states={{ make: <span>Create how-to guide</span>, busy: <span className="nt-sn__go-row"><Spinner size={14} /> Writing…</span>, open: <span>Open guide</span> }}
                />
              </button>
            </aside>

            {/* The finished guide */}
            <Window title="How to export a revenue report.docx" className="nt-sn__doc" data-show={s.doc || undefined}>
              <Scroll name="guide" className="nt-sn__doc-scroll">
                <article className="nt-sn__paper">
                  <div className="nt-sn__doc-kicker">Northwind Analytics · How-to guide</div>
                  <div className="nt-sn__doc-title">How to export a revenue report</div>
                  <div className="nt-sn__doc-meta">3 steps · written from 3 snapshots</div>
                  <div className="nt-sn__para"><Bar w="94%" h={7} tone={3} /><Bar w="70%" h={7} tone={3} /></div>
                  {CAPTURES.map((c, i) => (
                    <section key={i} className="nt-sn__g" data-target={`g-${i}`}>
                      <div className="nt-sn__g-head"><span className="nt-sn__g-num">{i + 1}</span><span className="nt-sn__g-title">{c.title}</span></div>
                      <div className="nt-sn__para"><Bar w="90%" h={7} tone={2} /><Bar w="56%" h={7} tone={2} /></div>
                      <figure className="nt-sn__g-fig"><Shot crop={c.crop} step={c.step} width={Math.min(wide ? 470 : 270, (c.crop.w / 560) * (wide ? 900 : 480))} /></figure>
                    </section>
                  ))}
                </article>
              </Scroll>
            </Window>
            <span data-target="rest" className="nt-sn__rest" />
          </>
        )
      }}
    </Stage>
  )
}
