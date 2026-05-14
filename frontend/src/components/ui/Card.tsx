// базовый контейнер-карточка — применяет класс .card из index.css
// используется в: Dashboard.tsx, AiReview.tsx, Task.tsx, HelpCenter.tsx,
//                 EmptyState.tsx, CourseEditor.tsx и везде где нужна белая карточка с тенью
//
// .card определён в index.css:
//   background: var(--bg)           — белый в light, тёмный в dark
//   border: 1px solid var(--border) — тонкая рамка
//   border-radius: 1.25rem (20px)   — скруглённые углы
//   box-shadow: var(--card-shadow)  — мягкая тень
//
// props:
//   children  — любое содержимое внутри карточки
//   className — дополнительные классы (padding, grid, flex, etc.)
//               базовый padding p-6 можно переопределить: className="p-4"
type Props = {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className = "" }: Props) {
  return (
    <div className={`card p-6 ${className}`}>
      {children}
    </div>
  );
}
