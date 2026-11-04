# Karoo screenshot pack — 2026-11-04

108 PNG previews exported directly from native Android renderers using synthetic test data, runtime source `6c5d472`. These are field-only renderings, not photographs or on-device captures. They do not establish installation, outdoor readability or release availability.

The root README can now be updated using these files. Keep a visible **development preview — synthetic data** caption, add GM Recent Segments, and distinguish the local uninstalled code from the public beta. The old root README assets were left unchanged for its owner to replace. Device screenshots can replace these after an approved install.

| Field / state | Large 480×620 | Compact 240×120 |
|---|---|---|
| Pacing Coach / Pacing Profile | [Dark](pacing-dark-480x620.png) / [Light](pacing-light-480x620.png) | [Dark](pacing-dark-240x120.png) / [Light](pacing-light-240x120.png) |
| Segment Performance | [Dark](performance-dark-480x620.png) / [Light](performance-light-480x620.png) | [Dark](performance-dark-240x120.png) / [Light](performance-light-240x120.png) |
| Power Balance | [Dark](balance-dark-480x620.png) / [Light](balance-light-480x620.png) | [Dark](balance-dark-240x120.png) / [Light](balance-light-240x120.png) |
| Cardiac Drift | [Dark](drift-dark-480x620.png) / [Light](drift-light-480x620.png) | [Dark](drift-dark-240x120.png) / [Light](drift-light-240x120.png) |
| Cardiac baseline countdown | [Dark](drift-countdown-dark-480x620.png) / [Light](drift-countdown-light-480x620.png) | [Dark](drift-countdown-dark-240x120.png) / [Light](drift-countdown-light-240x120.png) |
| H10 Cardiac | [Dark](h10-dark-480x620.png) / [Light](h10-light-480x620.png) | [Dark](h10-dark-240x120.png) / [Light](h10-light-240x120.png) |
| Recent Segments — half highlight | [Dark](recent-highlight-half-dark-480x620.png) / [Light](recent-highlight-half-light-480x620.png) | [Dark](recent-highlight-half-dark-240x120.png) / [Light](recent-highlight-half-light-240x120.png) |
| Recent Segments — full highlight | [Dark](recent-highlight-full-dark-480x620.png) / [Light](recent-highlight-full-light-480x620.png) | [Dark](recent-highlight-full-dark-240x120.png) / [Light](recent-highlight-full-light-240x120.png) |
| Recent Segments — normal list | [Dark](recent-three-dark-480x620.png) / [Light](recent-three-light-480x620.png) | [Dark](recent-three-dark-240x120.png) / [Light](recent-three-light-240x120.png) |

Every row also has 240×620, 480×200, 240×320 and 480×120 files in both themes. `manifest.json` records exact dimensions and SHA-256 for all PNGs.

Pacing Coach and Pacing Profile currently use the same `GlanceField.PACING` renderer, so one shared image set represents both registered fields. Do not use the older work-fill/road renderer test images to describe this source. The text-only Target Power, Power Delta, Predicted Finish and Watts/HR fields are not included in this graphical pack.

Recent Segments: a 30-second bar drains from full to empty after completion; the saved result remains in the list. Full/half/normal images are static snapshots, not an animation. Cardiac baseline countdown is eligible sample time and is separate from this result-highlight timer. H10 uses its existing dashboard for tall layouts and compact renderer for shorter layouts.

## Reproduce

From the Karoo worktree, with JDK17 and Android SDK configured:

```sh
apps/karoo/gradlew -p apps/karoo :app:testDebugUnitTest \
  --tests com.gritmap.karoo.ui.GlanceFieldsTest \
  --tests com.gritmap.karoo.ui.RecentSegmentsRendererTest \
  --tests com.gritmap.karoo.ui.H10CardiacBitmapRendererTest \
  -PgritmapVersionCode=78 -PgritmapVersionName=0.10.48-recent-results-preview \
  --max-workers=2 --no-daemon
```

Generated originals are in `apps/karoo/app/build/reports/karoo-{glance,cardiac-countdown,recent-results,h10}`. This pack selects normal glance state0, countdown, and three recent-result states. Screenshot export support is in H10CardiacBitmapRendererTest; no app runtime changed to create this pack.
