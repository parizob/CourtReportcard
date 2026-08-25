# User Finds (highlight list) — v1

## Goal
Let reporters capture errors the software missed while reading the transcript, without editing the transcript in Court Reportcard. Finds are a personal punch list (page, line, quote, optional note) they take back to CAT.

## Non-goals
- Applying finds to `originalText` / export transcript
- Full in-app editing
- Entries-only view (requires `originalText` for reliable page/line)
- Settings toggle for this feature

## Data
Stored on the case extracted JSON (same file as annotations):

```json
"userFinds": [
  {
    "id": 1,
    "page": "12",
    "line": "8",
    "text": "word ,",
    "note": "change comma to period",
    "created_at": "2026-08-24T23:00:00.000Z"
  }
]
```

- `page` / `line`: best-effort from original-text view (`pageNum` on page group; line number from gutter / position within page when available). If unknown, omit or use `null` and still store `text`.
- `note`: optional string
- Persist via existing editor save path (`enqueueCaseReviewSave` / extracted blob)
- Never mutate transcript text on Accept of software flags

## Editor UX (original-text view only)
1. User selects text in the transcript pane
2. Floating action: **Add to my finds**
3. Optional note field (can skip)
4. Confirm → append to `userFinds`, mark unsaved / trigger same persist as annotations
5. Panel section **My finds**: list with page/line, quote, note; jump to location; edit note; remove
6. If no `originalText`, hide add affordance (show brief empty hint if needed)

## Dashboard files modal
When `userFinds.length > 0`, show a row under Uploaded Files:
- Label: **My finds**
- Meta: `N find(s)`
- **Download** → `.txt` punch list

Example download body:
```
Page 12, Line 8
"word ,"
Note: change comma to period

---

Page 15, Line 3
"teh"
Note: the
```

## Implementation notes
- Selection → map DOM range to `cleanContent` offset → `parsedLines` → page/line
- IDs: max existing `userFinds.id` + 1
- Download filename: `{caseName}_finds.txt`
- No new DB table for v1

## Success
- Highlight → add with/without note → survives refresh
- Download from editor and from dashboard modal
- Software Accept/export path unchanged
