import { spawn } from "node:child_process";

export interface TurnRequest {
  cwd: string;
  sessionId: string | null;
  text: string;
}

export interface TurnResult {
  sessionId: string;
  spoken: string;
  denied: string[];
}

export class TurnFailed extends Error {}

export const spokenReplyInstruction =
  "Your reply will be read aloud to someone who cannot see a screen. " +
  "Use at most three short sentences. Speak no code, paths or tables. " +
  "Say what changed and what waits on them.";

export function claudeArgs(req: TurnRequest): string[] {
  return [
    "-p",
    req.text,
    ...(req.sessionId ? ["--resume", req.sessionId] : ["--continue"]),
    "--output-format",
    "json",
    // Nobody can answer a permission prompt mid-turn; the phone reports each denial.
    "--permission-prompts",
    "none",
    "--append-system-prompt",
    spokenReplyInstruction,
  ];
}

interface ResultMessage {
  session_id?: string;
  result?: string;
  is_error?: boolean;
  permission_denials?: { tool_name?: string }[];
}

export function parseResult(stdout: string): TurnResult {
  let msg: ResultMessage;
  try {
    msg = JSON.parse(stdout) as ResultMessage;
  } catch {
    throw new TurnFailed("Claude Code returned output that is not JSON.");
  }
  if (msg.is_error || typeof msg.session_id !== "string") {
    throw new TurnFailed(msg.result ?? "Claude Code reported an error.");
  }
  return {
    sessionId: msg.session_id,
    spoken: msg.result ?? "",
    denied: (msg.permission_denials ?? []).map((d) => d.tool_name ?? "an unnamed tool"),
  };
}

export function runTurn(req: TurnRequest, claudeBin = "claude"): Promise<TurnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin, claudeArgs(req), { cwd: req.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => reject(new TurnFailed(`Could not start Claude Code: ${e.message}`)));
    child.on("close", () => {
      try {
        resolve(parseResult(stdout));
      } catch (e) {
        reject(e instanceof TurnFailed && stderr ? new TurnFailed(`${e.message} ${stderr.trim()}`) : e);
      }
    });
  });
}
