import logoSrc from "../assets/stepashka-logo.svg"

type BrandLogoProps = {
  showText?: boolean
  text?: string
  className?: string
  iconClassName?: string
  textClassName?: string
}

export default function BrandLogo({
  showText = true,
  text = "Степашка",
  className = "",
  iconClassName = "h-9 w-9",
  textClassName = "text-xl font-extrabold bg-gradient-to-r from-red-600 to-rose-800 bg-clip-text text-transparent",
}: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} aria-label="Логотип Stepashka">
      <img src={logoSrc} alt="Stepashka" className={iconClassName} />
      {showText && <span className={textClassName}>{text}</span>}
    </div>
  )
}
