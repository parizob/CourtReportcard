# Product Roadmap

Source of truth is `TODO.md` at the project root. This file adds prioritization
context and rationale that the raw checklist does not capture.

## Prioritization Framework

Stack-rank open items by:
1. **Blocking** — users cannot complete their core task
2. **Trust-degrading** — bugs or gaps that make the product feel broken or unsafe
3. **Growth-limiting** — things stopping new users from activating or returning
4. **Monetization-gating** — must exist before charging money
5. **Nice to have** — confirmed value but not urgent

## Open Items (as of June 2026)

### High priority

**Parizo Labs LLC / DBA setup**
Priority: monetization-gating. Nothing that involves charging money can ship
until this exists. Should happen in parallel with product work, not after.

**Completeness checklist (Veronica's request)**
Flag if standard sections are missing: certificate page, appearances, index,
recess/off-the-record notations. This is a confirmed user request. Moderate
build — requires structural awareness of transcript format.

**Survey popup after key action**
Trigger after download or first accepted correction. Low build effort, high
signal value. This is the feedback loop the product needs right now.

### Medium priority

**NOD / style guide / pleadings / exhibits upload**
Let reporters upload supporting documents so the tool can check against
case-specific names, terms, and spellings. Meaningful build but high value
for accuracy. Confirmed pain (mismatched names are a real reporter problem).

**Perfect transcript celebration**
Fun moment + bonus tokens when a transcript comes back with zero issues.
Needs UID per document to prevent gaming. Low urgency but good for retention
and word-of-mouth.

### Low priority / validate before building

**Stenographer dictionary upload**
Let reporters upload their personal steno dictionaries so the tool stops
flagging intentional briefs. Good idea in theory but no user has complained
about false positives from steno briefs yet. Ask Zoe first.

**Address lookup / verification**
Identify addresses in transcripts and verify them. Interesting but far from
the core loop. No user has asked for this.

**Audio diff feature**
Upload audio alongside transcript, transcribe it, diff against written
transcript. Powerful but very large build. Table until the core product is
proven and paying.

## Pre-Launch Checklist

Before flipping from free beta to paid:
- [ ] Parizo Labs LLC set up with DBA Court Reportcard
- [ ] Payment flow for token purchases
- [ ] Clear pricing page
- [ ] Better onboarding (explain 1 token per page before they run out)
- [ ] Token balance shown prominently and updated in real time
- [ ] Error messages that explain what happened in plain language

## Competitive Context

BlueEyes by On The Record (OnTheRecord.tech) launched around the same time.
They charge $0.05/page with credits bundled in subscription plans and offer
double credits for a limited time. They are integrated into the On The Record
platform (invoicing, bookkeeping, collaboration).

Court Reportcard's edge: standalone, no subscription required, personal
service, founder replies to every email. Do not try to out-feature them.
Win on trust, precision, and responsiveness.
