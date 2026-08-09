---
name: ceo-checklist
description: A running list of things Brandon wants periodically checked on/investigated in Court Reportcard, so he can ask a general "how are we doing" / "check on the business" question and get these looked at without having to re-specify them each time. Use this whenever Brandon asks for a business/product health check, a status update, "how's everything looking," or explicitly says "run the CEO checklist" or similar. Also consult this list when he says "add this to the CEO list" or "add this to the things you check" — append the new item to the Checklist section below rather than treating it as a one-off task.
---

# CEO Checklist

A standing list of things to look into when Brandon checks in, not necessarily fixes to make on the spot, but things to actually go look at and report back on with real numbers/findings, not a restatement of the question.

When invoked for a check-in, go through each item below, pull the real data, and report findings plainly (numbers + what they mean), flagging anything that looks off rather than just confirming everything's fine.

## Checklist

- **Bare annotation arrays / dropped annotations.** Periodically check how many cases come back with an empty (bare) annotations array, and how many have a non-zero `dropped_annotations_count` (see `supabase/migrations/20260708130000_add_dropped_annotations_count.sql`). For both, look deeper into *why*: is it a genuinely clean transcript, a parsing/text-matching failure (e.g. `flexFind` not locating flagged text), a truncated/failed Gemini response, or something else? Per the Project Invariant in `CLAUDE.md`, a dropped correction must never be silent, so any pattern here is worth surfacing, not just counting.

- **Upload-to-download completion rate.** Check how many users who upload a transcript actually make it through to clicking download/export at the end (see `DashboardExport.jsx`'s `export_txt`/`export_rtf`/etc. tracking, and case status in the `cases` table). A low completion rate suggests friction or a bug somewhere in the accept/review flow that's stopping people before they get value, worth knowing even if nothing's visibly broken.

<!-- Add new items above this line as Brandon asks for more things to be tracked. Keep each item as: what to check, where the data lives, and why it matters. -->
