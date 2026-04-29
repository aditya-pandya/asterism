# Worklist

## Summary

- Project: Inkdown
- Goal: Estimate engineering effort, calendar time, and US-market replacement cost for the current repo.
- Owner: Codex
- Last updated: 2026-03-18

## Tickets

### T1 - Size the codebase and identify complexity drivers

- Status: Done
- Why it matters: A credible estimate depends on separating product code from generated assets and understanding where the real implementation complexity lives.
- Scope / likely files: `README.md`, `package.json`, `index.html`, `styles.css`, `app.js`, `electron/`, `assets/`, `vendor/`
- Acceptance criteria: Core product files are inventoried, code buckets are quantified, and notable integrations or polish areas are captured.
- Verification: Inventoried 6,340 lines of authored app code across `index.html`, `styles.css`, `app.js`, `electron/main.js`, `electron/preload.js`, and `clear-storage.html`; excluded 2,374 vendored lines in `vendor/` and 119 generated files in `dist/`. Confirmed core complexity drivers include custom conversion rules, sanitization, local persistence, premium theming, and Electron file/menu integration.
- Follow-ups / residual risk: Pre-repo design exploration and discarded iterations are not visible in the repo and may understate total effort.

### T2 - Convert complexity into hours and cost scenarios

- Status: Done
- Why it matters: The user needs a practical low/base/high estimate rather than raw code metrics.
- Scope / likely files: `WORKLIST.md`, working notes from T1
- Acceptance criteria: Low, base, and high scenarios cover engineering-only cost, fully loaded cost, and calendar time with assumptions.
- Verification: Built scenario ranges using subsystem buckets for UI/design system, conversion engine, desktop packaging, and polish/QA. Estimates checked against repo scope, absence of backend work, and current feature set.
- Follow-ups / residual risk: Scope expands materially if cross-platform desktop support, notarization/release ops, collaboration, sync, or formal accessibility/compliance work are required.

### T3 - Ground the estimate in current US rates

- Status: Done
- Why it matters: Dollar estimates should reflect current market pricing rather than stale memory.
- Scope / likely files: External market-rate sources referenced in final estimate
- Acceptance criteria: Current US contractor and salary-equivalent references are cited with date context and applied transparently.
- Verification: Used recent BLS pay data plus BLS employer-cost data, then cross-checked against current marketplace contractor ranges from Upwork and Arc.
- Follow-ups / residual risk: Marketplace rates skew toward platform-specific supply, while salaried benchmarks understate short-term contract pricing and utilization risk.

### T4 - Reframe the estimate for buyer, agency, and AI-assisted solo scenarios

- Status: Done
- Why it matters: Different audiences use different pricing models, so a single engineering-cost range is not enough.
- Scope / likely files: `WORKLIST.md`, prior estimate notes
- Acceptance criteria: Buyer-price, agency-quote, and AI-assisted solo ranges are derived from the repo scope and current rate assumptions.
- Verification: Scenario math is consistent with the previously estimated hour ranges and distinguishes build cost from acquisition value.
- Follow-ups / residual risk: Buyer pricing is the least precise because repos like this are usually priced on traction, distribution, and brand, not rebuild cost alone.

## Working Notes

- Use `Todo`, `In Progress`, `Blocked`, and `Done`.
- Move only one ticket to `In Progress` at a time unless the user asks for parallel work.
- Do not mark a ticket `Done` until verification is recorded.
- Add newly discovered issues as new tickets instead of hiding them inside another item.
