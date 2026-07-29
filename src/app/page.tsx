"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlobBackground } from "@/components/BlobBackground";
import { BrandMark } from "@/components/BrandMark";
import { AuthSession } from "@/lib/auth-session";

export default function SplashPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => {
        router.replace(AuthSession.isSignedIn() ? "/app" : "/login");
      }, 320);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <BlobBackground>
      <main
        className={`flex min-h-dvh flex-col items-center justify-center px-6 transition-opacity duration-300 ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="animate-fade-up flex flex-col items-center text-center">
          <div className="mb-6 grid place-items-center">
            <div className="liquid-glass grid h-[124px] w-[124px] place-items-center !rounded-[32px] p-3 shadow-glass">
              <BrandMark size={92} variant="plain" priority />
            </div>
          </div>
          <h1 className="font-display text-[42px] font-extrabold tracking-[-0.04em] text-navy">
            Innovator
          </h1>
          <p className="mt-2 max-w-[260px] text-[15px] font-medium text-muted">
            Learn, share, and grow in one place.
          </p>
          <div className="mt-6 h-1 w-16 overflow-hidden rounded-full bg-navy/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gold" />
          </div>
        </div>
      </main>
    </BlobBackground>
  );
}
