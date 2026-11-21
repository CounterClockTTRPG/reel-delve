# reel-delve

Reel's adapter for Delve. The backlog is Reel's Tasker project, **REEL** (http://localhost:7778; read
`curl -s http://localhost:7778/api/guide` once per session). The design is in
`~/claude/reel/docs/superpowers/specs/2026-11-21-delve-adapter-design.md`.

- Never write to the owner's Delve (port 7810, `~/.local/share/delve`): seeding only reads it.
- Delve isn't changed from here: a missing `data-testid` goes to Delve's backlog (DEL).
- Tests run against Delve's fake play server (no real `claude`, no money); never against 7810.
