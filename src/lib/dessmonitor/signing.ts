import { createHash } from "node:crypto";
export const sha1 = (value: string) =>
  createHash("sha1").update(value, "utf8").digest("hex");
export const authSignature = (salt: string, password: string, tail: string) =>
  sha1(salt + sha1(password) + tail);
export const requestSignature = (
  salt: string,
  secret: string,
  token: string,
  tail: string,
) => sha1(salt + secret + token + tail);
export function queryTail(action: string, params: Record<string, string>) {
  return "&" + new URLSearchParams({ action, ...params }).toString();
}
