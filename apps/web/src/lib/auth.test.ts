import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { auth, samlRoleFromGroups } from "./auth";

describe("SAML configuration", () => {
  const samlVars = [
    "SAML_ENABLED",
    "SAML_IDP_CERTIFICATE",
    "SAML_IDP_ENTITY_ID",
    "SAML_IDP_SSO_URL",
    "SAML_EMAIL_DOMAIN",
  ];
  const originalSecret = process.env["BETTER_AUTH_SECRET"];

  afterEach(() => {
    for (const name of samlVars) delete process.env[name];
    if (originalSecret === undefined) delete process.env["BETTER_AUTH_SECRET"];
    else process.env["BETTER_AUTH_SECRET"] = originalSecret;
  });

  it.each(["SAML_IDP_CERTIFICATE", "SAML_IDP_ENTITY_ID", "SAML_IDP_SSO_URL", "SAML_EMAIL_DOMAIN"])(
    "refuses to build without %s instead of falling back to a bundled IdP",
    (missing) => {
      process.env["BETTER_AUTH_SECRET"] = "test-secret-at-least-32-characters-long";
      process.env["SAML_ENABLED"] = "true";
      process.env["SAML_IDP_CERTIFICATE"] = "cert";
      process.env["SAML_IDP_ENTITY_ID"] = "https://idp.example.com/metadata/";
      process.env["SAML_IDP_SSO_URL"] = "https://idp.example.com/sso/";
      process.env["SAML_EMAIL_DOMAIN"] = "example.com";
      delete process.env[missing];

      expect(() => auth()).toThrow(new RegExp(`${missing} is required`));
    },
  );
});

describe("SAML dependency hardening", () => {
  it("installs the InResponseTo compatibility patch", () => {
    const source = readFileSync(
      fileURLToPath(import.meta.resolve("@better-auth/sso")),
      "utf8",
    );
    expect(source).toContain(
      "extract.response?.inResponseTo ?? extract.inResponseTo",
    );
  });
});

describe("samlRoleFromGroups", () => {
  it.each([
    ["platform-admins", "admin"],
    [["engineering", "platform-admins"], "admin"],
    ["engineering", "member"],
    [[], "member"],
  ] as const)("maps a present group claim %#", (claim, expected) => {
    expect(samlRoleFromGroups(claim, "platform-admins")).toBe(expected);
  });

  it.each([undefined, null])(
    "preserves the existing role when the group claim is absent (%s)",
    (claim) => {
      expect(samlRoleFromGroups(claim, "platform-admins")).toBeUndefined();
    },
  );
});
