#!/usr/bin/env bash
# Blocks any edit to the frozen Gemini settings files unless Nik unlocks them.
# Unlock:  touch .claude/gemini-unlock      Re-lock: rm .claude/gemini-unlock
set -u
payload=$(cat)
[ -f "$CLAUDE_PROJECT_DIR/.claude/gemini-unlock" ] && exit 0

protected='utils/openai\.js|utils/pricing\.js|utils/key-manager\.js|utils/ai-meter\.js'
# only commands that actually write count; merely naming a file (grep, cat, git commit) does not
mutators='>|sed -i|tee |cp |mv |rm |truncate|patch |perl -i|python3? -'

parsed=$(printf '%s' "$payload" | python3 -c '
import json,sys
d=json.loads(sys.stdin.read())
i=d.get("tool_input",{})
print(d.get("tool_name",""))
print(i.get("file_path","") or i.get("notebook_path","") or i.get("command",""))
' 2>/dev/null)

tool=$(printf '%s' "$parsed" | head -1)
arg=$(printf '%s' "$parsed" | tail -n +2)

printf '%s' "$arg" | grep -Eq "$protected" || exit 0
if [ "$tool" = "Bash" ]; then
  printf '%s' "$arg" | grep -Eq "$mutators" || exit 0
fi

echo "BLOCKED: Gemini settings are frozen (see the FROZEN section of CLAUDE.md). Ask Nik; he unlocks with: touch .claude/gemini-unlock" >&2
exit 2
