import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { secretsFor } from "reel/lib/adapter/secrets";
import { campaigns, startFakeDelve, type FakeDelve } from "./helpers/delve.js";
import { recordScene, testStudio, type TestStudio } from "./helpers/reel.js";

let delve: FakeDelve;
let studio: TestStudio;
let crypt: string;

beforeAll(async () => {
  delve = await startFakeDelve(47903);
  studio = testStudio(delve.base);
  crypt = (await campaigns(delve.base))[0].id;
});
afterAll(() => delve?.stop());

describe("campaigns", () => {
  it("makes a campaign on camera and returns its id", async () => {
    const { state } = await recordScene(studio, [
      { goto: "/campaigns" },
      { "delve.new-campaign": { module: "The Crypt of Saint Vellis", name: "Reel test", ruleset: "osric" }, as: "made" },
    ]);
    const id = state.get("made") as string;
    expect(id).toMatch(/^cmp_/);
    expect((await campaigns(delve.base)).map((c) => c.id)).toContain(id);
  });
});

describe("preferences", () => {
  it("switches the language and says which one it replaced", async () => {
    const { state } = await recordScene(studio, [
      { goto: "/campaigns" },
      { "delve.set-language": { code: "nl" }, as: "was" },
      { "wait-for": "html[lang^=nl]" },
      { "delve.set-language": { code: "en" }, as: "then" },
    ]);
    expect(state.get("was")).toBe("en");
    expect(state.get("then")).toBe("nl");
  });

  it("sets the portrait painter and puts the old one back", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${delve.base}/preferences`);
    await page.getByRole("tab", { name: "Backends" }).click();
    const provider = page.locator("#job-image-portrait-provider");
    await page.waitForFunction(() => (document.querySelector("#job-image-portrait-provider") as HTMLSelectElement | null)?.options.length! > 1);
    const labels = (await provider.locator("option").allInnerTexts()).map((l) => l.trim());
    const current = await provider.evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? "");
    await browser.close();
    const other = labels.find((l) => l !== current);
    expect(other).toBeTruthy();
    const { state } = await recordScene(studio, [
      { goto: "/preferences" },
      { "delve.set-painter": { label: other }, as: "painter" },
      { "delve.restore-painter": { from: "painter" }, as: "replaced" },
    ]);
    expect(state.get("painter")).toBe(current);
    expect(state.get("replaced")).toBe(other);
  });
});

describe("seats", () => {
  it("makes a seat's account the first time, logs in the next, and makes it again when its password is gone", async () => {
    const steps = [{ goto: "/" }, { "delve.seat": { who: "Ana", campaign: crypt }, seat: "ana", as: "anaSeat" }];
    const first = await recordScene(studio, steps);
    expect((first.state.get("anaSeat") as { id: string }).id).toBeTruthy();
    const password = secretsFor("delve").get("seat.tour-ana");
    expect(password).toBeTruthy();
    await recordScene(studio, steps);
    expect(secretsFor("delve").get("seat.tour-ana")).toBe(password);
    // As after `reel record --fresh`: a kept password for an account the app no longer has.
    secretsFor("delve").set("seat.tour-zed", "not-a-password");
    const again = await recordScene(studio, [{ goto: "/" }, { "delve.seat": { who: "Zed", campaign: crypt }, seat: "zed", as: "z" }]);
    expect((again.state.get("z") as { id: string }).id).toBeTruthy();
    expect(secretsFor("delve").get("seat.tour-zed")).not.toBe("not-a-password");
  });

  it("makes a character once, and gives it to a seat", async () => {
    const steps = [
      { goto: "/" },
      { "delve.seat": { who: "Ben", campaign: crypt }, seat: "ben", as: "benSeat" },
      { "delve.character": { name: "Tobin", campaign: crypt, seat: "benSeat" }, as: "tobin" },
      { "delve.character": { name: "Tobin", campaign: crypt }, as: "tobinAgain" },
    ];
    const { state } = await recordScene(studio, steps);
    expect(state.get("tobin")).toBe(state.get("tobinAgain"));
  });
});
