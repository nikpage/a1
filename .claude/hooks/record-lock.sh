#!/usr/bin/env bash
# RULE 1 — Nik's stored record is READ-ONLY to any session.
#
# On 24 August 2026 a session built a tool that wrote into cv_data.master_cv,
# put 25 invented lines in it, ran the letter pipeline against them, and a later
# session the same day deleted all 25 as fabrication. Four and a half hours, two
# commits, and the record came out smaller than it went in.
#
# Nothing a session runs may write to that record again. Nik edits it in the app.
# Reads are untouched — this blocks writes only.
#
# Unlock:  touch .claude/record-unlock      Re-lock: rm .claude/record-unlock
set -u
payload=$(cat)
[ -f "$CLAUDE_PROJECT_DIR/.claude/record-unlock" ] && exit 0

parsed=$(printf '%s' "$payload" | python3 -c '
import json,sys
d=json.loads(sys.stdin.read())
i=d.get("tool_input",{})
print(d.get("tool_name",""))
# everything this tool call would put on disk or run, as one blob
print(" ".join(str(i.get(k,"")) for k in
      ("command","file_path","notebook_path","content","new_string")))
' 2>/dev/null)

tool=$(printf '%s' "$parsed" | head -1)
blob=$(printf '%s' "$parsed" | tail -n +2)

# The two ways a session can write the record: the helper, or Supabase directly.
writers='saveMasterCv|saveVoiceProfile|update-master'
direct='from\(.cv_data.\)[^)]*\)\s*\.\s*(update|upsert|insert|delete)|from\(.cv_data.\).{0,120}(update|upsert|insert|delete)\('

if printf '%s' "$blob" | grep -Eq "$writers" || printf '%s' "$blob" | grep -Eqz "$direct"; then
  case "$tool" in
    Bash)
      # Naming the helper in a grep or a cat is not a write; running it is.
      printf '%s' "$blob" | grep -Eq '(^|[;&|[:space:]])(node|npx|npm|tsx)[[:space:]]' || exit 0
      ;;
  esac
  echo "BLOCKED (rule 1): Nik's stored record is read-only to sessions. Reads are fine; writes are not — he edits it in the app. If he has told you to write it in this session, he unlocks with: touch .claude/record-unlock" >&2
  exit 2
fi

exit 0
