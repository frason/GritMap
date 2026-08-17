# Model and runtime provenance

The application integration targets the open-source Cactus Android runtime and Needle 2.
Distribution is blocked until a concrete upstream model artifact is selected and these
fields are replaced with verified values:

- Cactus source: https://github.com/cactus-compute/cactus
- Cactus runtime tag: `v2.0.1`
- Cactus runtime commit: `7e7eada40c387736dec138db003ab38f028f3a15`
- Native Android library name: `libcactus_engine.so`
- Needle source: https://github.com/cactus-compute/needle
- Model filename/format: **PIN BEFORE DISTRIBUTION**
- Model SHA-256: **PIN BEFORE DISTRIBUTION**
- Runtime license: verify upstream license at the pinned revision
- Model license: verify upstream model-card license at the pinned revision

The build contains no fabricated model weights. Cactus v2 expects a model bundle directory,
not one opaque 14 MB file; selecting the actual Needle bundle, archive digest, model-card
license, and extraction/installation packaging remains an explicit distribution blocker.
`NeedleAgentManager` refuses to initialize a missing or unreadable model bundle, and artifact
installation rejects any digest different from its configured digest.
