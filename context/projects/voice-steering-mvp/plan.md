---
started: 2026-09-26
---

## Why

I want to steer my Claude Code sessions by voice while I drive or do the
washing, with the phone in a pocket or a mount and the screen off. Today
that time is lost to my projects. The exploration
(`context/projects/v2v-exploration/findings.md`) found no existing tool that
does this from an Android phone, so I build one.

The first slice proves the loop end to end at home: I say a prompt, a real
session on my Mac runs it, and I hear what happened. Approvals,
interrupting and the car come in the slices after it.

## Decisions (Matt, 2026-09-25/26)

- **D1 — Hand-off sessions.** The harness drives a real Claude Code session
  on my Mac. I resume that session at the desk afterwards with my hooks,
  skills and permissions intact. The phone and the terminal never drive the
  same session at once.
- **D2 — OPEN: what runs the session on the Mac.** See §Open decisions.
- **D3 — Network.** The phone reaches the Mac at `matt-human`, the Mac's
  Tailscale name, which the phone already uses for web prototypes (Flux
  `phone-prototype` skill). The first slice is tested on home Wi-Fi.
- **D4 — Speech on the phone.** Voice mode uses Android's own on-device
  `SpeechRecognizer` and `TextToSpeech`. A cloud service replaces them only
  if the washing test shows they cannot cope. Superwhisper dictation serves
  the text fields on the setup screen, with no integration work.
- **D5 — Native Android app built with Expo.** A browser page loses the
  microphone when the screen locks (findings §Q2). The app is a development
  build, not Expo Go.

## Open decisions

Each needs Matt's answer before the slice that depends on it starts.

**D2 — `claude -p` or the Agent SDK.** The Mac server starts one Claude
Code run per spoken turn.

- *`claude -p` (recommended).* Without `--bare`, `claude -p` loads the same
  context as an interactive session and uses my claude.ai subscription
  login (code.claude.com/docs/en/headless). Turns cost what desk turns
  cost. The server parses newline-delimited JSON from stdout.
  `--permission-prompt-tool` gives spoken approvals a documented hook.
- *Agent SDK.* Cleaner objects, and `canUseTool` for approvals. Its
  overview says third-party developers may not offer claude.ai login and
  should use API keys (code.claude.com/docs/en/agent-sdk/overview). On an
  API key every voice turn is billed at API rates on top of the
  subscription.

**D6 — What counts as a prompt.** With the microphone open, a washing
machine, a radio or a passenger produces text. Something must stop stray
text from reaching the session as a prompt.

- *Read back and confirm (recommended).* After I stop talking, the harness
  says "Send: <what it heard>?" and sends only on "send". It costs one short
  exchange per turn. The same exchange later carries spoken approvals.
- *Send every utterance.* Fastest. A misheard or overheard sentence runs.
- *Headset button to talk.* No false prompts. It needs a button press, and
  car head units pass media buttons through unevenly.

**D7 — How the Android app gets built.** This Mac has no Android SDK
(findings §Existing projects evaluated).

- *Local Android SDK (recommended).* I install the Android command-line
  tools and a JDK myself; the agent sandbox cannot write to their install
  paths. Builds run on the Mac and install over USB or Wi-Fi with `adb`.
  No account, fast rebuilds.
- *EAS cloud builds.* Needs an Expo account and the `eas` CLI. Each native
  change waits for a cloud build.

## Approach

`voice-to-vibe` holds two parts: `app/`, the Expo Android app, and
`server/`, a small Node server on the Mac.

### The Mac server

- Listens on the Mac's Tailscale address only, and requires a bearer token
  that lives in a file outside the repo. Anyone who reaches it can run
  Claude Code as me, so both limits are the minimum.
- Serves a list of projects from a config file: a name and a checkout path
  for each.
- Runs each turn as one Claude Code run in the project's checkout: resume
  the session by id, or continue the most recent session in that checkout.
  `--continue` skips a session that is still running (docs, v2.1.257+).
- Denies anything that would need a permission prompt, with
  `--permission-prompts none` (v2.1.259+), and tells me by voice what it
  refused. My own permission rules and mode decide everything else.
  Spoken approvals replace this in the second slice.
- Adds one instruction for the run with `--append-system-prompt`: the reply
  will be heard, so keep it short, speak no code, and say what changed and
  what waits on me. I ask for detail by asking the session, as I would at
  the desk. No second model condenses the output.

### The message format (for review: this is the phone–Mac contract)

Plain HTTP with JSON bodies. A turn's request stays open until the run
ends; the phone plays a short "working" tone meanwhile.

- `GET /projects` → `[{ "name": string }]`
- `POST /turns` with `{ "project": string, "sessionId": string | null,
  "text": string }` → `{ "sessionId": string, "spoken": string,
  "denied": [string] }`. `sessionId: null` continues the most recent
  session in the project. `denied` names each refused tool call.
- Errors: `401` for a bad token, `404` for an unknown project, `409` when
  the session is running elsewhere, `500` with `{ "spoken": string }` for a
  failed run, so the phone always has something to say.

A held request carries no mid-turn events. Spoken approvals need them, so
the second slice replaces this with a WebSocket. The first slice keeps HTTP
because nothing in it talks mid-turn.

### The phone app

- **Setup screen.** Server address and token, entered once. A project
  list. A button that starts voice mode.
- **Voice mode.** A foreground service of type `microphone` starts from the
  setup screen, as Android 14+ requires. It routes audio to the Bluetooth
  headset, listens with `SpeechRecognizer`, confirms per D6, sends the
  turn, and speaks the reply with `TextToSpeech`. Then it listens again.
  It is half-duplex: it does not listen while it speaks. A notification
  tap ends voice mode.

## Build order

1. **Probe P1 — the phone keeps listening.** A throwaway dev build with the
   foreground service, `SpeechRecognizer` and `TextToSpeech` over a
   Bluetooth headset. It echoes what it hears for 30 minutes with the
   screen off. It also settles where the voice loop's code must live: if
   React Native's JavaScript stops with the screen off, the loop moves into
   a Kotlin Expo module. Answers findings §Q2's open check.
2. **Probe P2 — the Mac side runs a turn.** From a script: continue a
   session I started at the desk, capture the reply and the refused tool
   calls, and confirm the run used my subscription login. Needs D2.
3. **Slice 1 — the washing test.** Server and app as above. Done when, with
   headphones on and the screen off, I pick a project, ask a question, hear
   a short answer, ask a follow-up in the same session, and afterwards see
   both turns at the desk with `claude --continue` in that checkout.

## Next slices (each gets its own plan section when it starts)

- Spoken approvals through `--permission-prompt-tool`, with an extra
  confirmation on risky steps.
- Interrupt: "stop" ends playback, and ends a running turn with SIGINT.
- The car: the Mac stays awake and online while I drive, and the phone
  reaches it over mobile data.

## Out of scope

- iOS, CarPlay and Android Auto.
- Driving a session the terminal is using at the same moment.
- Any hosted server or relay. The Mac is the only server.
