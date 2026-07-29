import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm
        ssoEnabled={process.env["SAML_ENABLED"] === "true"}
        ssoProviderId={process.env["SAML_PROVIDER_ID"] ?? "authentik"}
      />
    </Suspense>
  );
}
