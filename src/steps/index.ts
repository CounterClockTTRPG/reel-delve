import type { StepDef } from "reel/adapter";

/** Every step of the adapter, by name (scripts write them `delve.<name>`). */
export const STEPS: Record<string, StepDef<any>> = {};
