// The other people at the table: seat a player (or an observer) on their own screen, through the campaign's invite,
// and give them a character. A seat's account is made the first time, with its password kept in the vault (the
// adapter's secrets); later runs log in with it, and make it again when it no longer logs in (the app's data was
// started over).
import { randomBytes } from "node:crypto";
import type { StepContext, StepDef } from "reel/adapter";
import { z } from "zod";
import { campaignId } from "./campaign.js";

const Seat = z.object({
  who: z.string().min(1),
  role: z.enum(["player", "observer"]).default("player"),
  name: z.string().optional(),
  username: z.string().optional(),
  campaign: z.string(),
}).strict();

async function json(res: { ok(): boolean; status(): number; text(): Promise<string>; json(): Promise<any> }, what: string) {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Seats this step's page (a seat's own) at the campaign; returns the seat. */
export async function seat(ctx: StepContext, a: z.infer<typeof Seat>): Promise<{ id: string; name?: string }> {
  // It logs its page in as the seat's account: on the host's page, the host would be logged out on camera.
  if (ctx.seatName === "host") throw new Error(`delve.seat runs on the seat's page: add seat: <name> to the step (for ${a.who})`);
  const id = campaignId(ctx, a.campaign);
  const { join_token: token } = await json(await ctx.api.get(`/api/campaigns/${id}/invite`), "the campaign's invite");
  const request = ctx.page.request;
  const username = a.username ?? `tour-${a.who.toLowerCase()}`;
  const name = a.name ?? a.who;
  const key = `seat.${username}`;
  const kept = ctx.secrets.get(key);
  if (kept) {
    const login = await request.post("/api/login", { data: { username, password: kept, join_token: token } });
    if (login.ok()) {
      const joined = await json(await request.post(`/api/join/${token}`, { data: { role: a.role, name } }), `seating ${username}`);
      return joined.seat;
    }
    ctx.log(`  (${username}'s kept password doesn't log in: making the account again)`);
  }
  const password = randomBytes(12).toString("base64url");
  const made = await json(
    await request.post(`/api/join/${token}/account`, { data: { username, password, display_name: name, language: "en", role: a.role } }),
    `making ${username}`,
  );
  ctx.secrets.set(key, password);
  return made.seat;
}

const Character = z.object({ name: z.string().min(1), campaign: z.string(), seat: z.string().optional() }).strict();

export const seatSteps: Record<string, StepDef<any>> = {
  seat: {
    args: Seat,
    changes: true,
    async run(ctx, a: z.infer<typeof Seat>) {
      const taken = await seat(ctx, a);
      await ctx.stage.goto(`/play/${campaignId(ctx, a.campaign)}`);
      return taken;
    },
  },
  character: {
    args: Character,
    changes: true,
    /** A character made by the host by name, unless there is one already; given to the seat (a state key) if named. */
    async run(ctx, a: z.infer<typeof Character>) {
      const id = campaignId(ctx, a.campaign);
      const list = await json(await ctx.api.get(`/api/campaigns/${id}/characters`), "the campaign's characters");
      let character = (Array.isArray(list) ? list : (list.characters ?? [])).find((c: { name: string }) => c.name === a.name);
      if (!character) character = await json(await ctx.api.post(`/api/campaigns/${id}/characters`, { data: { name: a.name } }), `making ${a.name}`);
      if (a.seat) {
        const s = ctx.state.get(a.seat) as { id?: string } | undefined;
        if (!s?.id) throw new Error(`no seat kept under "${a.seat}" (keep delve.seat's result with as:)`);
        const claimed = await ctx.api.post(`/api/campaigns/${id}/characters/${character.id}/claim`, { data: { seat: s.id } });
        if (!claimed.ok()) ctx.log(`  (${a.name} not given to ${s.id}: ${claimed.status()})`);
      }
      return character.id;
    },
  },
};
