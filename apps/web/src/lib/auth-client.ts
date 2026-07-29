import { createAuthClient } from "better-auth/react";
import { ssoClient } from "@better-auth/sso/client";

export const authClient = createAuthClient({
  baseURL: process.env["NEXT_PUBLIC_OFFERKIT_PUBLIC_URL"] ?? "",
  plugins: [ssoClient()],
});

export const { signIn, signOut, changePassword } = authClient;
