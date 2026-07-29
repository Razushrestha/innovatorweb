import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
  src?: string;
};

export function BrandMark({
  size = 52,
  className = "",
  src = "/center_logo.png",
}: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-white/80 shadow-soft ring-1 ring-white/90 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt="Innovator"
        fill
        sizes={`${size}px`}
        className="object-contain p-1.5"
        priority
      />
    </div>
  );
}
