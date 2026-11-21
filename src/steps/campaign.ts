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
