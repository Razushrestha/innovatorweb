"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { BlobBackground } from "@/components/BlobBackground";
import { BrandMark } from "@/components/BrandMark";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { LiquidButton } from "@/components/LiquidButton";
import { ApiException } from "@/lib/api-client";
import { register } from "@/lib/auth-api";

function slugUsername(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const username = useMemo(
    () => slugUsername(fullName) || "innovator",
    [fullName],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        username,
        email: email.trim(),
        password,
      });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BlobBackground>
      <main className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="animate-fade-up liquid-glass w-full max-w-md space-y-5 p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <BrandMark size={52} />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
              Innovator
            </p>
            <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-[-0.03em] text-navy">
              Create account
            </h1>
            <p className="mt-1 text-[13.5px] text-muted">
              Join and start sharing with the community
            </p>
          </div>

          <form className="space-y-3.5" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="pl-1 text-[12.5px] font-semibold text-muted">
                Full name
              </span>
              <input
                name="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="glass-field"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="pl-1 text-[12.5px] font-semibold text-muted">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="glass-field"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="pl-1 text-[12.5px] font-semibold text-muted">
                Password
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-field"
              />
            </label>

            <div>
              <p className="mb-1.5 pl-1 text-[12.5px] font-semibold text-muted">
                Gender
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["Male", "Female", "Other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`liquid-chip justify-center ${
                      gender === g ? "liquid-chip-active" : ""
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <p className="liquid-panel px-3 py-2 text-[12.5px] text-red-700">
                {error}
              </p>
            ) : null}

            <LiquidButton type="submit" disabled={busy}>
              {busy ? "Creating…" : "Sign Up"}
            </LiquidButton>
          </form>

          <div className="flex items-center gap-3 text-[12px] text-muted">
            <span className="liquid-divider flex-1" />
            or
            <span className="liquid-divider flex-1" />
          </div>

          <GoogleSignInButton onSuccess={() => router.replace("/app")} />

          <p className="text-center text-[13px] text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-navy underline-offset-2 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </main>
    </BlobBackground>
  );
}
