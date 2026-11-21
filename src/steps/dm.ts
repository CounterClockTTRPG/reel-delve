// The DM's turns: act (say what you do, and wait for the DM), the wait itself, and asking a rules question. Each
// wait is a marked stretch the edit cuts or speeds up.
import type { StepContext, StepDef } from "reel/adapter";
import { z } from "zod";

const Caption = z.object({ label: z.string().optional(), text: z.string() }).strict();

/** Waits for the DM's answer to what was just sent: the clock shows, goes, and the story stops changing. */
export async function dmDone(ctx: StepContext, title = "Waiting for the DM (cut or speed up)"): Promise<void> {
  const { stage, page } = ctx;
  await stage.wait(title, async () => {
    const thinking = page.getByTestId("thinking");
    await thinking.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
    await thinking.waitFor({ state: "hidden", timeout: 15 * 60_000 });
    await stage.settled("[data-testid=story]", { quiet: 3, timeout: 5 * 60 });
  });
}

export const dmSteps: Record<string, StepDef<any>> = {
  "dm-done": {
    args: z.object({ title: z.string().optional() }).strict().nullable(),
    run: (ctx, a: { title?: string } | null) => dmDone(ctx, a?.title),
  },

  act: {
    args: z.object({ text: z.string().min(1), button: z.enum(["act", "pass"]).default("act"), caption: Caption.optional() }).strict(),
    costs: true,
    changes: true,
    async run(ctx, a: { text: string; button: "act" | "pass"; caption?: z.infer<typeof Caption> }) {
      const { stage, page } = ctx;
      const story = page.getByTestId("story");
      const before = await story.innerText().catch(() => "");
      await stage.type("[data-testid=composer] textarea", a.text);
      await stage.click(`[data-testid=${a.button}]`, { after: 0.5 });
      if (a.caption) await stage.say(a.caption.text, { label: a.caption.label, keep: true, place: "top" });
      await dmDone(ctx);
      if (a.caption) await stage.unsay();
      // What the turn added to the story: the act and the DM's answer (keep it with `as:` to check it later).
      const after = await story.innerText();
      // (An empty story's placeholder is replaced by the first beat: then the whole story is the turn.)
      return (after.startsWith(before) ? after.slice(before.length) : after).trim();
    },
    async dry(ctx, a: { text: string }) {
      // What would be sent, typed but not sent: the step still finds its composer.
      await ctx.stage.type("[data-testid=composer] textarea", a.text, { delay: 5 });
      ctx.log(`  (dry: not sent to the DM: ${a.text.slice(0, 50)})`);
    },
  },

  ask: {
    args: z.object({ question: z.string().min(1), say: Caption.optional() }).strict(),
    costs: true,
    async run(ctx, a: { question: string; say?: z.infer<typeof Caption> }) {
      const { stage, page } = ctx;
      await stage.click("[data-testid=mode-ask]");
      const asked = page.locator("[data-testid=story] [data-testid=asked]");
      const before = await asked.count();
      await stage.type("[data-testid=composer] textarea", a.question);
      await stage.click("[data-testid=ask]", { after: 0.5 });
      const answer = asked.nth(before);
      await stage.wait("Waiting for the answer (cut or speed up)", async () => {
        await answer.waitFor({ timeout: 5 * 60_000 });
        await page.waitForFunction(
          (n) => !document.querySelectorAll("[data-testid=story] [data-testid=asked]")[n]?.textContent?.includes("Answering…"),
          before,
          { timeout: 5 * 60_000 },
        ).catch(() => {});
        await stage.settled(`[data-testid=story] [data-testid=asked] >> nth=${before}`, { quiet: 2 });
      });
      if (a.say) await stage.say(a.say.text, { label: a.say.label, place: "top" });
      return (await answer.innerText()).trim();
    },
    async dry(ctx, a: { question: string }) {
      await ctx.stage.click("[data-testid=mode-ask]");
      await ctx.stage.type("[data-testid=composer] textarea", a.question, { delay: 5 });
      return "(dry: no answer)";
    },
  },
};
