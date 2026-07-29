type Props = {
  animate?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export function BlobBackground({
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`relative min-h-dvh overflow-x-hidden bg-canvas ${className}`}
    >
      <div className="relative z-10 h-full min-h-[inherit]">{children}</div>
    </div>
  );
}
