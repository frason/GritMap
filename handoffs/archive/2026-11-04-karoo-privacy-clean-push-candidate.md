# Privacy-clean Karoo push candidate prepared; confirmation still required

- Updated: `2026-11-04 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before this documentation: `54d7554 docs(handoff): mark Karoo previews ready and separate liked-segments ownership`
- Worktree: cleaned candidate committed locally; this documentation commit follows. No push performed.

## Outcome

The owner explicitly approved preparing a privacy-clean candidate after reviewing the pre-push inventory. Preserved the original unpublished history under a private local backup ref, then rebuilt the13 unpublished commits on remote base382c759 with neutral author/committer identity `GritMap contributor <contributor@localhost>`. This is authorized cleanup of unpublished history, including archived documents; published remote history and older archives are untouched. Local backup must never be pushed.

Removed personal name references, identifying local usernames, device serial and private-recording findings from the candidate's documentation history. Replaced ephemeral analysis/artifact locations with generic placeholders; private recordings, reports and measurements remain outside Git. Generic /Users/USER examples are placeholders, not actual personal paths. Public notes retain source reasoning, synthetic controls and verification limits.

## Changed

13 local commits have new IDs; prior local commit IDs are superseded. Clean runtime references: cardiac countdown6e183d0; Recent Segments7ca657d; result highlight6c5d472; screenshot packa498e17. Private old-to-new mapping retained locally, not committed. Documentation and preview provenance manifest updated to matching cleaned IDs. Screenshot PNGs and all apps/karoo runtime, schema, resource and test bytes are unchanged from the prior candidate at every paired commit.

This handoff adds the14th candidate commit. Exact final commit/file inventory and scan report are provided separately for the owner's review before pushing; those local audit files are not added to Git.

## Verified

Scanned all newly reachable blob versions, added lines, raw commit metadata/messages, filenames and PNG chunks. No original personal author/committer identity, name/email content, device serial, coordinate-pair data, FIT/GPX files, private analysis artifacts, credential/token values or signing-key files detected in the cleaned candidate. Automated matching is heuristic; manual review confirmed remaining local-path matches are generic /Users/USER examples. Confirmed byte-identical apps/karoo and PNGs for each of13 original/cleaned commit pairs. All108 screenshot hashes match their manifest. No app tests rerun for metadata/documentation-only sanitization; previous runtime tests/lint/build and15 screenshot checks remain recorded in earlier notes. git diff --check clean.

## External state

No push, force-push, main update, installation, device query, signing change, release, deployment or cross-session message. Last observed device76/Room4 unchanged. Root README was subsequently updated by the coordinator on main with synthetic previews; liked-segments ownership remains with the other session.

## Goal alignment

Protects personal information while preparing the already-approved Karoo source/documentation for review. No wire contract or runtime behavior changed.

## Hazards and blockers

Remote base contains existing published history; this cleanup only changes unpublished descendants. Original sensitive history exists solely in the local backup and must not be pushed with --all or --mirror. Use an explicit single-branch refspec only after the owner confirms the revised exact head/inventory. No force push is needed because the new candidate descends from the unchanged remote base. A future Room5 install still requires a new persistent-beta candidate and exact installation approval; no downgrade/data-clear workaround.

## Next safe action

Show the owner the final revised commit/file inventory and scan result, then await explicit confirmation to push only codex/karoo-screen-redesign. Do not push during preparation. Read-only map and reverse-Bluetooth feasibility reviews remain separate queued documentation work.
