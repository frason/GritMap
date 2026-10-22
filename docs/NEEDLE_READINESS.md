# Needle readiness for live pacing

Checked 2026-10-22. **Needle does not run on the installed Karoo.** Deterministic live replanning is independent and must ship first.

## What exists locally

`NeedleAgentManager`, `NeedleLivePacingGuidanceEngine`, the JNI bridge and validation/fallback tests exist. The bridge dynamically opens `libcactus_engine.so` and expects `cactus_init`, `cactus_complete`, `cactus_destroy`, with a model bundle directory. Neither that runtime nor a pinned model bundle/digest is shipped. `MODEL_PROVENANCE.md` still contains distribution blockers. Existing model responses replace whole plans; that is not the desired bounded advisory interface. While deterministic replanning is enabled, these legacy replacement callbacks are bypassed.

## Upstream compatibility finding

The official [Needle 2 model card](https://huggingface.co/Cactus-Compute/needle2/blob/main/README.md) describes a self-contained model/engine with tool-call JSON output, rather than the Cactus-v2 bundle ABI expected by our bridge. Its [Android ARM64 directory](https://huggingface.co/Cactus-Compute/needle2/tree/main/android-arm64) lists `libneedle.a` (~20.7 MB), `needle` (~14.8 MB), and `needle.h`. The model card advertises ~28 MB session RAM; this is an upstream claim, not a Karoo measurement. The [current Needle repository](https://github.com/cactus-compute/needle) also documents Needle 3, so pinning an exact generation/revision is essential. No artifact has been downloaded, hashed, licensed for redistribution, or executed by this milestone.

**Closest fit:** a tiny tool selector for a bounded cue/adjustment suggestion, fed deterministic power trend and fade summaries. These models' tool/extraction claims do not establish physiological forecasting skill. Do not trust an unvalidated model to infer sustainable power from raw cycling telemetry. The deterministic engine must clamp any optional suggestion and retain a silent fallback.

## Needed before a rider can use it

1. Select the exact generation and immutable ARM64 artifact revision; record SHA-256 for every shipped binary/model/header and verify engine/model licence terms (upstream model card labels Apache-2.0; packaged notices and component licences still require review).
2. Choose a compatible deployment: adapt JNI to the official Needle static C API, or select an actual Cactus-compatible bundle and pinned `libcactus_engine.so`. The current files cannot simply be renamed to fit the existing ABI.
3. Package verified assets/native libraries with offline installation and atomic updates in app-private storage. No fabricated digest; preserve existing rider data. Keep distribution provenance in `MODEL_PROVENANCE.md`.
4. Add a strictly bounded advisory schema (suggested watts/cue/confidence), a real inference deadline, serialized native calls, and validation against ceilings/steps/energy. Do not reuse whole-plan replacement as authority.
5. Benchmark on the Karoo 3: cold init, inference p50/p95 and timeout, peak RSS, APK/storage size, native ABI compatibility, battery and sensor continuity on an actual ride. No Karoo latency number is known today; retain the 5-second upper deadline and reject slow output.

Engineering estimate (judgment, not benchmark): 1–2 days for an ABI/packaging proof and device benchmark, then 2–4 additional days for advisory integration and replay/failure testing if the selected API is compatible. Field validation is additional and can reveal that the model adds no useful signal. No automatic H10-driven pacing is included.
