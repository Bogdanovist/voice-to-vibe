#!/usr/bin/env bash
# Probe P2: can a Mac server run voice turns through `claude -p`?
# Run from your own terminal (not an agent sandbox):
#   spike/claude-p-turn.sh <path-to-a-git-checkout-you-do-not-mind-probing>
# Writes raw output to /tmp/vtv-p2/. Uses a few small turns on your subscription.
set -uo pipefail
dir="${1:?usage: claude-p-turn.sh <checkout>}"
out=/tmp/vtv-p2
rm -rf "$out"; mkdir -p "$out"
cd "$dir"
claude --version > "$out/version.txt"

echo "1. new session, stream-json (shows auth source and message shapes)"
claude -p "What is two plus two? Answer in one word." \
  --output-format stream-json --verbose > "$out/1-new.jsonl" 2> "$out/1-new.err"
sid=$(grep '"type":"result"' "$out/1-new.jsonl" | sed -E 's/.*"session_id":"([^"]+)".*/\1/')
echo "   session: $sid"

echo "2. resume by id"
claude -p "What did I just ask you? One sentence." --resume "$sid" \
  --output-format json > "$out/2-resume.json" 2> "$out/2-resume.err"

echo "3. a call that needs a permission prompt, with prompts turned off"
claude -p "Run this exact shell command: touch /tmp/vtv-p2/denied-probe" --resume "$sid" \
  --permission-prompts none --output-format json > "$out/3-denied.json" 2> "$out/3-denied.err"
[ -e /tmp/vtv-p2/denied-probe ] && echo "   WARNING: the command ran" || echo "   command did not run"

echo "4. continue the most recent session in this checkout"
claude -p "Reply with the word continued." --continue \
  --output-format json > "$out/4-continue.json" 2> "$out/4-continue.err"

echo "5. two runs on one session at once"
claude -p "Run this exact shell command: sleep 20" --resume "$sid" \
  --allowedTools "Bash(sleep *)" --output-format json > "$out/5a-long.json" 2> "$out/5a-long.err" &
long=$!
sleep 8
claude -p "Reply with the word second." --resume "$sid" \
  --output-format json > "$out/5b-second.json" 2> "$out/5b-second.err"
echo "   second exit: $?"
claude -p "Reply with the word third." --continue \
  --output-format json > "$out/5c-continue.json" 2> "$out/5c-continue.err"
wait $long; echo "   long exit: $?"

echo "6. the appended instruction for spoken replies"
claude -p "Summarise what this repository is for." --resume "$sid" \
  --append-system-prompt "Your reply will be read aloud to someone who cannot see a screen. Use at most three short sentences. Speak no code, paths or tables. Say what changed and what waits on them." \
  --output-format json > "$out/6-spoken.json" 2> "$out/6-spoken.err"

echo "Done. Output in $out. Session $sid is in this checkout's history; delete it if you like."
