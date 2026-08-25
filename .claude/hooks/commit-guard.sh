#!/usr/bin/env bash
# RULES 4 and 5 — what a commit in this repo must carry, and what it may not do.
#
# RULE 4: a commit that touches prompts/ also updates COVER_LETTER_LOG.md.
# The log's own rule is that every real run gets an entry. It has eight entries
# and stops on 16 August 2026; nine days of paid runs followed and not one was
# written down, because nothing stopped the rule dying. Now something does.
#
# RULE 5: things survive by default. A commit that deletes a tracked file, or
# strips lines out of the prompts, the rules or the record, needs Nik's yes in
# this session.
#
# Unlock deletions:  touch .claude/delete-unlock     Re-lock: rm .claude/delete-unlock
set -u
payload=$(cat)

cmd=$(printf '%s' "$payload" | python3 -c '
import json,sys
d=json.loads(sys.stdin.read())
print(d.get("tool_input",{}).get("command",""))
' 2>/dev/null)

printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+commit' || exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# `git commit -a` stages tracked changes at commit time, so judge those too.
if printf '%s' "$cmd" | grep -Eq '[[:space:]]-[a-zA-Z]*a'; then
  staged=$(git diff --name-only HEAD)
  numstat=$(git diff --numstat HEAD)
  deleted=$(git diff --name-only --diff-filter=D HEAD)
else
  staged=$(git diff --cached --name-only)
  numstat=$(git diff --cached --numstat)
  deleted=$(git diff --cached --name-only --diff-filter=D)
fi
[ -n "$staged" ] || exit 0

# ---- rule 4: a prompt change ships with the log --------------------------
if printf '%s\n' "$staged" | grep -Eq '^prompts/'; then
  if ! printf '%s\n' "$staged" | grep -qx 'COVER_LETTER_LOG.md'; then
    echo "BLOCKED (rule 4): this commit changes prompts/ but not COVER_LETTER_LOG.md. A prompt change is only real once it has been RUN against the baseline and the output read. Write the entry — what was tried, what it did to the document, kept or dead — and stage it with the change." >&2
    exit 2
  fi
fi

# ---- rule 5: deletions need Nik's yes ------------------------------------
if [ ! -f .claude/delete-unlock ]; then
  if [ -n "$deleted" ]; then
    echo "BLOCKED (rule 5): this commit deletes $(printf '%s\n' "$deleted" | tr '\n' ' '). Things survive by default. Ask Nik; he unlocks with: touch .claude/delete-unlock" >&2
    exit 2
  fi

  # Lines cut out of the product IP. Ten is the line between an edit and a purge.
  cut=$(printf '%s\n' "$numstat" | awk '$3 ~ /^(prompts\/|utils\/|CV_RULES\.md|CLAUDE\.md|PRODUCT\.md)/ {d += $2} END {print d+0}')
  if [ "$cut" -gt 10 ]; then
    echo "BLOCKED (rule 5): this commit removes $cut lines from the prompts, the rules or the docs. Every rule and exemplar in this repo was written after something went wrong, and a session that cannot see why it exists is the wrong judge of whether it should go. Name what you are cutting and why, and ask Nik; he unlocks with: touch .claude/delete-unlock" >&2
    exit 2
  fi
fi

exit 0
