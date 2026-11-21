// Seeding, with two fake Delves: 47910 stands in for the owner's real Delve (copied from, read only), 47911 is the
// separate one being seeded.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { request } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SeedContext } from "reel/adapter";
import { secretsFor } from "reel/lib/adapter/secrets";
import { run } from "reel/lib/util/proc";
import adapter from "../src/index.js";
import { DELVE_REPO, startFakeDelve, type FakeDelve } from "./helpers/delve.js";
import { tmp } from "./helpers/reel.js";

let source: FakeDelve;
let demo: FakeDelve;

function find(dir: string, name: string): string | null {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === name) return p;
    if (statSync(p).isDirectory()) {
      const hit = find(p, name);
      if (hit) return hit;
    }
  }
  return null;
}

async function context(modules: string[], saved: unknown[]): Promise<SeedContext> {
  const tokenFile = find("/tmp/delve-e2e-browser-47910", "token");
  if (!tokenFile) throw new Error("the source fake has no token file");
  const dbDir = find("/tmp/delve-e2e-browser-47911", "delve.db")!.replace(/\/delve\.db$/, "");
  const api = await request.newContext({ baseURL: demo.base });
  return {
    project: "delve",
    base: demo.base,
    data: dbDir,
    api,
    options: { seed: { from: { base: source.base, token_file: tokenFile }, packs: [join(DELVE_REPO, "packs", "osric")], owner: { username: "demo", display_name: "The host" }, modules } },
    secrets: secretsFor("delve"),
    log: () => {},
    run: (cmd, args) => run(cmd, args, { cwd: DELVE_REPO, env: { ...process.env, DELVE_DATA_DIR: dbDir } }),
    stopApp: async () => {},
    startApp: async () => {},
    saveLogin: (s) => saved.push(s),
  };
}

const titles = async (base: string) => {
  // Once it has an owner, a Delve answers only a login or its token, even from this machine.
  const { readFileSync } = await import("node:fs");
  const root = `/tmp/delve-e2e-browser-${new URL(base).port}`;
  const token = readFileSync(find(root, "token")!, "utf8").trim();
  const body = await (await fetch(`${base}/api/modules`, { headers: { authorization: `Bearer ${token}` } })).json();
  return (Array.isArray(body) ? body : body.modules).map((m: { title: string }) => m.title);
};

beforeAll(async () => {
  process.env.REEL_DATA = tmp();
  [source, demo] = await Promise.all([startFakeDelve(47910), startFakeDelve(47911)]);
  const made = await fetch(`${source.base}/api/modules`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Reel Seed Test" }) });
  expect(made.status).toBe(201);
});
afterAll(async () => {
  await source?.stop();
  await demo?.stop();
});

describe("seeding a separate Delve", () => {
  it("installs the packs, makes the owner, and copies the modules", async () => {
    const saved: unknown[] = [];
    await adapter.seed!(await context(["Reel Seed Test"], saved));
    expect(await titles(demo.base)).toContain("Reel Seed Test");
    expect(secretsFor("delve").get("owner.demo")).toBeTruthy();
    expect(JSON.stringify(saved[0])).toContain("cookies");
  });

  it("skips what is there already and logs the owner in, when seeded again", async () => {
    const saved: unknown[] = [];
    await adapter.seed!(await context(["Reel Seed Test"], saved));
    expect((await titles(demo.base)).filter((t: string) => t === "Reel Seed Test")).toHaveLength(1);
    expect(saved).toHaveLength(1);
  });

  it("fails on a module the real Delve doesn't have, naming close ones", async () => {
    await expect(adapter.seed!(await context(["Reel Seed Tset"], []))).rejects.toThrow(/no module "Reel Seed Tset".*close: Reel Seed Test/);
  });
});
