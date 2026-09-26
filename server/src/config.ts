import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Project {
  name: string;
  path: string;
}

export interface Config {
  host: string;
  port: number;
  token: string;
  projects: Project[];
}

export const defaultConfigPath = join(homedir(), ".config", "voice-to-vibe", "config.json");

// Tailscale gives every device an address in 100.64.0.0/10. Anyone who reaches
// this server can run Claude Code as the Mac's user, so it binds nowhere else.
export function isTailscaleAddress(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

export function parseConfig(raw: string): Config {
  const c = JSON.parse(raw) as Partial<Config>;
  if (typeof c.host !== "string" || !isTailscaleAddress(c.host)) {
    throw new Error(`config.host must be this Mac's Tailscale IPv4 address (100.64.0.0/10), got ${c.host}`);
  }
  if (typeof c.port !== "number") throw new Error("config.port must be a number");
  if (typeof c.token !== "string" || c.token.length < 32) {
    throw new Error("config.token must be a string of at least 32 characters");
  }
  if (!Array.isArray(c.projects) || c.projects.length === 0) {
    throw new Error("config.projects must list at least one { name, path }");
  }
  for (const p of c.projects) {
    if (typeof p?.name !== "string" || typeof p?.path !== "string") {
      throw new Error("each project needs a string name and path");
    }
  }
  return c as Config;
}

export function loadConfig(path: string): Config {
  return parseConfig(readFileSync(path, "utf8"));
}
