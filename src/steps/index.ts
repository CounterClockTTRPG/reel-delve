import type { StepDef } from "reel/adapter";
import { campaignSteps } from "./campaign.js";
import { dmSteps } from "./dm.js";
import { mapSteps } from "./maps.js";
import { prefSteps } from "./prefs.js";
import { seatSteps } from "./seats.js";

/** Every step of the adapter, by name (scripts write them `delve.<name>`). */
export const STEPS: Record<string, StepDef<any>> = { ...dmSteps, ...campaignSteps, ...prefSteps, ...seatSteps, ...mapSteps };
