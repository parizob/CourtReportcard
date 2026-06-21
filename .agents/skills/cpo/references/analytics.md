# Analytics (CAO Sub-Skill)

How to measure what is working. All data lives in Supabase.

## Key Tables

| Table | What It Tells You |
|---|---|
| `auth.users` | Total signups, last sign-in, email verified or not |
| `user_profiles` | Token balance, plan, plan renewal date |
| `token_ledger` | Full history of token spend/grant per user |
| `cases` | Every transcript uploaded, status (processing/reviewed/etc.) |
| `case_metrics` | Per-transcript: total issues found, accepted, ignored, open, custom edits |
| `case_files` | Raw and extracted files stored in Supabase Storage |

## Signal Metrics (what actually matters)

**Activation rate**
Users who signed up AND uploaded at least one transcript.
Currently: ~6 real uploads out of 20 logged-in users = ~30%.
A healthy activation rate is 50%+. Below 30% means the signup-to-upload
funnel has friction (onboarding, token confusion, unclear value prop).

```sql
select count(distinct user_id) as uploaders
from cases;
```

**Upload success rate**
Of transcripts attempted, how many completed without error?
```sql
select
  status,
  count(*) as total
from cases
group by status;
```

**Engagement depth**
Of users who uploaded, how many accepted at least one correction?
```sql
select count(distinct c.user_id) as engaged_users
from cases c
join case_metrics m on m.case_id = c.id
where m.accepted > 0;
```

**Token consumption vs. grants**
Are users burning through tokens (engaged) or sitting on them (not using it)?
```sql
select
  type,
  sum(amount) as total
from token_ledger
group by type;
```

**Per-user token history**
Useful for manual top-up decisions and spotting power users.
```sql
select
  user_id,
  sum(case when amount > 0 then amount else 0 end) as total_granted,
  sum(case when amount < 0 then abs(amount) else 0 end) as total_spent,
  sum(amount) as current_balance
from token_ledger
group by user_id
order by total_spent desc;
```

**Users who never uploaded (friction candidates)**
These are the 9 who never authenticated + logged-in users who never uploaded.
Good targets for a reachout email.
```sql
select u.email, u.created_at, p.balance
from auth.users u
join user_profiles p on p.user_id = u.id
where u.id not in (select distinct user_id from cases);
```

**Issue acceptance rate**
Of all suggestions made, what % do users accept vs. ignore?
High ignore rate = too many false positives or irrelevant suggestions.
```sql
select
  sum(accepted) as total_accepted,
  sum(ignored) as total_ignored,
  sum(open) as total_open,
  round(sum(accepted)::numeric / nullif(sum(total_issues), 0) * 100, 1) as acceptance_rate_pct
from case_metrics;
```

## Red Flags to Watch For

- **Activation rate drops below 20%** — onboarding or token messaging broken
- **Upload success rate drops** — pipeline or file size issue
- **Acceptance rate below 50%** — too many false positives, check the prompt
- **Token spend with no accepted corrections** — users running pipeline but
  not finding value; investigate with a direct outreach
- **Multiple refund events for same user** — repeated upload failures,
  investigate their file type/size

## Current Snapshot (June 2026)

- 29 signups
- 20 logged in (69% email verification rate)
- 9 never authenticated (email verification drop-off likely)
- 8 uploaded at least one file (6 real users, 2 are Brandon + Zoe)
- Activation rate: ~30% of logged-in users
- Feedback received: 4-5 direct email replies with actionable feedback
- Known issues resolved: token refund on failure, background processing,
  clean export (no line numbers)
