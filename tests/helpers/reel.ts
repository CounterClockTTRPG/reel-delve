// Recording a scene of a test script with Reel, against a fake Delve: a studio in a temp folder with project `delve`
// (the fake's address, this adapter by its built path), and a mission per call.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { loadMission, loadProject, loadStudio } from "reel/lib/model/load";
import { recordMission } from "reel/lib/record/recorder";
import { StateBag, stateFile } from "reel/lib/record/state";

const ROOT = join(import.meta.dirname, "..", "..");
const REEL = join(ROOT, "node_modules", "reel");

export function tmp(prefix = "reel-delve-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export interface TestStudio {
  dir: string;
  vault: string;
}

/** A studio for the fake Delve at `base`, with a vault of its own. */
export function testStudio(base: string, extra: Record<string, unknown> = {}): TestStudio {
  const root = tmp();
  const dir = join(root, "studio");
  cpSync(join(REEL, "templates", "studio"), dir, { recursive: true });
  writeFileSync(join(dir, "studio.yaml"), "music_root: ./music\nport: 7779\n");
  writeFileSync(join(dir, "library", "voices.yaml"), "voices:\n  tone: { provider: fake, model: tone, voice: tone, language: en, price_per_1000: 0 }\n");
  mkdirSync(join(dir, "projects", "delve", "missions"), { recursive: true });
  writeFileSync(join(dir, "projects", "delve", "project.yaml"), stringify({
    name: "Delve",
    adapter: join(ROOT, "dist", "index.js"),
    app: { base, auth: "none" },
    style: { voice: "tone", size: { width: 1280, height: 800 } },
    ...extra,
  }));
  const vault = join(root, "vault");
  process.env.REEL_DATA = vault;
  return { dir, vault };
}

let counter = 0;

/** Records one scene (dry or real) and returns its timeline and the mission's state bag. */
export async function recordScene(studio: TestStudio, steps: unknown[], opts: { dry?: boolean; seats?: never } = {}) {
  const key = `m${++counter}`;
  const mdir = join(studio.dir, "projects", "delve", "missions", key);
  mkdirSync(join(mdir, "chapters"), { recursive: true });
  writeFileSync(join(mdir, "mission.yaml"), stringify({ title: key, opening: { title: key }, chapters: ["one"] }));
  writeFileSync(join(mdir, "chapters", "one.yaml"), stringify({ title: "One", scenes: [{ id: "scene", steps }] }));
  const project = await loadProject(await loadStudio(studio.dir), "delve");
  const mission = await loadMission(project, key);
  const lines: string[] = [];
  const result = await recordMission({ project, mission, dry: opts.dry, log: (l) => lines.push(l), actionTimeout: 15_000 });
  const sceneDir = opts.dry
    ? join(studio.vault, "dry", "delve", key, "scene")
    : join(studio.vault, "scenes", "delve", key, "scene", JSON.parse(readFileSync(join(result.take!.dir, "take.json"), "utf8")).scenes[0].recording);
  const timeline = JSON.parse(readFileSync(join(sceneDir, "timeline.json"), "utf8"));
  return { result, timeline, state: new StateBag(stateFile("delve", key)), lines, mission: key };
}
