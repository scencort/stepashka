// компонент логотипа бренда — SVG-иконка + опциональный текст
// используется в навбаре, страницах авторизации и других местах
// все классы настраиваются снаружи через пропсы для гибкости
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
