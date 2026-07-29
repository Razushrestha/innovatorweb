"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type HubSlide = {
  id: string;
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  priceLabel: string;
};

type Props = {
  slides: HubSlide[];
  onOpen?: (id: string) => void;
};

export function HubCarousel({ slides, onOpen }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 3200);
    return () => window.clearInterval(t);
  }, [slides.length, paused]);

  if (slides.length === 0) return null;
  const slide = slides[index] ?? slides[0];

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={() => onOpen?.(slide.id)}
        className="hub-featured liquid-press group relative w-full text-left"
      >
        <Image
          src={slide.image}
          alt={slide.title}
          fill
          priority
          className="object-cover transition duration-700 group-hover:scale-[1.03]"
        />
        <span className="hub-featured-overlay" />
        <span className="relative z-[1] flex h-full min-h-[176px] flex-col justify-between p-4 sm:p-5">
          <span className="inline-flex w-fit rounded-full border border-white/40 bg-white/18 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {slide.badge}
          </span>
          <span>
            <span className="block font-display text-[18.5px] font-bold tracking-[-0.03em] text-white">
              {slide.title}
            </span>
            <span className="mt-1 block text-[12.5px] text-white/75">
              {slide.subtitle}
            </span>
            <span className="mt-3 flex items-center justify-between gap-3">
              <span className="font-display text-[17px] font-extrabold text-white">
                {slide.priceLabel}
              </span>
              <span className="rounded-full bg-white/92 px-3 py-1.5 text-[12px] font-bold text-navy shadow-soft">
                View →
              </span>
            </span>
          </span>
        </span>
      </button>

      <div className="flex items-center justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`hub-dot ${i === index ? "hub-dot-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
