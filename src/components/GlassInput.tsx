import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function GlassInput({ label, className = "", id, ...rest }: Props) {
  const inputId = id ?? rest.name;
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="pl-1 text-[12.5px] font-semibold text-muted">
          {label}
        </span>
      ) : null}
      <input id={inputId} className={`glass-field ${className}`} {...rest} />
    </label>
  );
}
