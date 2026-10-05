import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeArgs, parseResult, runTurn, TurnFailed } from "../src/turn.ts";

test("resumes a named session", () => {
  const args = claudeArgs({ cwd: "/x", sessionId: "abc", text: "hello" });
  assert.deepEqual(args.slice(0, 4), ["-p", "hello", "--resume", "abc"]);
  assert.ok(args.includes("--permission-prompts"));
  assert.equal(args[args.indexOf("--permission-prompts") + 1], "none");
});

test("continues the latest session when none is named", () => {
  const args = claudeArgs({ cwd: "/x", sessionId: null, text: "hello" });
  assert.ok(args.includes("--continue"));
  assert.ok(!args.includes("--resume"));
});

test("parses a successful result with denials", () => {
  const out = JSON.stringify({
    type: "result",
    session_id: "s1",
    result: "Done.",
    is_error: false,
    permission_denials: [{ tool_name: "Bash" }],
  });
  assert.deepEqual(parseResult(out), { sessionId: "s1", spoken: "Done.", denied: ["Bash"] });
});

test("an error result becomes TurnFailed carrying Claude's message", () => {
  const out = JSON.stringify({ session_id: "s1", is_error: true, result: "Failed to authenticate." });
  assert.throws(() => parseResult(out), (e) => e instanceof TurnFailed && /authenticate/.test(e.message));
});

test("non-JSON output becomes TurnFailed", () => {
  assert.throws(() => parseResult("boom"), TurnFailed);
});

test("runTurn runs the binary in the project directory", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vtv-turn-"));
  const fake = join(dir, "claude");
  writeFileSync(
    fake,
    `#!/bin/sh\npwd > "${dir}/cwd"\nprintf '%s\\n' "$@" > "${dir}/args"\n` +
      `echo '{"session_id":"s9","result":"All good.","is_error":false,"permission_denials":[]}'\n`,
  );
  chmodSync(fake, 0o755);
  const result = await runTurn({ cwd: dir, sessionId: null, text: "status" }, fake);
  assert.deepEqual(result, { sessionId: "s9", spoken: "All good.", denied: [] });
  assert.match(readFileSync(join(dir, "cwd"), "utf8"), /vtv-turn-/);
  assert.match(readFileSync(join(dir, "args"), "utf8"), /^-p\nstatus\n--continue\n/);
});

test("runTurn rejects when the binary is missing", async () => {
  await assert.rejects(runTurn({ cwd: tmpdir(), sessionId: null, text: "x" }, "/nonexistent/claude"), TurnFailed);
});
