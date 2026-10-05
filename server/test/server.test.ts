import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Config } from "../src/config.ts";
import { createVoiceServer, type RunTurn } from "../src/server.ts";
import { TurnFailed, type TurnRequest } from "../src/turn.ts";

const token = "t".repeat(32);
const config: Config = { host: "100.64.0.1", port: 0, token, projects: [{ name: "flux", path: "/src/flux" }] };

async function withServer(runTurn: RunTurn, fn: (url: string) => Promise<void>): Promise<void> {
  const server = createVoiceServer(config, runTurn);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

const auth = { authorization: `Bearer ${token}` };
const neverRuns: RunTurn = () => Promise.reject(new Error("should not run"));

test("rejects a request without the token", async () => {
  await withServer(neverRuns, async (url) => {
    const res = await fetch(`${url}/projects`);
    assert.equal(res.status, 401);
    assert.ok(((await res.json()) as { spoken: string }).spoken);
  });
});

test("lists project names without their paths", async () => {
  await withServer(neverRuns, async (url) => {
    const res = await fetch(`${url}/projects`, { headers: auth });
    assert.deepEqual(await res.json(), [{ name: "flux" }]);
  });
});

test("runs a turn in the project's checkout", async () => {
  let seen: TurnRequest | undefined;
  const runTurn: RunTurn = async (req) => {
    seen = req;
    return { sessionId: "s1", spoken: "Tests pass.", denied: [] };
  };
  await withServer(runTurn, async (url) => {
    const res = await fetch(`${url}/turns`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ project: "flux", sessionId: null, text: "run the tests" }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { sessionId: "s1", spoken: "Tests pass.", denied: [] });
    assert.deepEqual(seen, { cwd: "/src/flux", sessionId: null, text: "run the tests" });
  });
});

test("an unknown project is a 404 the phone can speak", async () => {
  await withServer(neverRuns, async (url) => {
    const res = await fetch(`${url}/turns`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ project: "nope", sessionId: null, text: "hi" }),
    });
    assert.equal(res.status, 404);
    assert.match(((await res.json()) as { spoken: string }).spoken, /nope/);
  });
});

test("empty text is refused", async () => {
  await withServer(neverRuns, async (url) => {
    const res = await fetch(`${url}/turns`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ project: "flux", sessionId: null, text: "  " }),
    });
    assert.equal(res.status, 400);
  });
});

test("a failed run is a 500 carrying the reason", async () => {
  const runTurn: RunTurn = () => Promise.reject(new TurnFailed("Failed to authenticate."));
  await withServer(runTurn, async (url) => {
    const res = await fetch(`${url}/turns`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ project: "flux", sessionId: "s1", text: "hi" }),
    });
    assert.equal(res.status, 500);
    assert.match(((await res.json()) as { spoken: string }).spoken, /authenticate/);
  });
});

test("the server does not time out long turns", () => {
  assert.equal(createVoiceServer(config, neverRuns).requestTimeout, 0);
});
