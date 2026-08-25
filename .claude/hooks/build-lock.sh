#!/usr/bin/env bash
# RULE 1 — nothing gets built that Nik did not name.
#
# Written 2026-08-25, after a session that: designed a new record field he never
# asked for, wrote a file of his career notes into the repo instead of the DB,
# proposed restoring 25 lines he had not requested, and started editing the CV
# rules to "prove" it could work. Every one of those was the session acting on
# its own judgement while he was asking it to stop. Hours of his life, no output.
#
# The rule cannot live in prose: it is exactly the rule a session breaks while
# believing it is being helpful. So the build surfaces are locked. Nik opens
# them for the thing he just named, and they close again by themselves.
#
#   Open:   touch .claude/build-ok        (expires by itself after 3 hours)
#   Close:  delete .claude/build-ok
#
# What is NOT locked: reading anything, running tests, scratch files, docs,
# runs/, and the notes a session writes to think with. Only the product's own
# source is behind the gate.
set -u
payload=$(cat)

parsed=$(printf '%s' "$payload" | python3 -c '
import json,sys
d=json.loads(sys.stdin.read())
i=d.get("tool_input",{})
print(d.get("tool_name",""))
print(" ".join(str(i.get(k,"")) for k in ("file_path","notebook_path","command")))
' 2>/dev/null)

tool=$(printf '%s' "$parsed" | head -1)
blob=$(printf '%s' "$parsed" | tail -n +2)

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# An open gate older than three hours is a gate somebody forgot to close, not
# permission for whatever the session thought of next.
if [ -f .claude/build-ok ]; then
  age=$(( $(date +%s) - $(stat -c %Y .claude/build-ok 2>/dev/null || echo 0) ))
  if [ "$age" -lt 10800 ]; then exit 0; fi
  unlink .claude/build-ok 2>/dev/null
fi

# The product's own source. Docs, tests, runs/ and scratch are not on this list:
# a session that wants to write down what it found is not the failure mode.
guarded='(^|[^a-zA-Z0-9_.-])(prompts|utils|pages|components|lib|hooks|locales)/[a-zA-Z0-9_.-]+\.(js|jsx|mjs|json)'

case "$tool" in
  Edit|Write|NotebookEdit)
    printf '%s' "$blob" | grep -Eq "$guarded" || exit 0
    ;;
  Bash)
    # Only a command that WRITES to guarded source counts. Reading it is free.
    printf '%s' "$blob" | grep -Eq "$guarded" || exit 0
    printf '%s' "$blob" | grep -Eq '(>|>>|sed -i|tee|mv |cp |patch|python3?[[:space:]]+-|node[[:space:]]+-e)' || exit 0
    ;;
  *) exit 0 ;;
esac

echo "BLOCKED (rule 1): Nik did not name this build. Tell him in one line what you propose to change and why, and stop. If he wants it, he opens the gate with: touch .claude/build-ok" >&2
exit 2
