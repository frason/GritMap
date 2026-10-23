# Handoff: test FIT inspected; RR storage and export distinguished

- Updated: `2026-10-23 15:53 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `f5964c7 docs: confirm H10 test ride capture saved`
- Worktree: documentation-only changes to LATEST, this archive and physical acceptance notes

## Outcome

H10 RR capture does save locally on the Karoo. Test ride finalization logged 624 RR samples. What is missing is a supported recording list/export/transfer path to retrieve those samples in the phone app or an analysis tool. The standard ride FIT does not carry those RR samples.

## Changed

- Documentation only; candidate source be98b8d and installed code71 unchanged.
- No user ride file or raw health/GPS data copied into Git.

## Verified

- Prior ADB evidence: 2026-10-23 14:57:37.813, h10_capture_saved reason=ride-ended samples=624, immediately after ride Idle.
- Read user-supplied local FIT (8,928 bytes) using a read-only Python FIT definition/data-message decoder; parsed data section exactly to byte8926 (remaining2 bytes are file CRC). CRC was not independently validated.
- FIT message counts: record20=217; session18=1; lap19=1; event21=46; device_info23=2; field_description206=20; developer_data_id207=2; file_id0=1; sport12=1; activity34=1.
- Standard record heart rate:217 valid readings,54–62 bpm. Session reported average57/max62 bpm, elapsed571s (9:31), timer215s (3:35).
- No HRV message78, no record power field7. Actual developer fields on record messages: W_Prime_Balance, W_Prime_Percent, Pacing_Status, Target_Power (each217 occurrences). No RR/RMSSD/SDNN/DFA field definitions found.
- Earlier diagnostic snapshot60 RR samples/100% validity is not a full-capture quality result. Raw624-sample artifact, final validity, continuity, duration and checksum remain uninspected.
- No source tests/build rerun for documentation-only changes; previous250-test/lint/signed-beta QA remains applicable.

## External state

- User FIT remains outside repository in Downloads; not committed or uploaded.
- Karoo installed0.10.45-bluetooth-beta/code71; phone internal build5 reported. No new installation, tag or publication.

## Goal alignment

- GOALS priority1 remains public Bluetooth beta before replanner/H10 export expansion. Karoo owns sensor capture; phone owns post-ride analysis. Future RR transfer needs a versioned shared contract and phone coordination.

## Hazards and blockers

- Save event confirms app-reported finalization, not independent raw-file integrity. Non-debuggable beta keeps artifacts app-private. Preserve app data; no uninstall/clear-data to retrieve files.
- In-ride transfer coexistence owner-waived, not passed; send before recording.
- Deliberate disconnect/resume gate remains pending before wide invites. Exact tag/publication approval remains separate.
- H10 recording list/export and phone ingestion remain unfinished; native FIT sharing cannot substitute for them.

## Next safe action

Complete deliberate disconnect/resume physical acceptance with a synthetic150–250KiB missing segment, phone foregrounded and no ride recording. Verify last-completed-offset resume, same ownership, exact-byte hashes, one atomic import and success receipt. Then seek exact release approval. H10 export follows the Bluetooth release unless Jason reprioritizes it.
