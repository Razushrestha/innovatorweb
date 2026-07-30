"use client";

import { GoogleLogin } from "@react-oauth/google";
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

  if (!ApiConfig.googleClientId) {
    return (
      <LiquidButton type="button" variant="light" disabled>
        Continue with Google
      </LiquidButton>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex w-full justify-center ${busy ? "pointer-events-none opacity-55" : ""}`}
      >
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            const idToken = credentialResponse.credential;
            if (!idToken) {
              setError("Google did not return an ID token");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              // Backend validates a Google ID token (JWT), not an access token.
              await loginWithGoogle(idToken);
              onSuccess();
            } catch (e) {
              setError(
                e instanceof ApiException ? e.message : "Google sign-in failed",
              );
            } finally {
              setBusy(false);
            }
          }}
          onError={() => setError("Google sign-in was cancelled")}
          useOneTap={false}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          width="320"
        />
      </div>
      {error ? (
        <p className="text-center text-[12px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
