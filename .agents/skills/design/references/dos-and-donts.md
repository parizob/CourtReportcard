# Design Dos and Don'ts

## Information Density

**Do:** Show only what the user needs for the current task. Use progressive disclosure — tooltips, collapsed sections, secondary panels — for everything else.

**Don't:** Put more than one "primary" action on a screen. Don't show advanced options by default. Don't add stats or metrics just because they exist — only show them if the user can act on them.

**Why:** Court reporters use this tool mid-job, often under deadline pressure. Cognitive load is the enemy.

---

## Color

**Do:** Use the token system as designed. `primary` is for the single most important interactive element on a surface. `on-surface-variant` is for supporting text.

**Don't:** Use `text-primary` for body copy. Don't use raw hex values. Don't introduce new colors — every new color needs a reason and a token. Don't use amber (`tertiary-fixed-dim`) for anything other than upgrade CTAs and "early access" indicators — it's a reserved signal.

**Don't:** Mix surface levels incorrectly. A card (`surface-container-lowest`) must always sit on a darker background (`surface-container-low` or `background`). Reversing this creates visual confusion.

---

## Typography

**Do:** Use `font-headline` (Manrope) only for display text, section headings, and stat numbers. Use `leading-relaxed` on all paragraph text.

**Don't:** Use `font-headline` on labels, buttons, captions, or body copy. Don't use ALL CAPS for anything other than section labels and table headers with wide letter-spacing. Don't use more than two type sizes in a single card.

---

## Buttons

**Do:** Use the gradient primary button for the single most important action. Use the outline button for secondary actions. Use ghost/text buttons for tertiary actions (refresh, cancel).

**Don't:** Put two primary (gradient) buttons next to each other. Don't add icons to buttons unless they meaningfully clarify the action. Don't use custom button colors — use the defined variants.

---

## Whitespace

**Do:** Let sections breathe. Use `py-16 sm:py-24` for major page sections. Generous internal padding (`p-8` or more) in cards that contain important content.

**Don't:** Pack content to fill available space. Don't add content to justify whitespace — if a section feels empty, question whether it should exist, not how to fill it.

---

## Modals

**Do:** Keep modals focused on a single decision or action. Always allow backdrop click to dismiss (unless a destructive in-progress action blocks it). Always include a clear Cancel path.

**Don't:** Put multiple unrelated actions in one modal. Don't use modals for informational content that could live inline. Don't nest modals.

---

## Icons

**Do:** Use Material Symbols Outlined consistently. Use icon containers (`w-11 h-11 rounded-lg`) for decorative/section icons. Use bare icons (`text-lg`, `text-on-surface-variant`) for inline action buttons.

**Don't:** Mix icon libraries. Don't use icons without a label unless the action is absolutely unambiguous (search, close). Don't scale icons above `text-4xl` outside of empty state illustrations.

---

## Animations

**Do:** Use the existing utilities: `page-rise` for page transitions, `hover:translate-y-[-4px]` for interactive card lift, `hover:scale-[1.02]` for CTA buttons, `animate-spin` for loading spinners.

**Don't:** Add new animations without a clear functional reason. Don't animate decorative elements that the user will see repeatedly — it becomes noise. Don't use animations that delay the user's ability to interact with content.

---

## The "does this need to exist?" test

Before adding any new UI element, ask:
1. Will the user understand what this is without explanation?
2. Does seeing this help them complete their task faster or more confidently?
3. If this wasn't here, would anyone notice?

If the answer to #3 is no, don't add it.

---

## This audience specifically

Court reporters are professionals, not power users of software. Many are not technically savvy. Design for the person who:
- Has never used a SaaS proofreading tool before
- Is skeptical that a computer can do this well
- Is under deadline pressure when they're actually using the product
- Values accuracy over speed, but needs both

If a design choice would confuse a non-technical professional, it needs to be reconsidered. Complexity is not a signal of quality here — clarity is.
