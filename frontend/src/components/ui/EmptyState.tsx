import Card from "./Card"
import { FolderX } from "lucide-react"

type Props = {
  title: string
  description: string
  icon?: React.ReactNode
}

export default function EmptyState({ title, description, icon }: Props) {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 ring-8 ring-slate-50 dark:ring-slate-900/50">
        {icon || <FolderX size={32} strokeWidth={1.5} />}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-sm mt-2 max-w-sm text-slate-500 dark:text-slate-400">{description}</p>
    </Card>
  )
}
