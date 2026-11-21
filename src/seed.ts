// Seeding a separate Delve (Task 7).
import type { SeedContext } from "reel/adapter";
import { z } from "zod";

export const SeedOptions = z.object({}).passthrough();

export async function seed(ctx: SeedContext): Promise<void> {
  ctx.log("nothing to seed yet");
}
