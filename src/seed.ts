// Seeding a separate Delve to film (`reel app seed delve`): the packs from their source folders (with the app stopped,
// through Delve's own CLI), a demo owner account (Delve's first-owner API, its password kept in the vault, its
// session saved for `auth: login`), and the modules the films show, copied from the owner's real Delve as .dscn
// exports. The real Delve is only ever read: GET /api/modules and GET /api/modules/<id>/export.dscn.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SeedContext } from "reel/adapter";
import { z } from "zod";

export const SeedOptions = z.object({
  from: z.object({ base: z.string().url(), token_file: z.string() }).strict(),
  packs: z.array(z.string()).default([]),
  owner: z.object({ username: z.string().min(3), display_name: z.string().optional() }).strict(),
  modules: z.array(z.string()).default([]),
}).strict();
export type SeedOptions = z.infer<typeof SeedOptions>;

const home = (p: string) => (p.startsWith("~") ? join(homedir(), p.slice(1)) : p);
const port = (base: string) => new URL(base).port || (new URL(base).protocol === "https:" ? "443" : "80");

interface ModuleRow {
  id: string;
  title: string;
}

const listOf = (body: unknown): ModuleRow[] => (Array.isArray(body) ? body : ((body as { modules?: ModuleRow[] }).modules ?? []));

/** The modules of the real Delve (read only), with its token from its file. */
async function realModules(o: SeedOptions, token: string): Promise<ModuleRow[]> {
  const res = await fetch(new URL("/api/modules", o.from.base), { headers: { authorization: `Bearer ${token}` } }).catch((e) => {
    throw new Error(`the real Delve at ${o.from.base} can't be reached: ${(e as Error).message}`);
  });
  if (!res.ok) throw new Error(`the real Delve's modules (${o.from.base}): ${res.status}`);
  return listOf(await res.json());
}

function closest(title: string, titles: string[]): string[] {
  const words = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return titles.filter((t) => words.some((w) => t.toLowerCase().includes(w))).slice(0, 5);
}

/**
 * That the Delve answering on ctx.base keeps its data in ctx.data: its owner token (data/token) opens its API. Checked
 * before anything is written, so a mistaken serve.env never seeds some other Delve's data.
 */
async function checkData(ctx: SeedContext): Promise<void> {
  const file = join(ctx.data, "token");
  const token = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
  const res = token ? await fetch(new URL("/api/modules", ctx.base), { headers: { authorization: `Bearer ${token}` } }).catch(() => null) : null;
  if (!res?.ok) throw new Error(`${ctx.data} isn't the data of the Delve on ${ctx.base} (its token doesn't open it): check app.serve.env's DELVE_DATA_DIR`);
}

export async function seed(ctx: SeedContext): Promise<void> {
  const o = SeedOptions.parse((ctx.options as { seed?: unknown }).seed ?? (() => {
    throw new Error("adapter_options.seed is missing in project.yaml (from, packs, owner, modules)");
  })());
  if (port(o.from.base) === port(ctx.base) && new URL(o.from.base).hostname === new URL(ctx.base).hostname) {
    throw new Error(`the Delve to seed (${ctx.base}) is the one to copy from: seeding never writes to the real Delve`);
  }
  if (port(ctx.base) === "7810") throw new Error("port 7810 is the owner's real Delve: the separate Delve runs elsewhere");
  const real = (p: string) => (existsSync(p) ? realpathSync(p) : p);
  if (real(ctx.data) === real(home("~/.local/share/delve")) || real(ctx.data) === real(process.env.DELVE_DATA_DIR ?? "~")) {
    throw new Error(`the data folder ${ctx.data} is the owner's own Delve data: seeding never writes there`);
  }
  const env = { DELVE_DATA_DIR: ctx.data };
  await checkData(ctx);

  // 1. Packs, with Delve stopped: `delve pack install` writes into the data folder.
  if (o.packs.length) {
    await ctx.stopApp();
    for (const pack of o.packs) {
      ctx.log(`  pack ${pack}`);
      await ctx.run("uv", ["run", "delve", "pack", "install", home(pack)], { env });
    }
    await ctx.startApp();
    await checkData(ctx);
  }

  // 2. The demo owner: made the first time, logged in later; its session is what recordings use.
  const key = `owner.${o.owner.username}`;
  let password = ctx.secrets.get(key);
  const made = password ? null : await ctx.api.post("/api/accounts/first-owner", {
    data: { username: o.owner.username, password: (password = randomBytes(15).toString("base64url")), display_name: o.owner.display_name ?? o.owner.username },
  });
  if (made && made.ok()) {
    ctx.secrets.set(key, password!);
    ctx.log(`  made the owner ${o.owner.username}`);
  } else {
    if (made) throw new Error(`making the owner ${o.owner.username}: ${made.status()} ${(await made.text()).slice(0, 200)} (an owner exists without a kept password: reel app reset delve)`);
    const login = await ctx.api.post("/api/login", { data: { username: o.owner.username, password } });
    if (!login.ok()) throw new Error(`logging in the owner ${o.owner.username}: ${login.status()} (reel app reset delve starts over)`);
    ctx.log(`  logged in as ${o.owner.username}`);
  }
  ctx.saveLogin(await ctx.api.storageState());

  // 3. The modules, from the real Delve (read only), unless they are here already.
  if (o.modules.length) {
    const token = readFileSync(home(o.from.token_file), "utf8").trim();
    const theirs = await realModules(o, token);
    const here = listOf(await (await ctx.api.get("/api/modules")).json());
    const failed: string[] = [];
    for (const title of o.modules) {
      const found = theirs.find((m) => m.title.toLowerCase() === title.toLowerCase());
      if (!found) {
        const near = closest(title, theirs.map((m) => m.title));
        throw new Error(`no module "${title}" in the real Delve${near.length ? `; close: ${near.join(", ")}` : ""}`);
      }
      if (here.some((m) => m.title.toLowerCase() === title.toLowerCase())) {
        ctx.log(`  module ${found.title}: here already`);
        continue;
      }
      const exported = await fetch(new URL(`/api/modules/${found.id}/export.dscn`, o.from.base), { headers: { authorization: `Bearer ${token}` } });
      if (!exported.ok) {
        // A module the real Delve can't export (its own data is broken) is reported, and the others still come.
        failed.push(`"${found.title}" doesn't export from the real Delve: ${exported.status} ${(await exported.text()).slice(0, 200)}`);
        continue;
      }
      const bundle = Buffer.from(await exported.arrayBuffer());
      const imported = await ctx.api.post("/api/modules/import", { data: bundle, headers: { "content-type": "application/zip" } });
      if (!imported.ok()) {
        failed.push(`"${found.title}" doesn't import: ${imported.status()} ${(await imported.text()).slice(0, 300)}`);
        continue;
      }
      ctx.log(`  module ${found.title}: imported (${(bundle.length / 1e6).toFixed(1)} MB)`);
    }
    if (failed.length) throw new Error(`${failed.length} of ${o.modules.length} modules didn't come over:\n  ${failed.join("\n  ")}`);
  }
}
