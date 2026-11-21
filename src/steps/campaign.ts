// Campaigns: open one's play screen, or make one on camera with the New campaign form.
import type { StepContext, StepDef } from "reel/adapter";
import { z } from "zod";

/** A campaign id given directly, or the key of one an earlier step kept in the state bag. */
export function campaignId(ctx: StepContext, ref: string): string {
  if (/^cmp_/.test(ref)) return ref;
  const kept = ctx.state.get(ref);
  if (typeof kept === "string" && kept) return kept;
  throw new Error(`no campaign "${ref}": neither a campaign id nor a state key an earlier scene kept (as: ${ref})`);
}

export const campaignSteps: Record<string, StepDef<any>> = {
  "open-campaign": {
    args: z.object({ campaign: z.string() }).strict(),
    async run(ctx, a: { campaign: string }) {
      const id = campaignId(ctx, a.campaign);
      await ctx.stage.goto(`/play/${id}`);
      await ctx.page.getByTestId("composer").waitFor({ timeout: 30_000 }).catch(() => {});
      return id;
    },
  },
};

const NewCampaign = z.object({
  module: z.string(),
  name: z.string().optional(),
  ruleset: z.string().optional(),
  setting: z.string().optional(),
}).strict();

Object.assign(campaignSteps, {
  "new-campaign": {
    args: NewCampaign,
    changes: true,
    /** The New campaign form on the campaigns page, filled on camera; returns the new campaign's id. */
    async run(ctx: StepContext, a: z.infer<typeof NewCampaign>) {
      const { stage, page } = ctx;
      if (!/\/campaigns\/?$/.test(new URL(page.url()).pathname)) await stage.navigate("/campaigns");
      const form = page.locator("form#new-campaign");
      await form.waitFor();
      const module = page.locator("#campaign-module");
      const value = await module.locator("option", { hasText: a.module }).first().getAttribute("value", { timeout: 10_000 })
        .catch(() => null);
      if (!value) throw new Error(`no module "${a.module}" in the New campaign form (is it seeded?)`);
      await stage.select("#campaign-module", { value });
      if (a.name) await stage.type("#campaign-name", a.name, { delay: 80 });
      if (a.ruleset && (await page.locator("#campaign-ruleset").isVisible().catch(() => false))) {
        await stage.select("#campaign-ruleset", { value: a.ruleset });
      }
      if (a.setting && (await page.locator("#campaign-setting").isVisible().catch(() => false))) {
        await stage.select("#campaign-setting", { value: a.setting });
      }
      const submit = form.getByRole("button", { name: "New campaign" });
      await page.waitForFunction((b) => !(b as HTMLButtonElement).disabled, await submit.elementHandle(), { timeout: 30_000 });
      await stage.click("form#new-campaign >> role=button[name='New campaign']");
      await page.waitForURL(/\/campaigns\/[^/?]+$/, { timeout: 60_000 });
      const id = new URL(page.url()).pathname.split("/").pop()!;
      await page.locator("h1").first().waitFor();
      await stage.pause(1.5);
      return id;
    },
    async dry(ctx: StepContext, a: z.infer<typeof NewCampaign>) {
      const { stage, page } = ctx;
      if (!/\/campaigns\/?$/.test(new URL(page.url()).pathname)) await stage.navigate("/campaigns");
      await page.locator("form#new-campaign").waitFor();
      const found = await page.locator("#campaign-module option", { hasText: a.module }).count();
      if (!found) throw new Error(`no module "${a.module}" in the New campaign form (is it seeded?)`);
      ctx.log(`  (dry: no campaign made of ${a.module})`);
      return undefined;
    },
  },
} satisfies Record<string, StepDef<any>>);
