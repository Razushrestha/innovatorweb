"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  courseCategories,
  courses,
  featuredCourses,
  formatRs,
  type Course,
} from "@/lib/catalog";
import { HubCarousel } from "./HubCarousel";
import { WaveEnrollButton } from "./WaveEnrollButton";
import { LiquidEmpty, TrustStrip } from "./ui/LiquidChrome";

export function LearnSection() {
  const [category, setCategory] = useState<(typeof courseCategories)[number]>(
    "All",
  );
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Course | null>(null);
  const [enrolled, setEnrolled] = useState<Record<string, boolean>>({});
  const [openChapter, setOpenChapter] = useState(0);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const catOk = category === "All" || c.category === category;
      const qOk =
        !q.trim() ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.description.toLowerCase().includes(q.toLowerCase()) ||
        c.category.toLowerCase().includes(q.toLowerCase());
      return catOk && qOk;
    });
  }, [category, q]);

  const topSelling = useMemo(
    () =>
      [...courses].sort((a, b) => {
        const as = parseFloat(a.students) || 0;
        const bs = parseFloat(b.students) || 0;
        return bs - as;
      }),
    [],
  );

  const slides = featuredCourses.map((f, i) => ({
    id: courses[i]?.id ?? `f${i}`,
    image: f.image,
    badge: f.badge,
    title: f.name,
    subtitle: f.subtitle,
    priceLabel: f.priceLabel,
  }));

  if (active) {
    const isIn = !!enrolled[active.id];
    const chapters = Array.from({ length: active.chapters }, (_, i) => ({
      title: `Chapter ${i + 1}`,
      episodes: Math.max(2, Math.ceil(active.lessons / active.chapters)),
    }));

    return (
      <div className="animate-fade-up space-y-4 pb-8">
        <button
          type="button"
          onClick={() => {
            setActive(null);
            setOpenChapter(0);
          }}
          className="liquid-chip"
        >
          ← All courses
        </button>

        <div className="liquid-glass overflow-hidden">
          <div className="relative aspect-[16/9] bg-[var(--media-fallback)]">
            <video
              key={active.videoUrl}
              src={active.videoUrl}
              controls
              playsInline
              poster={active.image}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-gold">
              {active.category}
            </p>
            <h2 className="mt-1 font-display text-[28px] font-extrabold tracking-[-0.04em] text-navy">
              {active.name}
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink/80">
              {active.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="liquid-chip">★ {active.rating}</span>
              <span className="liquid-chip">{active.lessons} lessons</span>
              <span className="liquid-chip">{active.chapters} chapters</span>
              <span className="liquid-chip">{active.students} learners</span>
            </div>

            <div className="liquid-divider my-5" />

            <p className="hub-title !text-left">Curriculum</p>
            <div className="mt-3 space-y-2">
              {chapters.map((ch, i) => {
                const open = openChapter === i;
                return (
                  <div key={ch.title} className="liquid-panel overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenChapter(open ? -1 : i)}
                      className="liquid-press flex w-full items-center justify-between px-3.5 py-3 text-left"
                    >
                      <span>
                        <span className="block font-display text-[14.5px] font-bold text-navy">
                          {ch.title}
                        </span>
                        <span className="text-[12px] text-muted">
                          {ch.episodes} episodes
                        </span>
                      </span>
                      <span
                        className={`text-muted transition ${
                          open ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    </button>
                    {open ? (
                      <ul className="space-y-1 border-t border-white/50 px-3 pb-3 pt-2">
                        {Array.from({ length: ch.episodes }, (_, e) => (
                          <li
                            key={e}
                            className="flex items-center gap-2.5 rounded-[12px] px-2 py-2 text-[13px] text-navy/80"
                          >
                            <span className="grid h-7 w-7 place-items-center rounded-full border border-gold/50 text-[10px] font-bold text-gold">
                              ▶
                            </span>
                            Episode {e + 1}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="liquid-panel mt-4 flex items-center gap-3 px-3.5 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-navy text-gold">
                ✓
              </span>
              <span>
                <span className="block text-[13.5px] font-bold text-navy">
                  Certificate included
                </span>
                <span className="text-[12px] text-muted">
                  Earn a shareable Innovator certificate
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="liquid-glass sticky bottom-24 z-20 flex items-center justify-between gap-3 p-3.5 lg:bottom-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Price
            </p>
            <p className="font-display text-[22px] font-extrabold text-navy">
              {formatRs(active.price)}
            </p>
          </div>
          <WaveEnrollButton
            enrolled={isIn}
            label="Enroll now"
            doneLabel="Enrolled"
            className="min-w-[150px]"
            onEnroll={() =>
              setEnrolled((prev) => ({ ...prev, [active.id]: true }))
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="hub-list space-y-5 pb-8">
      <div className="stagger-in" style={{ animationDelay: "0ms" }}>
        <HubCarousel
          slides={slides}
          onOpen={(id) => {
            const c = courses.find((x) => x.id === id);
            if (c) setActive(c);
          }}
        />
      </div>

      <div className="stagger-in" style={{ animationDelay: "60ms" }}>
        <TrustStrip
          items={[
            { label: "Certificates", icon: "certificate" },
            { label: "Expert mentors", icon: "mentor" },
            { label: "7 days refund", icon: "refund" },
          ]}
        />
      </div>

      <div className="stagger-in relative" style={{ animationDelay: "100ms" }}>
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/35">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search courses…"
          className="w-full rounded-full border border-navy/[0.07] bg-white py-3 pl-10 pr-4 text-[14px] text-navy outline-none transition placeholder:text-muted focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
        />
      </div>

      <div className="stagger-in" style={{ animationDelay: "140ms" }}>
        <p className="hub-title mb-3">Top selling</p>
        <div className="flex gap-3 overflow-x-auto liquid-scroll bg-[var(--canvas)] pb-1">
          {topSelling.slice(0, 6).map((c, i) => (
            <article
              key={c.id}
              className="hub-card w-[196px] shrink-0 overflow-hidden rounded-[22px]"
            >
              <button
                type="button"
                onClick={() => setActive(c)}
                className="liquid-press w-full text-left"
              >
                <div className="relative h-[84px]">
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    className="object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-navy/85 px-2 py-0.5 text-[10px] font-bold text-gold">
                    #{i + 1} bestseller
                  </span>
                </div>
                <div className="px-3 pt-3">
                  <p className="line-clamp-2 font-display text-[14px] font-bold leading-snug text-navy">
                    {c.name}
                  </p>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {c.students} learners · {c.lessons} lessons
                  </p>
                </div>
              </button>
              <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
                <span className="text-[13px] font-bold text-navy">
                  {formatRs(c.price)}
                </span>
                <WaveEnrollButton
                  enrolled={!!enrolled[c.id]}
                  label="Enroll"
                  className="!min-h-[32px] !px-2.5 !py-1 text-[11px]"
                  onEnroll={() =>
                    setEnrolled((prev) => ({ ...prev, [c.id]: true }))
                  }
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="stagger-in" style={{ animationDelay: "180ms" }}>
        <p className="hub-title mb-3">Categories</p>
        <div className="flex flex-wrap gap-2">
          {courseCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`liquid-chip ${
                category === c ? "liquid-chip-active" : ""
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger-in" style={{ animationDelay: "220ms" }}>
        <div className="mb-3 flex items-end justify-between gap-2">
          <p className="hub-title !text-left">Courses</p>
          <p className="text-[12.5px] font-semibold text-muted">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <LiquidEmpty
            title="No courses found"
            body="Try another category or keyword."
            actionLabel={q ? "Clear search" : undefined}
            onAction={q ? () => setQ("") : undefined}
          />
        ) : (
          <div className="hub-grid">
            {filtered.map((c, i) => (
              <article
                key={c.id}
                className="hub-card stagger-in liquid-press overflow-hidden rounded-[22px]"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setActive(c)}
                  className="w-full text-left"
                >
                  <div className="relative aspect-[1.45]">
                    <Image
                      src={c.image}
                      alt={c.name}
                      fill
                      className="object-cover"
                    />
                    <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-navy shadow-soft">
                      ★ {c.rating}
                    </span>
                    <span className="absolute bottom-2 left-2 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-bold text-white">
                      {c.category}
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 font-display text-[14.5px] font-bold leading-snug tracking-[-0.02em] text-navy">
                      {c.name}
                    </h3>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[13px] font-bold text-navy">
                        {formatRs(c.price)}
                      </span>
                      <span className="text-[11px] text-muted">
                        {c.lessons} lessons
                      </span>
                    </div>
                  </div>
                </button>
                <div className="px-3 pb-3">
                  <WaveEnrollButton
                    enrolled={!!enrolled[c.id]}
                    className="w-full !min-h-[36px] text-[12px]"
                    onEnroll={() =>
                      setEnrolled((prev) => ({ ...prev, [c.id]: true }))
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
