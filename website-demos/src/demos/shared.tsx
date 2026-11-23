import type { SVGProps } from 'react'
import './downloads.css'

/** NotebookTools look for every stage: Google Sans, Gemini blue, quiet greys. */
export const TOKENS = {
  '--ss-font': '"Google Sans Text", "Google Sans", Roboto, Arial, sans-serif',
  '--ss-accent': '#0b57d0',
  '--ss-accent-soft': 'rgba(11, 87, 208, 0.1)',
} as Record<string, string>

export const LOGO = '/assets/logo-mark-32.png'

/** YouTube's mark (Simple Icons, CC0), in its own red. */
export function YouTubeMark({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden {...rest}>
      <path fill="#FF0033" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
      <path fill="#fff" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

/** Lucide at one size and stroke across every NotebookTools stage. */
export const ICON = { size: 16, strokeWidth: 1.8 } as const

export type DlState = 'idle' | 'progress' | 'done'

/** Chrome's toolbar download button: pops in, a ring fills, then it rests. */
export function DownloadButton({ state }: { state: DlState }) {
  return (
    <span className="nt-dl" data-state={state} data-target="dl-btn" aria-hidden>
      <svg className="nt-dl__ring" width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="11" fill="none" stroke="rgba(11,87,208,.15)" strokeWidth="2" />
        <circle className="nt-dl__arc" cx="13" cy="13" r="11" fill="none" stroke="#0b57d0" strokeWidth="2" strokeLinecap="round" transform="rotate(-90 13 13)" />
      </svg>
      <svg className="nt-dl__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" />
      </svg>
    </span>
  )
}

/** One finished file in Chrome's download bubble. */
export function DownloadRow({ name, size, kind, target }: { name: string; size: string; kind: 'html' | 'doc'; target: string }) {
  return (
    <>
      <div className="nt-dlb__head">Recent download history</div>
      <div className="nt-dlb__row" data-target={target} data-cursor="pointer">
        <span className="nt-dlb__ico" data-kind={kind}>
          {kind === 'html' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>
          )}
        </span>
        <span className="nt-dlb__text"><b>{name}</b><em>{size} • Done</em></span>
      </div>
    </>
  )
}

/** The extension's in-page "Send to NotebookLM" panel (platform-import.html /
 *  youtube-import.html), same layout and CSS values as the app (.nt-panel). */
export function AppPanel({ title, meta, notebook, phase, sendTarget, search }: {
  title: string; meta: string; notebook: string; phase: 'idle' | 'busy' | 'done'; sendTarget: string; search?: boolean
}) {
  return (
    <div className="nt-app-panel">
      <div className="ntp-head">
        <img src={LOGO} alt="" width={18} height={18} />
        <div className="ntp-head-copy">
          <p className="ntp-title">{title}</p>
          <p className="ntp-meta">{meta}</p>
        </div>
      </div>
      <span className="ntp-label">Add to</span>
      {search && <span className="ntp-input is-ph">Search notebooks</span>}
      <span className="ntp-select">{notebook}</span>
      <span className="ntp-input is-ph">Or create a new notebook</span>
      <button type="button" className="ntp-primary" data-target={sendTarget} data-cursor="pointer">Send to notebook</button>
      <div className="ntp-foot"><span>Refresh list</span>{phase === 'done' && <span>Open notebook</span>}</div>
      {phase !== 'idle' && (
        <div className={`ntp-status ${phase === 'busy' ? 'is-loading' : 'is-done'}`}>
          {phase === 'busy' ? <i className="ntp-spin" /> : <i className="ntp-check"><svg viewBox="0 0 16 16" fill="none"><path d="M4 8.5 6.8 11.3 12 5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></i>}
          <span>{phase === 'busy' ? 'Sending to NotebookLM...' : `Added to "${notebook}"`}</span>
        </div>
      )}
    </div>
  )
}
