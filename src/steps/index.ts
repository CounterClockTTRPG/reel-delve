import type { StepDef } from "reel/adapter";
import { campaignSteps } from "./campaign.js";
import { dmSteps } from "./dm.js";

/** Every step of the adapter, by name (scripts write them `delve.<name>`). */
export const STEPS: Record<string, StepDef<any>> = { ...dmSteps, ...campaignSteps };
