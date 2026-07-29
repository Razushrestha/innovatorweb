import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "dark" | "light";
};

export function LiquidButton({
  variant = "dark",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`liquid-btn w-full ${
        variant === "dark" ? "liquid-btn-dark" : "liquid-btn-light"
      } disabled:opacity-55 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
