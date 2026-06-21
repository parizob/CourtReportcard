# User Feedback Log

Real feedback received from real users during beta (June 2026).
Update this file whenever a user reports a bug, request, or compliment.

## Feedback Received

### User: Veronica (scopist/proofreader)
**Channel:** Email
**Feedback:**
- Asked whether the tool flags missing structural sections (certificate page,
  appearances, index) and missing notations (recess, off-the-record).
- Confirmed interest in a completeness checklist feature.
**Status:** Added to roadmap as confirmed user request. Not yet built.

### User: First email respondent (court reporter, Eclipse user)
**Channel:** Email reply to low-token outreach campaign
**Feedback:**
- Found the tool "extremely helpful"
- Issue: after accepting corrections, pasting the corrected transcript into
  Eclipse included the embedded line numbers, breaking Eclipse's formatting.
  Had to manually re-apply each correction in Eclipse.
- Issue: could not find a way to buy more credits.
**Action taken:**
- Added "copy without line numbers" clean export option (shipped)
- Added clearer messaging about requesting credits via email
- Asked follow-up questions about workflow (paste vs. reimport, file type)
**Open question:** Is she trying to reimport the whole file into Eclipse, or
just paste individual corrections? Answer changes what we build.

### User: Previous user (file type unknown)
**Channel:** Email
**Feedback:**
- Received error after uploading a 49 page transcript telling her to break
  up the transcript and reupload.
- Was NOT refunded the credits consumed before the error.
**Action taken:**
- Token refund on failed uploads shipped
- Manual credit refund issued to this user
**Notes:** Error message said to "break up the transcript further" — unclear
if this was a file size issue or something else. Worth investigating.

### User: Edwin Lawson
**Channel:** Email
**Feedback:**
- Got "insufficient tokens" error on upload.
- File turned out to be 123 pages long (over the 50-token free allocation).
**Action taken:**
- Topped up to 150 tokens so he can upload the full file
- Clarified 1 token per page in response
**Status:** Pending — waiting to hear if upload succeeds.

### User: Unknown (token confusion)
**Channel:** Email
**Feedback:**
- "Tried loading the file but insufficient tokens. What next I think I need
  some help."
- Had 50 tokens but was confused by the error message.
**Action taken:**
- Clarified 1 token per page
- Asked if file was over 50 pages or if error occurred on a shorter file
**Notes:** Error message needs to say "1 token per page, your file needs X
tokens, you have Y" rather than a generic insufficient tokens message.

## Patterns So Far

1. **Token confusion is common.** Users do not understand 1 token = 1 page
   until they hit the wall. The error message needs to be more explicit.
2. **Eclipse paste issue is real.** At least one user hit it immediately.
   Clean export is shipped but we do not know yet if it solves her workflow.
3. **Credits/buying is unclear.** Multiple users tried to buy more and
   could not. Need clearer "reach out" CTA or eventual purchase flow.
4. **Positive signal exists.** "Extremely helpful" is a strong first response.
   Users who get past upload friction seem to find value.

## Outreach Campaigns

**Low-token email (June 2026)**
Sent to users with balance under 10. Asked for feedback, offered 100 tokens
for a reply. Response rate: very fast (8 minutes from first send). Quality
of feedback high. Recommend repeating monthly during beta.
