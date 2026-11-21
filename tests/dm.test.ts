import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { campaigns, startFakeDelve, type FakeDelve } from "./helpers/delve.js";
import { recordScene, testStudio, type TestStudio } from "./helpers/reel.js";

let delve: FakeDelve;
let studio: TestStudio;
let campaign: string;

beforeAll(async () => {
  delve = await startFakeDelve(47902);
  studio = testStudio(delve.base);
  campaign = (await campaigns(delve.base))[0].id;
});
afterAll(() => delve?.stop());

describe("the DM's steps", () => {
  it("acts and waits for the DM, marking the wait", async () => {
    const { timeline, state } = await recordScene(studio, [
      { "delve.open-campaign": { campaign } },
      { "delve.act": { text: "I look around the crypt.", caption: { label: "The DM", text: "The DM answers." } }, as: "turn" },
    ]);
    const turn = String(state.get("turn") ?? "");
    // The DM's narration came in (the fake's beat), not just the clock.
    expect(turn.length).toBeGreaterThan(40);
    const wait = timeline.events.find((e: { kind: string }) => e.kind === "wait");
    expect(wait).toBeTruthy();
    expect(wait.end).toBeGreaterThan(wait.t);
    expect(timeline.events.some((e: { kind: string; note?: string }) => e.kind === "say" && e.note === "The DM answers.")).toBe(true);
  });

  it("asks a rules question and keeps the answer", async () => {
    const { state } = await recordScene(studio, [
      { "delve.open-campaign": { campaign } },
      { "delve.ask": { question: "How does turning undead work?" }, as: "answer" },
    ]);
    expect(String(state.get("answer") ?? "").length).toBeGreaterThan(0);
  });

  it("sends nothing in a dry run", async () => {
    const { timeline } = await recordScene(studio, [
      { "delve.open-campaign": { campaign } },
      { "delve.act": { text: "I open the sarcophagus." } },
    ], { dry: true });
    expect(timeline.events.some((e: { kind: string }) => e.kind === "wait")).toBe(false);
  });
});
