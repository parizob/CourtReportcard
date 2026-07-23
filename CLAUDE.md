# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Project Invariant (Court Reportcard): Accepted Corrections Must Always Reach Export

**An annotation the user accepts must always be reflected in every downstream representation, including the exported .txt/.rtf/.json. This can never diverge. It is the entire purpose of the product, not a nice-to-have.**

The whole premise of Court Reportcard is: a reporter reviews flagged errors, accepts the real ones, and gets back a transcript with those corrections actually applied. If the internal working data (`entries`, used for editing and export) and the visual transcript pane (`originalText`/`cleanContent`) can ever diverge, an annotation could show as "accepted" in the UI while the correction is silently missing from the file the user actually downloads and files with the court. That is worse than any UI bug, it produces a document the user believes is corrected when it isn't, defeating the reason the product exists.

`acceptAnnotation`, `applyCorrectionDetailed`, `fixAnnotationPositions`, and the export path (`src/lib/gemini.js`, `src/pages/dashboard/DashboardEditor.jsx`) all touch this. Any change to these must preserve the invariant. If a text-matching search used to apply a correction can fail (e.g., `flexFind` not finding the flagged text in `cleanContent`), that failure must be surfaced loudly, logged at minimum, and ideally blocking or flagging the export, never left to silently drop the correction from one representation while the UI still reports it as accepted.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
