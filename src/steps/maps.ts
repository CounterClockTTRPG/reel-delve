// Maps: zoom the world map in on a place (Leaflet zooms around the cursor, and the marker drifts a little with each
// notch, so the cursor goes back to it before each one), and point at a map room's floor for its tooltip.
import type { StepDef } from "reel/adapter";
import { z } from "zod";

export const mapSteps: Record<string, StepDef<any>> = {
  "zoom-map": {
    args: z.object({ marker: z.string(), notches: z.number().int().min(1).max(10) }).strict(),
    async run(ctx, a: { marker: string; notches: number }) {
      const { page, stage } = ctx;
      const marker = page.locator(a.marker).first();
      await marker.waitFor();
      for (let i = 0; i < a.notches; i++) {
        const box = await marker.boundingBox();
        if (!box) break;
        await stage.glide(box.x + 5, box.y + 5);
        await page.mouse.wheel(0, -120);
        await stage.pause(0.8);
      }
      await stage.pause(1);
    },
  },
  "hover-room": {
    args: z.object({ room: z.string() }).strict(),
    async run(ctx, a: { room: string }) {
      const { page, stage } = ctx;
      const point = await page.evaluate((name) => {
        const box = document.querySelector(`[data-room="${name}"]`)?.getBoundingClientRect();
        if (!box) return null;
        const steps = 12;
        for (let fy = 1; fy < steps; fy++) {
          for (let fx = 1; fx < steps; fx++) {
            const x = box.x + (box.width * fx) / steps;
            const y = box.y + (box.height * fy) / steps;
            const hit = document.elementFromPoint(x, y);
            if (hit?.matches("path.floor") && hit.closest("[data-room]")?.getAttribute("data-room") === name) return { x, y };
          }
        }
        return null;
      }, a.room);
      if (!point) throw new Error(`room "${a.room}" isn't on the screen`);
      await stage.glide(point.x, point.y);
      await stage.pause(1.2);
    },
  },
};
