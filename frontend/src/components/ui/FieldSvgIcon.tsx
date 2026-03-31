type FieldSvgIconKind = "email" | "password" | "user" | "key"

type Props = {
  kind: FieldSvgIconKind
  className?: string
}

function IconPath({ kind }: { kind: FieldSvgIconKind }) {
  if (kind === "email") {
    return <path d="M3 5.5h18v13H3z M4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  }

  if (kind === "password") {
    return (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 10V8a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    )
  }

  if (kind === "user") {
    return (
      <>
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 19.2c1.4-3.2 3.8-4.8 7-4.8s5.6 1.6 7 4.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    )
  }

  return (
    <>
      <path d="M8.5 11.5L15.5 4.5a3 3 0 1 1 4.2 4.2l-7 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.3" cy="16.7" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  )
}

export default function FieldSvgIcon({ kind, className = "" }: Props) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md bg-rose-100/90 text-rose-700 dark:bg-slate-800/80 dark:text-slate-200 ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
        <IconPath kind={kind} />
      </svg>
    </span>
  )
}
