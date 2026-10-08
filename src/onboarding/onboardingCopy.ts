/**
 * Words the rider is told to look for on the Karoo and in the app. Defined once so the onboarding
 * screens, the in-app send instructions and the Karoo install guide (docs/BETA_KAROO_INSTALL.md,
 * written alongside) cannot drift apart. Change a name here only together with the Karoo app.
 */
export const KAROO_APP_NAME = "GritMap";
/** The button on the Karoo's GritMap screen that opens the transfer listener and shows its address. */
export const KAROO_RECEIVE_SCREEN = "Receive from Phone";
/** The button on a segment, on the phone, that sends the segment and its plan. */
export const PHONE_SEND_BUTTON = "Send plan to Karoo";
/** How long the Karoo keeps listening once "Receive from Phone" is open (HttpSegmentInbox.DEFAULT_TIMEOUT_MINUTES). */
export const KAROO_RECEIVE_WINDOW_MINUTES = 10;
/** What the address on the Karoo looks like; shown as an example only. */
export const KAROO_ADDRESS_EXAMPLE = "192.168.1.23:8734";

export interface OnboardingStep {
  key: "welcome" | "numbers" | "segments" | "karoo";
  title: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { key: "welcome", title: "Welcome" },
  { key: "numbers", title: "Your numbers" },
  { key: "segments", title: "Get a segment" },
  { key: "karoo", title: "Connect your Karoo" },
];

export const WELCOME_POINTS: readonly { icon: "mapPin" | "speedometer" | "pulse"; title: string; body: string }[] = [
  {
    icon: "mapPin",
    title: "Pick a climb you want to get faster on",
    body: "A segment is any stretch of road. Make one from a ride of yours, or use one another rider has shared.",
  },
  {
    icon: "speedometer",
    title: "Get a pacing plan",
    body: "Give GritMap a goal time and it turns it into target watts for each stretch, so you start at a pace you can finish.",
  },
  {
    icon: "pulse",
    title: "Ride it, then see where it went right",
    body: "Your Karoo guides you live. Afterwards GritMap shows where you matched the plan and where you faded.",
  },
];

export const SEGMENT_WAYS: readonly { icon: "search" | "download" | "route"; title: string; body: string }[] = [
  {
    icon: "search",
    title: "Browse Open Segments",
    body: "Free segments shared by other riders. Open the Segments tab and tap Open Segments, then tap a segment to add it.",
  },
  {
    icon: "route",
    title: "Make one from your own ride",
    body: "Open the Rides tab and tap Import to add a ride file (.fit or .gpx) from your bike computer. Open the ride, then pick where your segment starts and finishes.",
  },
  {
    icon: "download",
    title: "Import a segment file",
    body: "Got a segment file (.json) from a friend or from your Karoo? Rides tab, Import, then Import Segment JSON.",
  },
];

export const KAROO_STEPS: readonly { title: string; body: string }[] = [
  {
    title: `Install ${KAROO_APP_NAME} on your Karoo`,
    body: `Follow the Karoo install guide you were sent. When it worked, ${KAROO_APP_NAME} appears in your Karoo's app list.`,
  },
  {
    title: "Put your phone and Karoo on the same Wi-Fi",
    body: "Use your home Wi-Fi, or turn on Personal Hotspot on your iPhone and join it from the Karoo.",
  },
  {
    title: `On the Karoo, open ${KAROO_APP_NAME} and tap ${KAROO_RECEIVE_SCREEN}`,
    body: `The Karoo shows an address, like ${KAROO_ADDRESS_EXAMPLE}. Keep that screen open: it stops listening after ${KAROO_RECEIVE_WINDOW_MINUTES} minutes.`,
  },
  {
    title: `On your phone, open a segment and tap ${PHONE_SEND_BUTTON}`,
    body: "Type the address from the Karoo the first time. GritMap remembers it after that.",
  },
  {
    title: "Check the Karoo",
    body: `It confirms the segment arrived. If your phone says it could not reach the Karoo, check both are on the same Wi-Fi and ${KAROO_RECEIVE_SCREEN} is still open.`,
  },
];

export const FTP_HELP =
  "FTP is the most power you can hold for about an hour. If you do not know yours, a recent power test or your bike computer's estimate is fine. You can change it later.";
