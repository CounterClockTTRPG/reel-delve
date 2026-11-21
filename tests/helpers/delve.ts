// A fake Delve for the tests: Delve's own fake play server (a fresh data folder, the Crypt of Saint Vellis module with
// a campaign, and a fake `claude` as the DM), from the Delve checkout at DELVE_REPO.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export const DELVE_REPO = process.env.DELVE_REPO ?? join(homedir(), "claude", "refactoring");

export interface FakeDelve {
  base: string;
  port: number;
  stop(): Promise<void>;
}

export async function startFakeDelve(port: number): Promise<FakeDelve> {
  if (port === 7810) throw new Error("7810 is the owner's Delve");
  const base = `http://127.0.0.1:${port}`;
  const child = spawn("uv", ["run", "python", "-m", "tests.e2e.fake_play_server", "--port", String(port)], {
    cwd: DELVE_REPO,
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let errors = "";
  child.stderr?.on("data", (d) => (errors = (errors + d).slice(-4000)));
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`the fake Delve exited (${child.exitCode}): ${errors}`);
    const up = await fetch(`${base}/api/modules`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false);
    if (up) break;
    await new Promise((d) => setTimeout(d, 500));
  }
  return {
    base,
    port,
    async stop() {
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {}
      await new Promise((d) => setTimeout(d, 500));
    },
  };
}

export async function campaigns(base: string): Promise<{ id: string; name?: string; title?: string; module_title?: string }[]> {
  const res = await fetch(`${base}/api/campaigns`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body.campaigns ?? []);
}
