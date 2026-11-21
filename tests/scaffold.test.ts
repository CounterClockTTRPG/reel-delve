import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadAdapter } from "reel/lib/adapter/load";
import { startFakeDelve, type FakeDelve } from "./helpers/delve.js";
import { join } from "node:path";

let delve: FakeDelve;
beforeAll(async () => {
  delve = await startFakeDelve(47901);
});
afterAll(() => delve?.stop());

describe("the adapter", () => {
  it("loads in Reel", async () => {
    const adapter = await loadAdapter(join(import.meta.dirname, "..", "dist", "index.js"), "/");
    expect(adapter?.name).toBe("delve");
    expect(adapter?.masks).toContain(".campaign-group");
  });

  it("has a fake Delve to test against, with the crypt's module", async () => {
    const modules = await (await fetch(`${delve.base}/api/modules`)).json();
    const list = Array.isArray(modules) ? modules : modules.modules;
    expect(list.map((m: { title: string }) => m.title)).toContain("The Crypt of Saint Vellis");
  });
});
