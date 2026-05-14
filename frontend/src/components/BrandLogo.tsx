// компонент логотипа бренда — SVG-иконка + опциональный текст
// используется в: MainLayout.tsx (сайдбар + мобильная шапка),
//                 AuthScreenShell.tsx (экраны входа), NotFound.tsx, Landing.tsx
//
// SVG берётся из assets/gradus-logo.svg через Vite import (url становится строкой)
// все стили (размер, цвет текста) задаются снаружи через пропсы — компонент не знает контекст
//
// props:
//   showText       — показывать ли слово "Gradus" рядом с иконкой
//   text           — текст логотипа, по умолчанию "Gradus"
//   className      — класс для flex-обёртки (gap, отступы)
//   iconClassName  — класс для <img> с иконкой (h-8 w-8, h-10 w-10, etc.)
//   textClassName  — класс для <span> с текстом (размер шрифта, цвет, gradient-text)
import logoSrc from "../assets/gradus-logo.svg";

type BrandLogoProps = {
  showText?: boolean;       // показывать ли текстовую часть логотипа
  text?: string;            // текст рядом с иконкой, по умолчанию "Gradus"
  className?: string;       // класс для обёртки
  iconClassName?: string;   // класс для иконки (размер, отступы)
  textClassName?: string;   // класс для текста (размер, цвет, градиент)
};

export default function BrandLogo({
  showText = true,
  text = "Gradus",
  className = "",
  iconClassName = "h-9 w-9",
  // дефолтный стиль — красный градиент, как в основном дизайне
  textClassName = "text-xl font-extrabold bg-gradient-to-r from-red-600 to-rose-800 bg-clip-text text-transparent",
}: BrandLogoProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label="Логотип Gradus"
    >
      <img src={logoSrc} alt="Gradus" className={iconClassName} />
      {/* текст показываем только если showText = true */}
      {showText && <span className={textClassName}>{text}</span>}
    </div>
  );
}
