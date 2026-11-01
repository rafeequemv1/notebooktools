import { Folder, LayoutList, Search, Star, Tag } from 'lucide-react'
import { Bar, Count, Meter, Popover, Roll, Stage, Window, type Act } from '../kit'
import { ICON, TOKENS } from './shared'
import './table.css'

// Feels-like-use story: in the NotebookTools notebooks table, select two
// notebooks, tag both "Thesis" from the bulk bar. The tags land on each row
// and the Thesis count in the sidebar rolls.

type S = { sel: number[]; menu: boolean; tagged: boolean; thesis: number }

const initial: S = { sel: [], menu: false, tagged: false, thesis: 4 }
const POSTER: S = { sel: [1, 2], menu: false, tagged: true, thesis: 6 }

const ROWS = [
  { emoji: '🧬', name: 'CRISPR delivery review', sources: 32, tags: ['Biology'], folder: 'PhD' },
  { emoji: '📚', name: 'Thesis literature map', sources: 47, tags: [], folder: 'PhD' },
  { emoji: '🧠', name: 'Memory consolidation', sources: 18, tags: ['Biology'], folder: 'PhD' },
]
const LIMIT = 50

async function script(a: Act<S>) {
  await a.wait(700)
  await a.move('check-1')
  await a.wait(200)
  await a.click()
  await a.set({ sel: [1] })
  await a.wait(450)
  await a.move('check-2')
  await a.wait(200)
  await a.click()
  await a.set({ sel: [1, 2] })
  await a.wait(600)
  await a.move('add-tag')
  await a.wait(250)
  await a.click()
  await a.set({ menu: true })
  await a.wait(700)
  await a.move('tag-thesis')
  await a.wait(250)
  await a.click()
  await a.set({ menu: false, tagged: true })
  await a.wait(450)
  await a.set({ thesis: 6 })
  await a.wait(500)
  await a.move('rest')
  await a.wait(2400)
}

function Check({ on, target }: { on: boolean; target?: string }) {
  return (
    <span className="nt-tb__check" data-on={on || undefined} data-target={target} data-cursor="pointer">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export default function NotebooksTable() {
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
      cursor={{ at: { wide: { x: 820, y: 150 }, compact: { x: 300, y: 120 } } }}
      className="nt-tb"
    >
      {(s, rect, layout) => {
        const wide = layout === 'wide'
        return (
          <>
            <Window
              className="nt-tb__win"
              sidebarWidth={210}
              sidebar={
                wide ? (
                  <nav className="nt-tb__side">
                    <div className="nt-tb__side-label">Views</div>
                    <div className="nt-tb__side-item is-active">
                      <LayoutList {...ICON} size={15} />
                      <span>All notebooks</span>
                      <em>64</em>
                    </div>
                    <div className="nt-tb__side-item">
                      <Star {...ICON} size={15} />
                      <span>Favorites</span>
                      <em>3</em>
                    </div>
                    <div className="nt-tb__side-item">
                      <Folder {...ICON} size={15} />
                      <Bar w={64} h={6} tone={2} />
                    </div>
                    <div className="nt-tb__side-label">Tags</div>
                    <div className="nt-tb__side-item" data-lit={s.thesis > 4 || undefined}>
                      <i className="nt-tb__dot is-thesis" />
                      <span>Thesis</span>
                      <em><Count value={s.thesis} /></em>
                    </div>
                    <div className="nt-tb__side-item">
                      <i className="nt-tb__dot is-bio" />
                      <span>Biology</span>
                      <em>16</em>
                    </div>
                    <div className="nt-tb__side-item">
                      <i className="nt-tb__dot" />
                      <Bar w={48} h={6} tone={2} />
                    </div>
                  </nav>
                ) : undefined
              }
              title="All notebooks"
              lead={
                wide ? (
                  <span className="nt-tb__search">
                    <Search {...ICON} size={14} />
                    <Bar w={120} h={6} tone={2} />
                  </span>
                ) : undefined
              }
            >
              <div className="nt-tb__body">
                <div className="nt-tb__grid nt-tb__head">
                  <span />
                  <span>Name</span>
                  {wide && <span>Sources</span>}
                  <span>Tags</span>
                  {wide && <span>Folder</span>}
                </div>
                {ROWS.map((row, i) => {
                  const selected = s.sel.includes(i)
                  const gotTag = s.tagged && (i === 1 || i === 2)
                  return (
                    <div key={row.name} className="nt-tb__grid nt-tb__row" data-selected={selected || undefined}>
                      <Check on={selected} target={`check-${i}`} />
                      <span className="nt-tb__name">
                        <span className="nt-tb__emoji" aria-hidden>{row.emoji}</span>
                        <span className="nt-tb__title">{row.name}</span>
                      </span>
                      {wide && (
                        <span className="nt-tb__src">
                          <span className="nt-tb__num">{row.sources}</span>
                          <Meter value={row.sources / LIMIT} className="nt-tb__meter" />
                        </span>
                      )}
                      <span className="nt-tb__tags">
                        {(wide ? row.tags : []).map((t) => <span key={t} className="nt-tb__tag is-bio">{t}</span>)}
                        <span className="nt-tb__tag is-thesis is-new" data-show={gotTag || undefined} style={{ transitionDelay: gotTag && i === 2 ? '80ms' : '0ms' }}>Thesis</span>
                      </span>
                      {wide && (
                        <span className="nt-tb__folder">
                          <Folder {...ICON} size={14} />
                          {row.folder}
                        </span>
                      )}
                    </div>
                  )
                })}
                {[58, 44, 66, 50, 62].map((w, i) => (
                  <div key={i} className="nt-tb__grid nt-tb__row is-filler">
                    <Check on={false} />
                    <span className="nt-tb__name">
                      <Bar w={22} h={22} r={6} tone={1} />
                      <Bar w={`${w}%`} h={7} tone={3} />
                    </span>
                    {wide && <span className="nt-tb__src"><Bar w={70} h={6} tone={2} /></span>}
                    <span className="nt-tb__tags"><Bar w={52} h={18} r={5} tone={1} /></span>
                    {wide && <span className="nt-tb__folder"><Bar w={56} h={6} tone={2} /></span>}
                  </div>
                ))}
              </div>
            </Window>

            {/* The bulk bar rises when rows are selected, as in the extension */}
            <div className="nt-tb__bulk" data-show={s.sel.length > 0 || undefined}>
              <span className="nt-tb__bulk-count">
                <Roll>{`${Math.max(1, s.sel.length)} selected`}</Roll>
              </span>
              <span className="nt-tb__bulk-sep" />
              {wide && <span className="nt-tb__bulk-btn">Move to folder</span>}
              <span className="nt-tb__bulk-btn" data-target="add-tag" data-cursor="pointer" data-open={s.menu || undefined}>
                <Tag {...ICON} size={14} />
                Add tag
              </span>
              <span className="nt-tb__bulk-btn is-danger">Delete</span>
            </div>

            <Popover show={s.menu} origin="bottom left" className="nt-tb__menu" style={{ left: rect('add-tag').x, top: rect('add-tag').y - 150 }}>
              <div className="nt-tb__menu-label">Add tag</div>
              <div className="nt-tb__menu-item" data-target="tag-thesis" data-cursor="pointer"><i className="nt-tb__dot is-thesis" />Thesis</div>
              <div className="nt-tb__menu-item"><i className="nt-tb__dot is-bio" />Biology</div>
              <div className="nt-tb__menu-item"><i className="nt-tb__dot" />To read</div>
            </Popover>
            <span data-target="rest" className="nt-tb__rest" />
          </>
        )
      }}
    </Stage>
  )
}
