// Reel's adapter for Delve: the steps a film of Delve needs besides clicking (wait for the DM, ask it, make a
// campaign, seat other players, switch the language or the portrait painter), the masks a public video needs, and
// seeding a separate Delve with the packs, an owner and the modules the films show.
import { defineAdapter, type Adapter } from "reel/adapter";
import { z } from "zod";
import { STEPS } from "./steps/index.js";
import { seed, SeedOptions } from "./seed.js";

/** localStorage keys that keep Delve's own help off camera: the "New here?" tours, "Did you know", module cards. */
export const LOCAL_STORAGE: Record<string, string> = {
  "delve.tours.skipped": "1",
  "delve.didYouKnow": "off",
  "delve.modulesLayout": "cards",
};

const adapter: Adapter = defineAdapter({
  name: "delve",
  version: "0.1.0",
  steps: STEPS,
  // Other people's names in the campaign list: never in a public video.
  masks: [".campaign-list-head", ".campaign-group"],
  options: z.object({ seed: SeedOptions.optional() }).strict() as unknown as z.ZodType<Record<string, unknown>>,
  async init({ page }) {
    await page.addInitScript((presets) => {
      try {
        for (const [k, v] of Object.entries(presets)) localStorage.setItem(k, v);
      } catch {}
    }, LOCAL_STORAGE);
  },
  seed,
});

export default adapter;
