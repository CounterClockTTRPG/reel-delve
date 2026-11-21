# reel-delve

[Reel](https://github.com/CounterClockTTRPG/reel)'s adapter for Delve. It gives films Delve's own steps:

- wait for the DM, act, ask a rules question;
- make or open a campaign;
- seat other players, and make characters;
- switch the language or the portrait painter (and put it back);
- zoom the world map, and hover a map room.

It also seeds a separate Delve for filming: the packs, a demo owner, and the modules the films show, copied
read-only from your own Delve.

The design is in Reel's `docs/superpowers/specs/2026-11-21-delve-adapter-design.md`.

## Use

In the studio's `projects/delve/project.yaml`:

```yaml
adapter: ~/claude/reel-delve        # built: npm ci && npm run build
app:
  auth: login
  serve:
    command: [uv, run, delve, serve, --port, "{port}", --host, 127.0.0.1]
    cwd: ~/claude/refactoring
    port: 7820
    env: { DELVE_DATA_DIR: "{data}" }
    ready: /api/modules
adapter_options:
  seed:
    from: { base: http://127.0.0.1:7810, token_file: ~/.local/share/delve/token }   # read only
    packs: [~/claude/refactoring/packs/srd35, ~/claude/refactoring/packs/osric, ~/claude/delve-packs/greyhawk]
    owner: { username: demo, display_name: The host }
    modules: [The Sunless Citadel]
```

`reel app seed delve` fills the separate Delve, and `reel record delve/<mission>` films it.

## Test

`npm test` builds the adapter and runs its steps against Delve's own fake play server (`tests.e2e.fake_play_server`
in the Delve checkout at `DELVE_REPO`, default `~/claude/refactoring`). The DM there is a fake `claude`, so the tests
spend nothing. Ports 47900–47999.
