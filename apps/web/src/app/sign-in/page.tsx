import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

// Read SSO configuration from the running container's env, not the build's.
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm
        ssoEnabled={process.env["SAML_ENABLED"] === "true"}
        ssoProviderId={process.env["SAML_PROVIDER_ID"] ?? "authentik"}
        ssoLabel={process.env["SAML_BUTTON_LABEL"]}
      />
    </Suspense>
  );
}
