/**
 * Words the rider is told to look for on the Karoo and in the app. Defined once so the onboarding
 * screens, the in-app send instructions and the Karoo install guide (docs/BETA_KAROO_INSTALL.md,
 * written alongside) cannot drift apart. Change a name here only together with the Karoo app.
 */
export const KAROO_APP_NAME = "GritMap";
/** The Karoo button (GritMap, Inbox) that opens the Bluetooth receiver. */
export const KAROO_RECEIVE_SCREEN = "Receive from Phone";
/** The button on a segment, on the phone, that sends the segment and its plan. */
export const PHONE_SEND_BUTTON = "Send to Karoo";
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

/** The Karoo screen the GritMap app opens first: its Inbox holds both receive buttons. */
export const KAROO_INBOX = "Inbox";
/** The Karoo button that starts the Wi-Fi receiver in current Karoo builds (older builds label it "Receive from Phone"). */
export const KAROO_WIFI_RECEIVE = "Legacy Wi-Fi Receive";
/** How long the Karoo listens over Bluetooth once "Receive from Phone" is open (docs/BLE_DIRECT_TRANSFER_CONTRACT.md). */
export const KAROO_BLUETOOTH_WINDOW_MINUTES = 2;

/** What GritMap needs to be useful (docs/GOALS.md, decided 2026-10-23). Shown before anything is set up. */
export const WHAT_YOU_NEED = {
  title: "What you need",
  intro: "GritMap needs:",
  items: ["A Hammerhead Karoo 3", "A power meter on your bike", "A heart-rate monitor"],
  body: "Pacing plans are power targets, so without a power meter GritMap can show your rides and segments but cannot pace or judge your effort.",
} as const;

/** Said next to FTP so the rider knows where the number comes from. */
export const FTP_SOURCE_NOTE = "Your FTP is the number your power meter and recent rides point to.";

/** Steps for the main way to send: Bluetooth, straight from the phone to the Karoo, no Wi-Fi or address needed. */
export const KAROO_STEPS: readonly { title: string; body: string }[] = [
  {
    title: `Update ${KAROO_APP_NAME} on your Karoo`,
    body: `Follow the Karoo install guide you were sent. When it worked, ${KAROO_APP_NAME} appears in your Karoo's app list.`,
  },
  {
    title: `On the Karoo, open ${KAROO_APP_NAME}, then ${KAROO_INBOX}, then tap ${KAROO_RECEIVE_SCREEN}`,
    body: `Keep that screen open. The Karoo listens over Bluetooth for ${KAROO_BLUETOOTH_WINDOW_MINUTES} minutes.`,
  },
  {
    title: `On your phone, open a segment and tap ${PHONE_SEND_BUTTON}`,
    body: "Then tap Start Bluetooth send and keep GritMap open and the phone near the Karoo. iOS asks for Bluetooth permission the first time.",
  },
  {
    title: "Check the Karoo",
    body: `The phone says "Imported on your Karoo" once the Karoo confirms. If it only says "Sent; check your Karoo", open the Karoo's segment list.`,
  },
];

/** What to do when Bluetooth does not work. The Wi-Fi route needs both devices on the same network. */
export const WIFI_FALLBACK_STEPS: readonly { title: string; body: string }[] = [
  {
    title: "Put your phone and Karoo on the same Wi-Fi",
    body: "Use your home Wi-Fi, or turn on Personal Hotspot on your iPhone and join it from the Karoo.",
  },
  {
    title: `On the Karoo, open ${KAROO_APP_NAME}, then ${KAROO_INBOX}, then tap ${KAROO_WIFI_RECEIVE}`,
    body: `Older ${KAROO_APP_NAME} versions call it ${KAROO_RECEIVE_SCREEN}. The Karoo shows an address like ${KAROO_ADDRESS_EXAMPLE}. It stops listening after ${KAROO_RECEIVE_WINDOW_MINUTES} minutes.`,
  },
  {
    title: "Type that address in the box below and tap send",
    body: "GritMap remembers the address after that.",
  },
];

/** Why a rider might be waiting on a Karoo that cannot receive over Bluetooth (an older GritMap on the Karoo). */
export const OLDER_KAROO_HINT =
  `Still waiting. If your Karoo has an older ${KAROO_APP_NAME} version, it cannot receive over Bluetooth: update it, or send over Wi-Fi instead.`;

export const FTP_HELP =
  "FTP is the most power you can hold for about an hour. If you do not know yours, a recent power test or your bike computer's estimate is fine. You can change it later.";
