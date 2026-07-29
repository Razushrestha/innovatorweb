"use client";

type Props = {
  enrolled: boolean;
  onEnroll: () => void;
  className?: string;
  label?: string;
  doneLabel?: string;
};

export function WaveEnrollButton({
  enrolled,
  onEnroll,
  className = "",
  label = "Enroll",
  doneLabel = "Enrolled",
}: Props) {
  return (
    <button
      type="button"
      disabled={enrolled}
      onClick={(e) => {
        e.stopPropagation();
        onEnroll();
      }}
      className={`wave-btn liquid-btn liquid-btn-light relative !min-h-[44px] overflow-hidden border border-white/90 px-4 text-[13px] ${className}`}
    >
      <span className={`wave-btn-fill ${enrolled ? "on" : ""}`} />
      <span
        className={`wave-btn-label font-bold ${
          enrolled ? "text-white" : "text-navy"
        }`}
      >
        {enrolled ? `✓ ${doneLabel}` : label}
      </span>
    </button>
  );
}
