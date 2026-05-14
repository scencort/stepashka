// простая карточка — обёртка с базовым стилем card из tailwind
// используется как контейнер для секций интерфейса
// className позволяет дополнить или переопределить стили снаружи
type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: Props) {
  return (
    <div className={`card p-6 ${className}`}>
      {children}
    </div>
  );
}
