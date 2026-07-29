"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ApiConfig } from "@/lib/api-config";

export function GoogleAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientId = ApiConfig.googleClientId;
  if (!clientId) return <>{children}</>;
  return (
    <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
  );
}
