import Image from "next/image";

export const INNOVATOR_LOGO = "/innovator-logo.png";

type Props = {
  size?: number;
  className?: string;
  /** soft white disc | navy disc | bare mark */
  variant?: "soft" | "navy" | "plain";
  priority?: boolean;
  alt?: string;
};

export function BrandMark({
  size = 52,
  className = "",
  variant = "soft",
  priority = false,
  alt = "Innovator",
}: Props) {
  const pad = Math.max(4, Math.round(size * 0.14));

  if (variant === "plain") {
    return (
      <span
        className={`relative inline-block shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={INNOVATOR_LOGO}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-contain"
          priority={priority}
        />
      </span>
    );
  }

  const shell =
    variant === "navy"
      ? "bg-navy shadow-soft ring-1 ring-gold/35"
      : "bg-white/90 shadow-soft ring-1 ring-black/[0.04]";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[22%] ${shell} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={INNOVATOR_LOGO}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-contain"
        style={{ padding: pad }}
        priority={priority}
      />
    </div>
  );
}
