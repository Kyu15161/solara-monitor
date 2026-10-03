import { z } from "zod";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { audit, cookieName, createSession, requireUser } from "@/lib/auth";
import { hashPassword, checkPassword, tokenHash } from "@/lib/security/crypto";
import {
  apiError,
  body,
  HttpError,
  rateLimit,
  requireOrigin,
} from "@/lib/security/http";
import { connectDemo } from "@/lib/demo";
const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});
const password = z.string().min(12).max(200);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    requireOrigin(req);
    const { action } = await params;
    // The global limit works even without trusting spoofable forwarding headers.
    await rateLimit("auth:global", 300, 60);
    if (action === "demo") {
      if (process.env.ENABLE_DEMO !== "true")
        throw new HttpError(403, "Demo access is disabled.");
      await rateLimit("demo:create", 20, 3600);
      const existing = await import("@/lib/auth").then((m) => m.currentUser());
      const user =
        existing ??
        (await db.user.create({
          data: {
            name: "Demo Explorer",
            email: `demo-${randomBytes(8).toString("hex")}@example.local`,
            isDemo: true,
            preference: { create: {} },
          },
        }));
      await createSession(user.id);
      await connectDemo(user.id);
      return Response.json({ ok: true });
    }
    if (action === "signup") {
      const input = await body(
        req,
        loginSchema.extend({
          name: z.string().trim().min(2).max(80),
          password,
          confirmPassword: password,
          acceptTerms: z.literal(true),
        }),
      );
      if (input.password !== input.confirmPassword)
        throw new HttpError(400, "Passwords do not match.");
      await rateLimit(`signup:${tokenHash(input.email)}`, 3, 3600);
      if (await db.user.findUnique({ where: { email: input.email } }))
        throw new HttpError(
          409,
          "Unable to register this email. Try signing in or resetting your password.",
        );
      const user = await db.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: await hashPassword(input.password),
          preference: { create: {} },
        },
      });
      await createSession(user.id);
      await audit(user.id, "signup");
      return Response.json({ ok: true });
    }
    if (action === "login") {
      const input = await body(req, loginSchema);
      await rateLimit(`login:${tokenHash(input.email)}`, 8, 900);
      const user = await db.user.findUnique({ where: { email: input.email } });
      const valid = await checkPassword(
        input.password,
        user?.passwordHash ??
          "scrypt:0123456789abcdef:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      );
      if (!user || !valid)
        throw new HttpError(401, "Email or password is incorrect.");
      await createSession(user.id);
      await audit(user.id, "login");
      return Response.json({ ok: true });
    }
    if (action === "logout") {
      const user = await requireUser();
      const jar = await cookies();
      const token = jar.get(cookieName)?.value;
      if (token)
        await db.session.deleteMany({ where: { id: tokenHash(token) } });
      jar.delete(cookieName);
      await audit(user.id, "logout");
      return Response.json({ ok: true });
    }
    if (action === "forgot-password") {
      if (!process.env.MAIL_WEBHOOK_URL || !process.env.MAIL_WEBHOOK_SECRET)
        throw new HttpError(
          503,
          "Password reset email delivery is not configured. Contact the application operator.",
        );
      const input = await body(
        req,
        z.object({ email: z.email().transform((v) => v.toLowerCase()) }),
      );
      await rateLimit(`reset:${tokenHash(input.email)}`, 3, 3600);
      const user = await db.user.findUnique({ where: { email: input.email } });
      if (user && !user.isDemo) {
        const token = randomBytes(32).toString("base64url");
        await db.resetToken.create({
          data: {
            id: tokenHash(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + 1800000),
          },
        });
        const url = new URL(process.env.MAIL_WEBHOOK_URL);
        if (url.protocol !== "https:")
          throw new HttpError(503, "Email delivery requires HTTPS.");
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.MAIL_WEBHOOK_SECRET}`,
          },
          body: JSON.stringify({
            to: user.email,
            subject: "Reset your Solara password",
            text: `Reset your password: ${process.env.APP_URL}/reset-password?token=${token}`,
          }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        if (!response.ok)
          throw new HttpError(
            503,
            "Email delivery is temporarily unavailable.",
          );
      }
      return Response.json({
        message:
          "If an eligible account exists, a reset email has been requested.",
      });
    }
    if (action === "reset-password") {
      const input = await body(
        req,
        z.object({ token: z.string().min(30).max(200), password }),
      );
      const record = await db.resetToken.findUnique({
        where: { id: tokenHash(input.token) },
      });
      if (!record || record.expiresAt < new Date())
        throw new HttpError(400, "This reset link is invalid or expired.");
      const passwordHash = await hashPassword(input.password);
      await db.$transaction(async (tx) => {
        const used = await tx.resetToken.deleteMany({
          where: { id: record.id, expiresAt: { gt: new Date() } },
        });
        if (!used.count) throw new HttpError(400, "Reset link already used.");
        await tx.user.update({
          where: { id: record.userId },
          data: { passwordHash },
        });
        await tx.session.deleteMany({ where: { userId: record.userId } });
      });
      return Response.json({ message: "Password updated. Please sign in." });
    }
    throw new HttpError(404, "Not found.");
  } catch (error) {
    return apiError(error);
  }
}
