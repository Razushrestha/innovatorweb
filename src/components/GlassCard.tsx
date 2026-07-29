type Props = {
  children: React.ReactNode;
  className?: string;
};

export function GlassCard({ children, className = "" }: Props) {
  return (
    <div className={`glass-card w-full max-w-md px-5 py-6 sm:px-8 sm:py-8 ${className}`}>
      {children}
    </div>
  );
}
