import { schema } from "@offerkit/db";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { logger } from "@offerkit/core/observability";

const log = logger.child({ component: "seed-admin" });

export async function seedAdmin(): Promise<void> {
  const userCount = await db().$count(schema.user);
  if (userCount > 0) return;

  const email = process.env["ADMIN_EMAIL"];
  const password = process.env["ADMIN_PASSWORD"];

  if (!email || !password) {
    throw new Error(
      "No users found in database. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the initial admin.",
    );
  }

  log.info({ email }, "creating initial admin user");

  // Public sign-up is disabled, so create the credential account directly
  // instead of going through auth().api.signUpEmail.
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await db().transaction(async (tx) => {
    await tx.insert(schema.user).values({
      id: userId,
      email,
      name: "Admin",
      role: "admin",
      mustChangePassword: true,
    });
    await tx.insert(schema.account).values({
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    });
  });

  log.info(
    { email },
    "admin user created — password change will be required on first login",
  );
}
