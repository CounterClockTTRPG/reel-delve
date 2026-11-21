// Preferences a film changes and puts back: the language (the side bar's switch) and the portrait painter
// (Preferences, Backends). Each returns what it replaced, for `as:` and the step that puts it back.
import type { StepContext, StepDef } from "reel/adapter";
import { z } from "zod";

const PROVIDER = "#job-image-portrait-provider";

/** Sets the portrait painter by its label in the menu; returns the label it replaced. */
export async function setPainter(ctx: StepContext, label: string, say?: { label?: string; text: string }): Promise<string> {
  const { stage, page } = ctx;
  await stage.navigate("/preferences");
  await stage.click("role=tab[name='Backends']");
  const provider = page.locator(PROVIDER);
  await provider.waitFor();
  const before = await provider.evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? "");
  if (say) await stage.say(say.text, { label: say.label, spot: `${PROVIDER} >> xpath=ancestor::fieldset[1]` });
  if (before !== label) {
    await stage.select(PROVIDER, { label });
    await stage.click("role=button[name='Save']");
    await page.getByRole("status").filter({ hasText: "Saved" }).waitFor({ timeout: 30_000 });
    await stage.pause(1);
  }
  return before;
}

export const prefSteps: Record<string, StepDef<any>> = {
  "set-language": {
    args: z.object({ code: z.string().min(2), back: z.string().optional() }).strict(),
    changes: true,
    async run(ctx, a: { code: string; back?: string }) {
      const { stage, page } = ctx;
      const pick = page.locator(".nav-footer select");
      const here = new URL(page.url()).pathname;
      if (!(await pick.isVisible().catch(() => false))) await stage.navigate("/campaigns");
      const before = await pick.inputValue();
      await stage.select(".nav-footer select", { value: a.code });
      await page.waitForFunction(() => !(document.querySelector(".nav-footer select") as HTMLSelectElement | null)?.disabled);
      await page.waitForFunction((code) => document.documentElement.lang.startsWith(code), a.code, { timeout: 15_000 }).catch(() => {});
      await stage.pause(1.5);
      const target = a.back ?? here;
      if (new URL(page.url()).pathname !== target) await stage.navigate(target);
      return before;
    },
  },
  "set-painter": {
    args: z.object({ label: z.string(), say: z.object({ label: z.string().optional(), text: z.string() }).strict().optional() }).strict(),
    changes: true,
    run: (ctx, a: { label: string; say?: { label?: string; text: string } }) => setPainter(ctx, a.label, a.say),
  },
  "restore-painter": {
    args: z.object({ from: z.string() }).strict(),
    changes: true,
    async run(ctx, a: { from: string }) {
      const label = ctx.state.get(a.from);
      if (typeof label !== "string" || !label) {
        ctx.log(`  (no painter kept under "${a.from}": nothing to put back)`);
        return undefined;
      }
      return setPainter(ctx, label);
    },
  },
};
