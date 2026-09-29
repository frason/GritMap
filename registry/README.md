# Segment registry

Published, immutable segment definitions — reference polyline and matching parameters
only, never ride data, attempts, or anything personal. Each file is named by its content
fingerprint (`segments/<fingerprint>.json`), matching the same portable JSON schema used
to send a segment to a Karoo (see `src/segments/toPortableSegmentJson.ts`).

Published and read by the app itself via `src/registry/registryClient.ts` — see
`docs/SEGMENT_REGISTRY.md` for why this repo (rather than a hosted backend) is the
registry, and how publish/discover/import actually work.
