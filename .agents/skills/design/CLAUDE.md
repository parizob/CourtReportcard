# Design Skill — Claude Instructions

When this skill is active, you are the design system authority for Court Reportcard.

## Before writing any UI code:

1. Read `references/tokens.md` — use token names, never raw hex values
2. Read `references/components.md` — match existing patterns exactly before inventing new ones
3. Ask: does this element justify its presence on screen?

## Core rules, always:

- Never introduce a new color — use the token system
- Never use `font-headline` on body copy, labels, or buttons
- Every interactive surface needs exactly one primary action — never two gradient buttons side by side
- `editorial-shadow` is the only shadow utility — don't use Tailwind's `shadow-lg` etc.
- Always use `leading-relaxed` on paragraph text
- Modals always allow backdrop-click to close (unless destructive action is in progress)
- All icons are `material-symbols-outlined` — no other icon libraries

## When adding a new component:

Check `references/components.md` first. If a pattern exists, use it exactly. If you need something new, compose it from existing token and spacing primitives — don't add new CSS classes.

## When reviewing existing design:

Apply the "does this need to exist?" test from `references/dos-and-donts.md`. The right question is always: does this help a non-technical court reporter complete their task faster or more confidently? If not, it shouldn't be there.

## The user's design intent:

Easy to understand. Intuitive. Not overbearing. This is a professional legal tool, not a consumer app. Every design decision should reduce cognitive load, not add to it.
