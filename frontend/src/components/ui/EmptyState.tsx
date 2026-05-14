// компонент пустого состояния — стандартный паттерн "нет данных"
// используется в: Dashboard.tsx, Course.tsx, AdminPanel.tsx, TeacherStudio.tsx,
//                 Feedback.tsx, AiReview.tsx и везде где список может быть пустым
//
// визуал: иконка в кружке + заголовок + описание, всё по центру карточки
// карточка берётся из Card.tsx (bg-[var(--bg)] + border + border-radius + shadow)
//
// props:
//   title       — короткий заголовок, например "Нет курсов"
//   description — поясняющий текст, например "Запишитесь на первый курс"
//   icon        — react-node с иконкой (любой lucide-react), по умолчанию FolderX
//                 передаётся как: icon={<BookOpen size={32} strokeWidth={1.5} />}
import Card from "./Card"
import { FolderX } from "lucide-react"

type Props = {
  title: string
  description: string
  icon?: React.ReactNode
}

export default function EmptyState({ title, description, icon }: Props) {
  return (
    // py-12 — вертикальный отступ чтобы блок выглядел "воздушным"
    <Card className="flex flex-col items-center justify-center py-12 text-center">

      {/* иконка в круглой подложке с кольцом — ring-8 создаёт мягкую "ауру" вокруг круга */}
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 ring-8 ring-slate-50 dark:ring-slate-900/50">
        {/* кастомная иконка или дефолтный FolderX (папка с крестиком) */}
        {icon ?? <FolderX size={32} strokeWidth={1.5} />}
      </div>

      {/* заголовок — шрифт наследуется от body (Inter) */}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>

      {/* описание — max-w-sm чтобы не растягивалось на весь экран */}
      <p className="text-sm mt-2 max-w-sm text-slate-500 dark:text-slate-400">{description}</p>
    </Card>
  )
}
