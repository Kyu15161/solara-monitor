import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "../db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!process.env.APP_URL)
    throw new HttpError(503, "Application origin is not configured.");
  if (origin !== new URL(process.env.APP_URL).origin)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function body<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  if (Number(req.headers.get("content-length")) > 32768)
    throw new HttpError(413, "Request too large.");
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send application/json.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return schema.parse(JSON.parse(raw));
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const now = new Date();
  const rows = await db.$queryRaw<
    Array<{ count: number }>
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${key},1,${new Date(now.getTime() + seconds * 1000)}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt" < ${now} THEN 1 ELSE "RateLimit"."count"+1 END, "expiresAt"=CASE WHEN "RateLimit"."expiresAt" < ${now} THEN ${new Date(now.getTime() + seconds * 1000)} ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > limit)
    throw new HttpError(
      429,
      "Too many requests. Please wait before trying again.",
    );
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return Response.json(
      { error: "Invalid request. Check the supplied fields." },
      { status: 400 },
    );
  console.error(
    JSON.stringify({
      event: "request.failed",
      type: error instanceof Error ? error.name : "unknown",
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : undefined,
      model:
        error instanceof Prisma.PrismaClientKnownRequestError &&
        typeof error.meta?.modelName === "string"
          ? error.meta.modelName
          : undefined,
    }),
  );
  return Response.json(
    { error: "The operation could not be completed. Please try again." },
    { status: 500 },
  );
}
