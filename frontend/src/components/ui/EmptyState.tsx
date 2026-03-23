import Card from "./Card"

type Props = {
  title: string
  description: string
}

export default function EmptyState({ title, description }: Props) {
  return (
    <Card>
      <p className="font-semibold">{title}</p>
      <p className="text-sm mt-1 text-slate-500 dark:text-slate-300">{description}</p>
    </Card>
  )
}
