# Publishing a GritMap Karoo beta

## Bluetooth candidate: 0.10.45-bluetooth-beta / code 71

This is a release candidate, not an announcement that it has been installed or published. The numeric
release base is 0.10.45; the workflow builds `0.10.45-bluetooth-beta` from tag `karoo-beta-0.10.45`.
Use the persistent beta signing identity. Default beta configuration must have Bluetooth enabled and
CONCURRENT_SEGMENTS_ENABLED, LIVE_REPLANNER_ENABLED and PLAN_CEILINGS_ENABLED all false.
The workflow checks the generated beta BuildConfig before publishing. No Needle model is activated.

Prepare and commit the exact source in a dedicated worktree/branch, run full JVM tests, debug lint and
signed/minified assembleBeta, then verify APK signature, package version and SHA-256. Keep the phone
checkout unchanged. Local candidate build (JDK17 and Android SDK required):

```sh
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleBeta \
  -PgritmapBetaSigningProperties=/absolute/path/to/beta-signing.properties \
  -PgritmapVersionCode=71 -PgritmapVersionName=0.10.45-bluetooth-beta --no-daemon
```

**Approval gates:** present the exact version, APK SHA-256, source commit and QA results to Jason
before installation, tagging or publication. Obtain approval for each exact step. Preparing/committing
a branch is not permission to install or release it. Never clear app data or uninstall as part of an upgrade.

Before wide beta invites, both outstanding physical gates must pass on the candidate: H10 RR continuity
while receiving (not just ANT+ BPM), and a deliberate mid-transfer disconnect followed by reconnect/resume
from a completed chunk and a successful import receipt. Keep private sensor/ride data out of Git.
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

1. Ensure `versionCode` and `versionName` defaults in `apps/karoo/app/build.gradle.kts` are increased.
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
