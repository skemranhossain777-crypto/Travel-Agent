import {
  ensureSession,
  getRunner,
  USER_ID,
} from "@/lib/agent";
import { isFinalResponse } from "@google/adk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  message?: string;
  sessionId?: string;
};

type SseEvent =
  | { event: "tool"; data: { name: string } }
  | { event: "text"; data: { text: string } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { message: string } };

function friendlyError(
  code: string | undefined,
  raw: string | undefined
): string {
  const message = raw?.trim();
  if (
    code === "429" ||
    code === "500" ||
    code === "503" ||
    /quota|RESOURCE_EXHAUSTED|429/i.test(message ?? "")
  ) {
    return "The Gemini API quota for this key is currently exhausted (HTTP 429). Wait a moment and try again, or switch to a different model or API key. See the README “429 RESOURCE_EXHAUSTED” section for details.";
  }
  if (message) {
    return message;
  }
  return "The model did not produce a response. Please try again.";
}

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "message is required." }, { status: 400 });
  }
  if (message.length > 10_000) {
    return Response.json(
      { error: "message is too long (max 10000 characters)." },
      { status: 400 }
    );
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId
      ? body.sessionId
      : crypto.randomUUID();

  let runner: Awaited<ReturnType<typeof getRunner>>;
  try {
    runner = await getRunner();
    await ensureSession(sessionId);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize the travel agent.",
      },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: SseEvent) => {
        controller.enqueue(
          encoder.encode(
            `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`
          )
        );
      };

      try {
        for await (const event of runner.runAsync({
          userId: USER_ID,
          sessionId,
          newMessage: { role: "user", parts: [{ text: message }] },
        })) {
          if (event.errorCode || event.errorMessage) {
            send({
              event: "error",
              data: {
                message: friendlyError(event.errorCode, event.errorMessage),
              },
            });
            break;
          }

          const functionCallNames =
            event.content?.parts
              ?.map((part) => part.functionCall?.name)
              .filter((name): name is string => Boolean(name)) ?? [];
          for (const name of functionCallNames) {
            send({ event: "tool", data: { name } });
          }

          const text =
            event.content?.parts
              ?.filter((part) => part.text && !part.thought)
              .map((part) => part.text ?? "")
              .join("") ?? "";
          if (text) {
            send({ event: "text", data: { text } });
          }

          if (isFinalResponse(event)) {
            send({ event: "done", data: {} });
          }
        }
      } catch (error) {
        console.error("[api/chat] Agent run failed:", error);
        send({
          event: "error",
          data: {
            message:
              error instanceof Error
                ? error.message
                : "The agent failed to respond. Please try again.",
          },
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Stream may already be closed by the client.
        }
      }
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
}
