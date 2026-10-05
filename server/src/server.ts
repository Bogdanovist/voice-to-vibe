import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Config } from "./config.ts";
import { TurnFailed, type TurnRequest, type TurnResult } from "./turn.ts";

export type RunTurn = (req: TurnRequest) => Promise<TurnResult>;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function authorised(req: IncomingMessage, token: string): boolean {
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw);
}

export function createVoiceServer(config: Config, runTurn: RunTurn): Server {
  const server = createServer(async (req, res) => {
    if (!authorised(req, config.token)) return send(res, 401, { spoken: "The phone's token is wrong." });

    if (req.method === "GET" && req.url === "/projects") {
      return send(res, 200, config.projects.map((p) => ({ name: p.name })));
    }

    if (req.method === "POST" && req.url === "/turns") {
      let body: { project?: unknown; sessionId?: unknown; text?: unknown };
      try {
        body = (await readJson(req)) as typeof body;
      } catch {
        return send(res, 400, { spoken: "The phone sent a request I could not read." });
      }
      const project = config.projects.find((p) => p.name === body.project);
      if (!project) return send(res, 404, { spoken: `I don't know a project called ${String(body.project)}.` });
      if (typeof body.text !== "string" || body.text.trim() === "") {
        return send(res, 400, { spoken: "The turn had no words in it." });
      }
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
      try {
        return send(res, 200, await runTurn({ cwd: project.path, sessionId, text: body.text }));
      } catch (e) {
        const reason = e instanceof TurnFailed ? e.message : "Something went wrong on the Mac.";
        return send(res, 500, { spoken: `The turn failed. ${reason}` });
      }
    }

    send(res, 404, { spoken: "The phone asked for something I don't serve." });
  });
  // A turn can run for many minutes; Node's default five-minute request timeout would cut it off.
  server.requestTimeout = 0;
  return server;
}
