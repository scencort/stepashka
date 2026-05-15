import type { ReactNode, CSSProperties } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export default function Card({ children, className = "", style }: Props) {
  return (
    <div className={`card p-6 ${className}`} style={style}>
      {children}
    </div>
  );
}
