import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { samlRoleFromGroups } from "./auth";

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
