import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sso } from "@better-auth/sso";
import { eq } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { sendEmail } from "@offerkit/core/email";
import { db } from "./db.ts";

let cached: ReturnType<typeof build> | undefined;

function normalizeClaimList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function build() {
  const baseURL = process.env["OFFERKIT_PUBLIC_URL"] ?? "http://localhost:3000";
  const secret = process.env["BETTER_AUTH_SECRET"];
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }
  const samlEnabled = process.env["SAML_ENABLED"] === "true";
  const samlCertificate = process.env["SAML_IDP_CERTIFICATE"];
  if (samlEnabled && !samlCertificate) {
    throw new Error("SAML_IDP_CERTIFICATE is required when SAML_ENABLED=true");
  }
  const samlProviderId = process.env["SAML_PROVIDER_ID"] ?? "authentik";
  const samlIssuer = process.env["SAML_SP_ENTITY_ID"] ?? baseURL;
  const samlEntryPoint =
    process.env["SAML_IDP_SSO_URL"] ??
    "https://auth.internal.ghanem.dev/application/saml/offerkit/";
  const samlCallbackUrl = `${baseURL}/api/auth/sso/saml2/sp/acs/${samlProviderId}`;
  const samlGroupsAttribute =
    process.env["SAML_GROUPS_ATTRIBUTE"] ?? "http://schemas.xmlsoap.org/claims/Group";
  const samlAdminGroup = process.env["SAML_ADMIN_GROUP"] ?? "platform-admins";
  const samlAllowIdpInitiated = process.env["SAML_ALLOW_IDP_INITIATED"] === "true";

  return betterAuth({
    baseURL,
    secret,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your Offerkit password",
          html: `<p>Open this link to reset your password: <a href="${url}">${url}</a></p>`,
          text: `Reset your password: ${url}`,
        });
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "member", input: false },
        mustChangePassword: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        disabledAt: { type: "date", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await db().query.user.findFirst({
              where: eq(schema.user.id, session.userId),
              columns: { disabledAt: true },
            });
            if (!user || user.disabledAt) {
              throw new APIError("FORBIDDEN", { message: "This account is disabled" });
            }
            return { data: session };
          },
        },
      },
    },
    plugins: samlEnabled
      ? [
          sso({
            defaultSSO: [
              {
                providerId: samlProviderId,
                domain: "ghanem.sa",
                samlConfig: {
                  issuer: samlIssuer,
                  entryPoint: samlEntryPoint,
                  cert: samlCertificate ?? "",
                  callbackUrl: samlCallbackUrl,
                  idpInitiatedCallbackUrl: `${baseURL}/dashboard`,
                  audience: samlIssuer,
                  wantAssertionsSigned: true,
                  authnRequestsSigned: false,
                  signatureAlgorithm: "sha256",
                  digestAlgorithm: "sha256",
                  identifierFormat:
                    "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                  spMetadata: { entityID: samlIssuer, binding: "post" },
                  mapping: {
                    id: "nameID",
                    email:
                      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
                    name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
                    extraFields: { groups: samlGroupsAttribute },
                  },
                },
              },
            ],
            saml: {
              enableInResponseToValidation: true,
              allowIdpInitiated: samlAllowIdpInitiated,
              requireTimestamps: true,
              clockSkew: 5 * 60 * 1000,
              maxResponseSize: 256 * 1024,
              maxMetadataSize: 100 * 1024,
            },
            provisionUserOnEveryLogin: true,
            provisionUser: async ({ user, userInfo }) => {
              const existing = await db().query.user.findFirst({
                where: eq(schema.user.id, user.id),
                columns: { disabledAt: true },
              });
              if (existing?.disabledAt) {
                throw new APIError("FORBIDDEN", { message: "This account is disabled" });
              }
              const groups = normalizeClaimList(userInfo["groups"]);
              const role = groups.includes(samlAdminGroup) ? "admin" : "member";
              await db()
                .update(schema.user)
                .set({ role, mustChangePassword: false, updatedAt: new Date() })
                .where(eq(schema.user.id, user.id));
            },
          }),
        ]
      : [],
  });
}

export type Auth = ReturnType<typeof build>;

export function auth(): Auth {
  cached ??= build();
  return cached;
}
