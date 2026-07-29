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
      className={`app-surface relative min-h-dvh overflow-x-hidden ${className}`}
      style={{ backgroundColor: "var(--canvas)" }}
    >
      <div className="app-surface relative z-10 h-full min-h-[inherit]">
        {children}
      </div>
    </div>
  );
}
