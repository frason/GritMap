# Agent handoffs

`LATEST.md` is the single entry point for current cross-agent context. The user can tell
Claude or Codex **"check the latest"** and the root agent instruction file directs that
agent here.

After a meaningful milestone:

1. Copy the completed handoff into `archive/YYYY-MM-DD-HHMM-agent-topic.md`.
2. Replace `LATEST.md` with the same content.
3. Keep both concise and evidence-based using `TEMPLATE.md`.
4. Commit the handoff with the implementation when practical. If implementation is still
   uncommitted, state that explicitly and list the affected paths.

The timestamp uses local repository time and a 24-hour clock. The archive is a historical
record and must not be edited after creation. Git remains the source of truth for code;
handoffs explain state that cannot be inferred safely from a diff alone.
