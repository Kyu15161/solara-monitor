import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/security/http";
import { tokenHash } from "@/lib/security/crypto";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const token = (await cookies()).get("solara_session")!.value;
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let previous = "";
    const stream = new ReadableStream({
      start(controller) {
        const poll = async () => {
          if (cancelled) return;
          try {
            const session = await db.session.findUnique({
              where: { id: tokenHash(token) },
            });
            if (!session || session.expiresAt < new Date()) {
              cancelled = true;
              controller.close();
              return;
            }
            const [sync, notification, command, alert] = await Promise.all([
              db.solarIntegration.findMany({
                where: { userId: user.id },
                select: {
                  lastSync: true,
                  lastError: true,
                  connected: true,
                  scenario: true,
                },
              }),
              db.notification.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
                select: { id: true, readAt: true },
              }),
              db.controlAction.findFirst({
                where: { userId: user.id },
                orderBy: { requestedAt: "desc" },
                select: { id: true, status: true },
              }),
              db.alert.count({
                where: {
                  device: {
                    collector: { plant: { integration: { userId: user.id } } },
                  },
                  resolvedAt: null,
                },
              }),
            ]);
            const next = tokenHash(
              JSON.stringify({ sync, notification, command, alert }),
            );
            if (next !== previous) {
              controller.enqueue(
                encoder.encode(
                  `event: update\ndata: ${JSON.stringify({ revision: next })}\n\n`,
                ),
              );
              previous = next;
            } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            if (!cancelled)
              controller.enqueue(
                encoder.encode("event: connection-error\ndata: {}\n\n"),
              );
          }
          if (!cancelled) timer = setTimeout(poll, 3000);
        };
        void poll();
        req.signal.addEventListener(
          "abort",
          () => {
            cancelled = true;
            clearTimeout(timer);
            try {
              controller.close();
            } catch {}
          },
          { once: true },
        );
      },
      cancel() {
        cancelled = true;
        clearTimeout(timer);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
