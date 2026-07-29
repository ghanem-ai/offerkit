import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sso } from "@better-auth/sso";
import { eq } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { sendEmail } from "@offerkit/core/email";
import { db } from "./db.ts";

let cached: ReturnType<typeof build> | undefined;

export const samlAccountLinkingPolicy = {
  enabled: true,
  requireLocalEmailVerified: false,
} as const;

export const samlDomainVerification = { enabled: true } as const;

export function samlRoleForUser(
  currentRole: string | null | undefined,
  groupsClaim: unknown,
  adminGroup: string,
): "admin" | "member" {
  if (currentRole === "admin") return "admin";
  const groups =
    typeof groupsClaim === "string"
      ? [groupsClaim]
      : Array.isArray(groupsClaim)
        ? groupsClaim.filter((entry): entry is string => typeof entry === "string")
        : [];
  return groups.includes(adminGroup) ? "admin" : "member";
}

function build() {
  const baseURL = process.env["OFFERKIT_PUBLIC_URL"] ?? "http://localhost:3000";
  const secret = process.env["BETTER_AUTH_SECRET"];
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }
  const samlEnabled = process.env["SAML_ENABLED"] === "true";
  // No deployment-specific defaults: a misconfigured self-host must fail
  // loudly rather than silently point at somebody else's IdP.
  const requireSamlEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required when SAML_ENABLED=true`);
    return value;
  };
  const samlCertificate = samlEnabled ? requireSamlEnv("SAML_IDP_CERTIFICATE") : "";
  const samlIdpEntityId = samlEnabled ? requireSamlEnv("SAML_IDP_ENTITY_ID") : "";
  const samlEntryPoint = samlEnabled ? requireSamlEnv("SAML_IDP_SSO_URL") : "";
  const samlEmailDomain = samlEnabled ? requireSamlEnv("SAML_EMAIL_DOMAIN") : "";
  const samlProviderId = process.env["SAML_PROVIDER_ID"] ?? "authentik";
  const samlIssuer = process.env["SAML_SP_ENTITY_ID"] ?? baseURL;
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
      // SAML is the sole interactive login method in SSO deployments.
      // Password auth remains available for self-hosted instances without SAML.
      enabled: !samlEnabled,
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
    account: samlEnabled
      ? {
          accountLinking: samlAccountLinkingPolicy,
        }
      : undefined,
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
            // The configured default provider is controlled by the deployment.
            // Domain verification marks it as trusted only when the signed
            // assertion email matches SAML_EMAIL_DOMAIN.
            domainVerification: samlDomainVerification,
            defaultSSO: [
              {
                providerId: samlProviderId,
                domain: samlEmailDomain,
                samlConfig: {
                  issuer: samlIssuer,
                  entryPoint: samlEntryPoint,
                  cert: samlCertificate,
                  idpMetadata: {
                    entityID: samlIdpEntityId,
                    cert: samlCertificate,
                  },
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
                columns: { disabledAt: true, role: true },
              });
              if (existing?.disabledAt) {
                throw new APIError("FORBIDDEN", { message: "This account is disabled" });
              }
              // An SSO login must never demote an existing administrator. New
              // users are promoted only through the configured IdP admin group.
              await db()
                .update(schema.user)
                .set({
                  role: samlRoleForUser(
                    existing?.role,
                    userInfo["groups"],
                    samlAdminGroup,
                  ),
                  mustChangePassword: false,
                  updatedAt: new Date(),
                })
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
