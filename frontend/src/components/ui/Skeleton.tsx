type Props = {
  className?: string
}

export default function Skeleton({ className = "" }: Props) {
  return <div className={`animate-pulse rounded-[24px] bg-zinc-200/70 dark:bg-zinc-800/80 ${className}`} />
}


