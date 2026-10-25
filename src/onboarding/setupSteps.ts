import type { IconName } from "../theme/icons.ts";

export type SetupStepKey = "ftp" | "segment" | "ride" | "send";

export interface SetupProgress {
  hasFtp: boolean;
  hasSegment: boolean;
  hasRide: boolean;
  hasSent: boolean;
}

export interface SetupStep {
  key: SetupStepKey;
  title: string;
  body: string;
  action: string;
  icon: IconName;
  done: boolean;
}

/** The first-run checklist in the order a rider does things. Whether each step is done comes from what is in the app. */
export function setupSteps(progress: SetupProgress): SetupStep[] {
  return [
    { key: "ftp", title: "Enter your FTP", body: "The most power you can hold for about an hour. Plans are built from it.", action: "Enter FTP", icon: "bolt", done: progress.hasFtp },
    { key: "segment", title: "Add a segment", body: "A stretch of road you want to ride faster.", action: "Browse Open Segments", icon: "mapPin", done: progress.hasSegment },
    { key: "ride", title: "Import a ride", body: "GritMap finds your segments in it and keeps your times.", action: "Import a ride", icon: "download", done: progress.hasRide },
    { key: "send", title: "Send a segment to your Karoo", body: "Open a segment and send it by Bluetooth.", action: "Choose a segment", icon: "bluetooth", done: progress.hasSent },
  ];
}

/** The checklist replaces Home until the rider has a segment and a ride in the app; after that Home is for riding. */
export function shouldShowSetupChecklist(progress: SetupProgress): boolean {
  return !(progress.hasSegment && progress.hasRide);
}

/** The step to point the rider at next: the first one not done. */
export function nextSetupStep(steps: readonly SetupStep[]): SetupStep | undefined {
  return steps.find((step) => !step.done);
}
