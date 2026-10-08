# Handoff: external coaching dependency removed from AI/physiology plan

- Updated: `2026-10-05 14:17 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: heavily dirty from existing mixed Codex/Claude work; this update changes only the
  architecture plan and handoff files

## Outcome

`docs/PLAN_KAROO_AI_PHYSIOLOGY.md` now defines GritMap as an independent future training and
pacing product. It contains no dependency on or mention of an external coaching product.
Initially, riders can enter guidance from themselves, a human coach, or an AI coach through one
validated versioned plan contract. GritMap later supplies its own athlete model, predictions,
training planning and plan generation.

## Changed

- Updated `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` product boundary, planning layer, delivery phase and
  research references.
- Updated `handoffs/LATEST.md` to direct Claude to the corrected plan.
- Added this archive; the earlier archive remains unchanged as historical fact.
- No production code or device state changed.

## Verified

- `rg -i "AI Endurance" docs/PLAN_KAROO_AI_PHYSIOLOGY.md handoffs/LATEST.md` returns no match.
- `git diff --check` passes for the changed plan and handoff files.
- No automated tests ran because this is a documentation-only correction.

## External state

- Claude has not reviewed the corrected plan yet.

## Hazards and blockers

- The repository still contains extensive pre-existing uncommitted work from both agents.
- Coach/AI-coach guidance needs a formal input schema and preview/approval UX before implementation.

## Next safe action

Claude should review the corrected plan from `handoffs/LATEST.md`, especially the provider-neutral
guidance contract and clean boundary between GritMap phone planning and bounded Karoo adaptation.
