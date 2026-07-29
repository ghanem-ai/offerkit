"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-next/client";
import { KeyRound } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm({
  ssoEnabled,
  ssoProviderId,
}: {
  ssoEnabled: boolean;
  ssoProviderId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const gt = useGT();
  const [error, setError] = useState<string | null>(null);
  const next = params.get("next") ?? "/dashboard";

  const signInWithSso = async () => {
    setError(null);
    const result = await signIn.sso({
      providerId: ssoProviderId,
      callbackURL: next,
    });
    if (result?.error) {
      setError(result.error.message ?? gt("Single sign-on failed"));
    }
  };

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await signIn.email(value);
      if (result.error) {
        setError(result.error.message ?? gt("Sign in failed"));
        return;
      }
      router.push(next);
      router.refresh();
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <T>Sign in</T>
          </CardTitle>
          <CardDescription>
            <T>Welcome to Offerkit</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ssoEnabled ? (
            <>
              <Button type="button" className="w-full" onClick={() => void signInWithSso()}>
                <KeyRound />
                <T>Continue with Ghanem SSO</T>
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <T>Emergency access</T>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Email</T>
                  </Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Password</T>
                  </Label>
                  <Input
                    id={field.name}
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <T>Signing in…</T> : <T>Sign in</T>}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
