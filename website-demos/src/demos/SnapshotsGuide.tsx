import type { ReactNode } from 'react'
import { CalendarDays, ChevronDown, Download, FileText, Share2 } from 'lucide-react'
import { Bar, Check, Collapse, Count, Scroll, Spinner, Stage, States, Window, type Act } from '../kit'
import { ICON, LOGO, TOKENS } from './shared'
import './snapshots.css'

// Flow story: Auto capture records a task in a working app, one snapshot per
// click, fast. "Create how-to guide" turns the snapshots into a written
// guide with every screenshot in place; open it and scroll through the steps.

type Gen = 'idle' | 'upload' | 'write' | 'embed' | 'done'
type S = { step: number; shots: number; flash: number; gen: Gen; doc: boolean }

const initial: S = { step: 0, shots: 0, flash: 0, gen: 'idle', doc: false }
const POSTER: S = { step: 4, shots: 5, flash: 0, gen: 'done', doc: true }

const GUIDE = [
  { title: 'Open Reports and pick the date range', step: 0 },
  { title: 'Switch the range to Last 30 days', step: 1 },
  { title: 'Open Export report', step: 2 },
  { title: 'Choose CSV', step: 3 },
  { title: 'Find the file in your downloads', step: 4 },
]

/** The app being documented, drawn at 560 x 400 and shown at any size. */
function AppScreen({ step, interactive = false }: { step: number; interactive?: boolean }) {
  const t = (name: string) => (interactive ? { 'data-target': name, 'data-cursor': 'pointer' } : {})
  return (
    <div className="nt-sn__app">
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
        <div className="nt-sn__app-card is-main" {...t('card')}>
          <span className="nt-sn__app-label">Weekly revenue</span>
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

function Shot({ step, width }: { step: number; width: number }) {
  return (
    <span className="nt-sn__shot" style={{ width, height: (width * 400) / 560 }}>
      <span className="nt-sn__shot-inner" style={{ transform: `scale(${width / 560})` }}><AppScreen step={step} /></span>
    </span>
  )
}

async function capture(a: Act<S>, target: string, next: number) {
  await a.move(target, { duration: 380 })
  await a.click()
  await a.set((s) => ({ step: next, flash: s.flash + 1 }))
  await a.wait(140)
  await a.set((s) => ({ shots: s.shots + 1 }))
  await a.wait(260)
}

async function script(a: Act<S>) {
  await a.wait(800)
  // Auto capture is on: every click becomes a snapshot
  await capture(a, 'range', 1)
  await capture(a, 'card', 1)
  await capture(a, 'export', 2)
  await capture(a, 'csv', 3)
  await a.wait(150)
  await a.set({ step: 4 })
  await a.wait(250)
  await a.set((s) => ({ flash: s.flash + 1 }))
  await a.wait(140)
  await a.set({ shots: 5 })
  await a.wait(700)
  await a.move('make-guide')
  await a.wait(200)
  await a.click()
  await a.set({ gen: 'upload' })
  await a.wait(800)
  await a.set({ gen: 'write' })
  await a.wait(1300)
  await a.set({ gen: 'embed' })
  await a.wait(800)
  await a.set({ gen: 'done' })
  await a.wait(450)
  await a.move('open-guide')
  await a.wait(200)
  await a.click()
  await a.set({ doc: true })
  await a.wait(1300)
  await a.scroll('guide', 'g-2', { offset: 40, duration: 1200 })
  await a.wait(1000)
  await a.scroll('guide', 'g-3', { offset: 40, duration: 1000 })
  await a.wait(1000)
  await a.scroll('guide', 'g-4', { offset: 40, duration: 1000 })
  await a.wait(1400)
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
      cursor={{ at: { wide: { x: 420, y: 470 }, compact: { x: 250, y: 300 } } }}
      className="nt-sn"
    >
      {(s, _rect, layout) => {
        const wide = layout === 'wide'
        const thumbW = wide ? 128 : 92
        return (
          <>
            <Window url="app.reports.example/revenue" nav urlShape="pill" className="nt-sn__win" receded={s.doc}>
              <div className="nt-sn__app-wrap">
                <AppScreen step={s.step} interactive />
                <span key={s.flash} className="nt-sn__flash" data-go={s.flash > 0 || undefined} />
              </div>
            </Window>

            {/* NotebookTools Snapshots tray */}
            <aside className="nt-sn__tray">
              <div className="nt-sn__tray-head">
                <img src={LOGO} alt="" width={20} height={20} />
                <span className="nt-sn__tray-title">Snapshots</span>
                <span className="nt-sn__tray-count"><Count value={s.shots} /></span>
                <span className="nt-sn__rec" data-on={(s.gen === 'idle' && s.shots < 5) || undefined}>
                  <i />{s.gen === 'idle' && s.shots < 5 ? 'Auto capture' : 'Captured'}
                </span>
              </div>
              <div className="nt-sn__grid">
                {[0, 1, 2, 3, 4].map((step, i) => (
                  <span key={i} className="nt-sn__cell" data-on={i < s.shots || undefined}>
                    <Shot step={step} width={thumbW} />
                    <em>{i + 1}</em>
                  </span>
                ))}
              </div>
              <Collapse open={s.gen !== 'idle'}>
                <div className="nt-sn__steps">
                  <Row label="Upload 5 snapshots" state={rowState(s.gen, 'upload')} />
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
            <Window title="How to export the revenue report.docx" className="nt-sn__doc" data-show={s.doc || undefined}>
              <Scroll name="guide" className="nt-sn__doc-scroll">
                <article className="nt-sn__paper">
                  <div className="nt-sn__doc-kicker">How-to guide</div>
                  <div className="nt-sn__doc-title">How to export the revenue report</div>
                  <div className="nt-sn__doc-meta">5 steps · made from 5 snapshots</div>
                  <div className="nt-sn__para"><Bar w="94%" h={7} tone={3} /><Bar w="70%" h={7} tone={3} /></div>
                  {GUIDE.map((g, i) => (
                    <section key={i} className="nt-sn__g" data-target={`g-${i}`}>
                      <div className="nt-sn__g-head"><span className="nt-sn__g-num">{i + 1}</span><span className="nt-sn__g-title">{g.title}</span></div>
                      <div className="nt-sn__para"><Bar w="90%" h={7} tone={2} /><Bar w="56%" h={7} tone={2} /></div>
                      <figure className="nt-sn__g-fig"><Shot step={g.step} width={wide ? 470 : 270} /></figure>
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
