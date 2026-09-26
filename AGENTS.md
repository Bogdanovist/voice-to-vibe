# voice-to-vibe

voice-to-vibe is a harness for steering Claude Code sessions by voice alone,
from an Android phone over Bluetooth audio. It is for Matt's personal use,
in the car or with headphones on, where he cannot look at or touch the phone.

Nothing is built yet. The work is an open exploration of how the phone
connects to Claude Code, which platform carries the harness, and how speech,
turn-taking and approvals work.

Context: `context/index.md`.

## Commands

The Mac server (`server/`) needs Node 24 and has no runtime dependencies.

- `npm test` and `npm run typecheck`, from `server/`.
- `npm start`, from `server/`, reads `~/.config/voice-to-vibe/config.json`
  (or the path in `VTV_CONFIG`). Copy `server/config.example.json` there.
  `host` is the Mac's Tailscale IPv4 address (`tailscale ip -4`); the server
  refuses any other address, because whoever reaches it can run Claude Code
  as you. `token` is the phone's bearer token.
- Run the server from your own terminal. Inside the agent sandbox,
  `claude -p` cannot refresh the login token and every turn fails with a 401.
