"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { ApiException } from "@/lib/api-client";
import { loginWithGoogle } from "@/lib/auth-api";
import { ApiConfig } from "@/lib/api-config";
import { LiquidButton } from "./LiquidButton";

type Props = {
  onSuccess: () => void;
};

export function GoogleSignInButton({ onSuccess }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tokenResponse) => {
      setBusy(true);
      setError(null);
      try {
        // Backend accepts google_token — access token from implicit flow.
        await loginWithGoogle(tokenResponse.access_token);
        onSuccess();
      } catch (e) {
        setError(e instanceof ApiException ? e.message : "Google sign-in failed");
      } finally {
        setBusy(false);
      }
    },
    onError: () => setError("Google sign-in was cancelled"),
  });

  if (!ApiConfig.googleClientId) {
    return (
      <LiquidButton type="button" variant="light" disabled>
        Continue with Google
      </LiquidButton>
    );
  }

  return (
    <div className="space-y-2">
      <LiquidButton
        type="button"
        variant="light"
        disabled={busy}
        onClick={() => login()}
      >
        {busy ? "Connecting…" : "Continue with Google"}
      </LiquidButton>
      {error ? (
        <p className="text-center text-[12px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
