import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { tokenHash } from "./security/crypto";
import { HttpError } from "./security/http";
export const cookieName = "solara_session";
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: tokenHash(token) },
    include: { user: { include: { preference: true } } },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 7 * 86400000);
  await db.session.create({
    data: { id: tokenHash(token), userId, expiresAt: expires },
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}
export async function ownedDevice(userId: string, id: string) {
  const device = await db.device.findFirst({
    where: { id, collector: { plant: { integration: { userId } } } },
    include: {
      collector: { include: { plant: { include: { integration: true } } } },
    },
  });
  if (!device) throw new HttpError(404, "Device not found.");
  return device;
}
export async function audit(
  userId: string,
  event: string,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  await db.auditLog.create({ data: { userId, event, metadata } });
}
