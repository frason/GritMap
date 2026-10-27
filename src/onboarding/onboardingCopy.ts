/**
 * Words the rider is told to look for on the Karoo and in the app. Defined once so the onboarding
 * screens, the in-app send instructions and the Karoo install guide (docs/BETA_KAROO_INSTALL.md,
 * written alongside) cannot drift apart. Change a name here only together with the Karoo app.
 */
export const KAROO_APP_NAME = "GritMap";
/** The first public Karoo extension that can receive over Bluetooth (tag karoo-beta-0.10.45). Older ones need the Wi-Fi fallback. */
export const KAROO_MIN_VERSION_NAME = "0.10.45";
export const KAROO_MIN_VERSION_CODE = 73;
/** The Karoo button (GritMap, Inbox) that opens the Bluetooth receiver. */
export const KAROO_RECEIVE_SCREEN = "Receive from Phone";
/** The button on a segment, on the phone, that sends the segment and its plan. */
export const PHONE_SEND_BUTTON = "Send to Karoo";
/** How long the Karoo keeps listening once "Receive from Phone" is open (HttpSegmentInbox.DEFAULT_TIMEOUT_MINUTES). */
export const KAROO_RECEIVE_WINDOW_MINUTES = 10;
/** What the address on the Karoo looks like; shown as an example only. */
export const KAROO_ADDRESS_EXAMPLE = "192.168.1.23:8734";

export interface OnboardingStep {
  key: "welcome" | "numbers" | "segments";
  title: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { key: "welcome", title: "Welcome" },
  { key: "numbers", title: "Your numbers" },
  { key: "segments", title: "Get a segment" },
];

/** "Step 2 of 3": shown beside the progress dots and read out by VoiceOver. */
export function onboardingStepLabel(stepIndex: number): string {
  return `Step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`;
}

/** Where the Karoo APK is downloaded from (the same link as docs/BETA_KAROO_INSTALL.md). */
export const KAROO_APK_URL = "https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk";
/** Hammerhead's own guide to installing an APK through the Companion app. */
export const KAROO_SIDELOAD_GUIDE_URL = "https://support.hammerhead.io/hc/en-us/articles/31576497036827-Companion-App-Sideloading";

export interface KarooLink {
  label: string;
  url: string;
}

/** The two links under the first Karoo step. */
export const KAROO_UPDATE_LINKS: readonly KarooLink[] = [
  { label: "Get the GritMap Karoo APK", url: KAROO_APK_URL },
  { label: "Hammerhead's sideloading guide", url: KAROO_SIDELOAD_GUIDE_URL },
];

/** Heading and lead-in for the Karoo steps, on the Home checklist's "Connect your Karoo" screen. */
export const KAROO_SETUP_TITLE = "Connect your Karoo";
export const KAROO_SETUP_INTRO =
  "To ride a segment with live pacing, GritMap sends it and its plan to your Karoo over Bluetooth, straight from your phone. Do this when you are ready to ride; you can skip it for now.";

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
  items: ["A Hammerhead Karoo 3", "A power meter on your bike", "A heart-rate monitor"],
  body: "Pacing plans are power targets, so without a power meter GritMap can show your rides and segments but cannot pace or judge your effort.",
} as const;

/** The one short line under the FTP box in onboarding. */
export const FTP_HINT_SHORT = "The most power you can hold for about an hour. Your power meter or a recent test will tell you.";

/** Steps for the main way to send: Bluetooth, straight from the phone to the Karoo, no Wi-Fi or address needed. */
export const KAROO_STEPS: readonly { title: string; body: string; links?: readonly KarooLink[] }[] = [
  {
    title: `Update ${KAROO_APP_NAME} on your Karoo to ${KAROO_MIN_VERSION_NAME} (version code ${KAROO_MIN_VERSION_CODE}) or newer`,
    body: `The APK installs on the Karoo through the Hammerhead Companion app, not on this iPhone. Older versions cannot receive over Bluetooth; use the Wi-Fi steps below.`,
    links: KAROO_UPDATE_LINKS,
  },
  {
    title: `On the Karoo, open ${KAROO_APP_NAME}, then ${KAROO_INBOX}, then tap ${KAROO_RECEIVE_SCREEN}`,
    body: `Keep that screen open. The Karoo listens over Bluetooth for ${KAROO_BLUETOOTH_WINDOW_MINUTES} minutes.`,
  },
  {
    title: `On your phone, open a segment and tap ${PHONE_SEND_BUTTON}`,
    body: "Then tap Start Bluetooth send and keep GritMap open and the phone near the Karoo. iOS asks for Bluetooth permission the first time.",
  },
  // (The Send to Karoo screen shows these same steps with the third one reworded: see KAROO_SEND_SCREEN_STEPS.)
  {
    title: "Check the Karoo",
    body: `The phone says "Imported on your Karoo" once the Karoo confirms. If it only says "Sent; check your Karoo", open the Karoo's segment list.`,
  },
];

/** The same steps for the Send to Karoo screen itself, where the rider is already on the screen the third step names. */
export const KAROO_SEND_SCREEN_STEPS: readonly { title: string; body: string; links?: readonly KarooLink[] }[] = KAROO_STEPS.map((step, index) =>
  index === 2
    ? {
        title: "On your phone, tap Start Bluetooth send",
        body: "Keep GritMap open and the phone near the Karoo. iOS asks for Bluetooth permission the first time.",
      }
    : step,
);

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
    title: "Type that address in GritMap and tap send",
    body: "Use the Karoo address box on the segment's Send to Karoo screen, under Bluetooth not working? Use Wi-Fi. GritMap remembers it after that.",
  },
];

/** Why a rider might be waiting on a Karoo that cannot receive over Bluetooth (an older GritMap on the Karoo). */
export const OLDER_KAROO_HINT =
  `Still waiting. Your Karoo needs ${KAROO_APP_NAME} ${KAROO_MIN_VERSION_NAME} (version code ${KAROO_MIN_VERSION_CODE}) or newer to receive over Bluetooth. Update it, or send over Wi-Fi instead.`;

export const FTP_HELP =
  "FTP is the most power you can hold for about an hour. If you do not know yours, a recent power test or your bike computer's estimate is fine. You can change it later.";
