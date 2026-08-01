"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BlobBackground } from "@/components/BlobBackground";
import { BrandMark } from "@/components/BrandMark";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { LiquidButton } from "@/components/LiquidButton";
import { ApiException } from "@/lib/api-client";
import { login } from "@/lib/auth-api";
import { AuthSession } from "@/lib/auth-session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (AuthSession.isSignedIn()) router.replace("/app");
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BlobBackground>
      <main className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="animate-fade-up liquid-glass w-full max-w-md space-y-5 p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <BrandMark size={72} variant="soft" priority />
            <h1 className="mt-4 font-display text-[32px] font-extrabold tracking-[-0.045em] text-navy">
              Innovator
            </h1>
            <p className="mt-1 text-[14px] font-medium text-muted">
              Welcome back. Sign in to continue.
            </p>
          </div>

          <form className="space-y-3.5" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="pl-1 text-[12.5px] font-semibold text-muted">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-field"
              />
            </label>

            {error ? (
              <p className="liquid-panel px-3 py-2 text-[12.5px] text-red-700">
                {error}
              </p>
            ) : null}

            <LiquidButton type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </LiquidButton>
          </form>

          <div className="flex items-center gap-3 text-[12px] text-muted">
            <span className="liquid-divider flex-1" />
            or
            <span className="liquid-divider flex-1" />
          </div>

          <GoogleSignInButton onSuccess={() => router.replace("/app")} />

          <p className="text-center text-[13px] text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-navy underline-offset-2 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </BlobBackground>
  );
}
