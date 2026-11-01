import type { SVGProps } from 'react'

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
