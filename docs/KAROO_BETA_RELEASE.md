# Publishing a GritMap Karoo beta

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
2. Commit and verify the exact release source.
3. Create an annotated tag matching the version exactly:

   ```bash
   git tag -a karoo-beta-0.10.43 -m "GritMap Karoo 0.10.43 beta"
   git push origin main karoo-beta-0.10.43
   ```

4. Watch **Actions > Karoo beta release**. A successful run creates a release containing:
   `gritmap-karoo.apk` and `SHA256SUMS.txt`.
5. Test the public asset through Hammerhead Companion on a Karoo 3 before inviting testers.

The fixed asset name supports a stable download URL:

`https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`

Do not move to a new signing identity after beta testers install the app. Android treats a different
certificate as a different publisher and refuses an in-place update.
