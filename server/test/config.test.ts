import { test } from "node:test";
import assert from "node:assert/strict";
import { isTailscaleAddress, parseConfig } from "../src/config.ts";

const valid = { host: "100.101.102.103", port: 5180, token: "x".repeat(32), projects: [{ name: "flux", path: "/tmp" }] };

test("accepts only Tailscale IPv4 addresses", () => {
  assert.ok(isTailscaleAddress("100.64.0.1"));
  assert.ok(isTailscaleAddress("100.127.255.254"));
  for (const host of ["0.0.0.0", "127.0.0.1", "192.168.1.5", "100.63.0.1", "100.128.0.1", "matt-human", "::"]) {
    assert.equal(isTailscaleAddress(host), false, host);
  }
});

test("parses a valid config", () => {
  assert.deepEqual(parseConfig(JSON.stringify(valid)), valid);
});

test("refuses a LAN or wildcard host", () => {
  assert.throws(() => parseConfig(JSON.stringify({ ...valid, host: "0.0.0.0" })), /Tailscale/);
});

test("refuses a short token", () => {
  assert.throws(() => parseConfig(JSON.stringify({ ...valid, token: "short" })), /token/);
});

test("refuses an empty project list", () => {
  assert.throws(() => parseConfig(JSON.stringify({ ...valid, projects: [] })), /projects/);
});
