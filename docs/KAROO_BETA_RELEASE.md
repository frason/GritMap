# Publishing a GritMap Karoo beta

## Published Bluetooth beta: 0.10.45-bluetooth-beta / code 73

Normal code73 is installed and has passed missing-segment and installed-segment transfer checks.
The separate diagnostic73 variant passed a real controlled GATT-link disconnect/resume test.
Earlier full-radio restart tests failed; do not claim recovery from every radio restart.
Normal public builds require BLE_TEST_DISCONNECT_AFTER_BYTES=0; CI asserts this. Never publish the
diagnostic variant. H10 in-ride coexistence was owner-waived, not passed, and RR export is unfinished.

**Approved release scope:** Bluetooth requires a pacing plan in this beta. Segment-only sending stays
in the phone's Wi-Fi fallback. Plan-free Bluetooth and PR timing ship together later (GOALS priority7).
State this known gap in the install guide and release notes. The reviewed release notes live in
`docs/releases/KAROO_BLUETOOTH_BETA_0.10.45.md`; the workflow publishes them.

Published with approval as [karoo-beta-0.10.45](https://github.com/frason/GritMap/releases/tag/karoo-beta-0.10.45) from exact source
0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292. Actions run40073513782 passed. The stable latest download
URL returned HTTP200 and the verified public APK versionName0.10.45-bluetooth-beta/versionCode73.
Public SHA256 `73aa7e2f497243b4022f3012edb20eda6fe53cbbea5cf9a822350d11ac36ca69` matches SHA256SUMS.txt; signer matches the persistent beta identity.
The CI APK differs from the local candidate only in native compiler-identification/build-id metadata;
all other ZIP entries and all other native ELF sections match. Final Companion Share Link installation
and retained-data verification are still pending; do not widen invites before that check.
Use the persistent beta signing identity. Default beta configuration must have Bluetooth enabled and
CONCURRENT_SEGMENTS_ENABLED, LIVE_REPLANNER_ENABLED and PLAN_CEILINGS_ENABLED all false.
The workflow checks the generated beta BuildConfig before publishing. No Needle model is activated.

Prepare and commit the exact source in a dedicated worktree/branch, run full JVM tests, debug lint and
signed/minified assembleBeta, then verify APK signature, package version and SHA-256. Keep the phone
checkout unchanged. Local candidate build (JDK17 and Android SDK required):

```sh
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleBeta \
  -PgritmapBetaSigningProperties=/absolute/path/to/beta-signing.properties \
  -PgritmapVersionCode=73 -PgritmapVersionName=0.10.45-bluetooth-beta --no-daemon
```

**Approval gates:** present the exact version, APK SHA-256, source commit and QA results to Jason
before installation, tagging or publication. Obtain approval for each exact step. Preparing/committing
a branch is not permission to install or release it. Never clear app data or uninstall as part of an upgrade.

Before wide beta invites, deliberate mid-transfer disconnect followed by reconnect/resume from a completed
chunk and a successful import receipt must pass on the candidate. On2026-10-23 Jason waived the during-ride
H10 coexistence test because the extension app screen is unavailable during a ride. Send before recording;
record that gate as waived, not passed, and do not claim in-ride transfer support or RR continuity during a
transfer. H10 capture/save verification remains separate. Keep private sensor/ride data out of Git.
See `BLE_DIRECT_TRANSFER_REVIEW.md` R3/R5 and `KAROO_BLUETOOTH_RC_TESTS.md` for the procedure/evidence.
The public APK must also be installed through the stable Companion link and checked before wide invites.

Phone onboarding copies these exact Karoo labels: **Inbox**, **Receive from Phone**, **Legacy Wi-Fi Receive**,
**WAITING FOR PHONE**, **Cancel Receiving**, and **Bluetooth closes automatically after 2 minutes**.
Do not rename them without coordinating through Jason. Bluetooth permissions are requested on receiver
entry; shared Wi-Fi is needed only for Legacy Wi-Fi Receive. `BETA_KAROO_INSTALL.md` has rider steps.

The release workflow in `.github/workflows/karoo-beta-release.yml` publishes a signed Karoo 3 APK
when a matching `karoo-beta-X.Y.Z` tag is pushed. It runs the full JVM suite, debug lint, signed
minified beta build, APK signature verification, and package-version verification before creating
a GitHub release labeled as beta. It is deliberately a normal GitHub release, rather than a
GitHub "prerelease," so the stable `/releases/latest/download/gritmap-karoo.apk` URL works for
Hammerhead Companion installs.

## One-time GitHub repository secrets

Add these under **Settings > Secrets and variables > Actions**:

- `KAROO_BETA_KEYSTORE_BASE64`: the persistent beta JKS encoded as one base64 string.
- `KAROO_BETA_STORE_PASSWORD`
- `KAROO_BETA_KEY_ALIAS`
- `KAROO_BETA_KEY_PASSWORD`

Never commit the JKS, signing property file, passwords, or their encoded value. Base64 is transport
encoding, not encryption. Keep the existing offline backup of the signing identity.

On macOS, create the value copied into `KAROO_BETA_KEYSTORE_BASE64` with:

```bash
base64 -i /absolute/path/to/gritmap-beta.jks | tr -d '\n'
```

## Release procedure

1. Ensure `versionCode` and `versionName` defaults in `apps/karoo/app/build.gradle.kts` are increased,
   and prepare `docs/releases/KAROO_BLUETOOTH_BETA_<version>.md` for that exact tag. The workflow uses
   this reviewed file as its release notes; it does not reuse a previous version's notes.
2. Commit and verify the exact release source on the dedicated release branch. Get Jason’s approval before
   installing, tagging or publishing; after approval, make the reviewed source available to the release workflow.
3. Create an annotated tag matching the version exactly:

   ```bash
   git tag -a karoo-beta-0.10.45 -m "GritMap Karoo 0.10.45 Bluetooth beta"
   git push origin karoo-beta-0.10.45
   ```

4. Watch **Actions > Karoo beta release**. A successful run creates a release containing:
   `gritmap-karoo.apk` and `SHA256SUMS.txt`.
5. Test the public asset through Hammerhead Companion on a Karoo 3 before inviting testers.

The fixed asset name supports a stable download URL:

`https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`

Do not move to a new signing identity after beta testers install the app. Android treats a different
certificate as a different publisher and refuses an in-place update.
