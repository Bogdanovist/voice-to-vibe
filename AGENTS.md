# voice-to-vibe

voice-to-vibe is a harness for steering Claude Code sessions by voice alone,
from an Android phone over Bluetooth audio. It is for Matt's personal use,
in the car or with headphones on, where he cannot look at or touch the phone.

The harness has two parts: `server/`, a Node server on the Mac that runs
each spoken turn through `claude -p`, and an Expo Android app. Work in
progress and how to resume it: `context/projects/voice-steering-mvp/plan.md`
§Where it stands.

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

To run one real turn through the server, from your own terminal, write the
config once:

```bash
mkdir -p ~/.config/voice-to-vibe && cat > ~/.config/voice-to-vibe/config.json <<EOF
{ "host": "$(tailscale ip -4)", "port": 5180, "token": "$(openssl rand -hex 32)",
  "projects": [ { "name": "voice-to-vibe", "path": "$HOME/src/personal/voice-to-vibe" } ] }
EOF
```

Start the server with `npm install && npm start` from `server/`, then send a
turn from a second terminal:

```bash
TOKEN=$(node -p 'require(process.env.HOME+"/.config/voice-to-vibe/config.json").token')
curl -s -H "Authorization: Bearer $TOKEN" \
  -d '{"project":"voice-to-vibe","sessionId":null,"text":"What is this repo for?"}' \
  http://$(tailscale ip -4):5180/turns
```

The reply is JSON with `sessionId`, a short `spoken` reply and `denied`.

The Android app builds with the JDK and SDK that `~/.zshrc` names:
`JAVA_HOME` from `/usr/libexec/java_home -v 17`, and `ANDROID_HOME` at
`/opt/homebrew/share/android-commandlinetools`. Inside the agent sandbox
`java_home` cannot find the JDK, so set
`JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home`
explicitly.
