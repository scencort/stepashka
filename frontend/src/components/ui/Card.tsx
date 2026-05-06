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
