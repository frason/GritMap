# Receiver capabilities v1 — diagnostic source contract

2026-10-26. No public rollout. Public Karoo73 and existing phone builds remain baseline-only.
Flags default off; a diagnostic can advertise only the extensions it actually retains.
This implements GOALS priorities1/8 and the minimum record storage prerequisite for7.

## Advertisement

Exact JSON fixture: `fixtures/contracts/receiver-capabilities-v1.json`.
Keys: `v:1`, `transferV:2`, positive integer `versionCode`, `features` array,
`maxManifestBytes:512`, `maxRecordBytes:8192`. No names, GPS, rider IDs or inventory.
Feature strings: `planCeilingsV1`, `segmentRecordV1`. Each follows its independent build flag.
An absent, malformed, future-version, timed-out or unrecognized advertisement means baseline only.
Only a positively advertised known feature permits its fields. Unknown feature strings grant nothing.

**Wi-Fi implemented both sides in source:** Karoo's existing receive window answers
`GET /capabilities` (200 JSON, no-store) without consuming the later POST or extending its deadline.
Phone probes the same host/port for up to1500ms before its existing `/transfer` POST.
Old405/404/error receivers still receive their unchanged baseline package. A POST200 means received,
not imported; import validation remains asynchronous. Only generated realistic plans get extensions;
manual/imported plans are never rewritten.

**Bluetooth Karoo half implemented; PHONE NATIVE FOLLOW-UP REQUIRED:** phone is the GATT peripheral,
Karoo the central. Phone must add an OPTIONAL writable-with-response characteristic
`9aa66e90-1c9e-46e1-9e52-45fd6a40847a` on the existing service. Before its first manifest read,
Karoo writes the above UTF-8 JSON. An old phone without that characteristic follows the original flow.
An old Karoo never writes it, so a new phone MUST offer its original baseline variant by default.
The phone must stage baseline and richer variants before advertising; select only advertised extensions,
then freeze the exact manifest and resource bytes for the owning central for the entire transfer.
Claim the first central on capability write OR manifest read. Reject another central's writes/reads.
An identical capability write on reconnect must be idempotent, with no resource regeneration or offset reset;
a changed write after manifest selection must be refused. Existing recovery compares the entire manifest.
Keep the512-byte manifest ceiling for every peer: a GATT attribute cannot exceed512 bytes
([Bluetooth ATT specification](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/attribute-protocol--att-.html)).
Four resource descriptors may exceed that cap. Omit the optional record in that case and send it via Wi-Fi,
or omit rider only when the matching profile is already installed. Never silently discard a needed rider profile,
truncate hashes or raise this cap. A richer manifest needs a separately versioned chunked-manifest protocol.
The new pure TypeScript gate in `src/transfer/receiverCapabilities.ts` is shared preparation, not native BLE wiring.
Current iOS module/sender still stages a fixed baseline, so it cannot send the new BLE extensions yet.
Do not label an old-phone diagnostic transfer a successful ceiling transfer.

## Exact pacing fields

Fixture: `fixtures/contracts/plan-ceilings-transfer-v1.json` (tested identical to the existing
phone planner wire fixture). `baselinePacingPlan.replan` contains exactly:
`schemaVersion`, `criticalPowerWatts`, `wPrimeJoules`, `wPrimeReserveFraction`, `maxStepWatts`,
`hardMaxStepWatts`, `stepLimitMinGradePct`. Each `baselinePacingPlan.zones[]` also has
`ceilingPowerWatts`. See `PLAN_CEILINGS_CONTRACT.md` for ranges and unknown-schema behavior.
These are assumptions and bounds, never measured CP or W'. Phone sends the final targets unchanged.

## Exact record fields

New diagnostic schema, not yet sent by either production transport. Fixture:
`fixtures/contracts/segment-record-v1.json`. Wi-Fi root key `segmentRecord` contains exactly:

- `schemaVersion:1`.
- `riderId`: persistent opaque random per-rider identifier,16–64 ASCII letters/digits/underscore/hyphen.
  Do not use a name, email, FTP or Bluetooth address. Phone identity provisioning is still pending.
- `segmentFingerprint`:64 lowercase hex characters, matching the package segment/plan and installed geography.
- `bestDurationSeconds`: finite numeric value >0 and <=604800.
- `achievedAtMs`: positive integer epoch milliseconds; `effortCount`: integer0–1000000.
- `splits`: empty for duration-only, otherwise2–80 exact `{distanceMeters,elapsedSeconds}` objects.
  First is0/0; both axes strictly increase. Finish elapsed equals best duration (tolerance1e-6s),
  finish distance equals installed segment length (tolerance0.01m). Nonfinite, string numbers,
  unknown keys and partial/coarse tracks lacking the endpoints are rejected, never silently repaired.

Maximum serialized record8192 UTF-8 bytes. BLE optional manifest descriptor is `record:{bytes,sha256}`;
request resource name is `record`. Same chunk offsets and whole-resource SHA-256 verification as other
resources. The SHA describes exact bytes; no reserialization while a transfer is active. Plan still required
in BLEv2; plan-free BLE is the next separate milestone. There is no PR rendering/local-best merge yet.

Room4 adds tables only. The first accepted record pins an opaque owner; a different owner is rejected
atomically with the whole package. Same rider+fingerprint accepts a strictly faster time only;
equal/slower data does not erase the best record. There is no owner-switch/reset UI in this milestone.
Phone must keep the same ID across sends; rider-account changes need a separate explicit ownership flow.
Record deletion cascades with segment deletion, while the owner remains pinned. No destructive migration.
**After a Room4 build opens the device DB, public73/Room3 cannot reopen it.** Use a newer signed
flag-off Room4 build to disable the diagnostic. Never uninstall/clear app data to revert.

## Replay and supervised test

`fixtures/contracts/replanner-shapes-v1.json` contains invented short rolling climb and longer sustained
climb shapes, inspired only by the broad Junction Function/Diablo description. No real GPS/ride/RR data.
Kotlin `ShapeReplayTest` checks every later boundary after a20W first-section shortfall: completed work
unchanged, deficit improves, targets bounded,20W climbing transitions; ahead does not spend surplus;
large deficits give a finite bounded finish estimate rather than exceeding a ceiling. Existing tests cover
flat/downhill/missing grades, energy reserve, unsafe transitions and exact numeric synthetic results.
20W applies between climbs >=1.5%; the existing shared contract permits80W across flat/recovery transitions.
These replays validate the normalized deterministic response, not real-world finish accuracy or physiological calibration.

Do one supervised ride only after exact APK approval and a verified ceiling-bearing plan import
(updated phone Wi-Fi source or matching future native BLE phone build). Verify stored replan metadata
before riding, power/GPS live, confirm an estimate/target change at a boundary while behind, no early
spend while ahead, then save and inspect evidence. Device safety/ride success is not established by unit tests.
No public flag enablement, installation, phone build, release tag or publication is authorized by this document.
