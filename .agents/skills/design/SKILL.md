---
name: design
description: Court Reportcard design system skill. Use when building UI components, adding new pages or features, reviewing layouts, choosing colors or typography, or ensuring design consistency across the product. Covers the full token system, component patterns, and design principles.
license: proprietary
metadata:
  author: Court Reportcard
  version: "1.0.0"
  organization: Court Reportcard
  date: June 2026
  abstract: Design system reference for Court Reportcard — a professional proofreading tool for court reporters. Built on Material Design 3 color tokens, Manrope/Inter typography, and a conservative radius/shadow system that communicates precision and trustworthiness. Every design decision should reduce cognitive load: the user is mid-job, not browsing. Show what matters, hide what doesn't, never overwhelm.
---

# Court Reportcard Design System

## Core Design Principles

**1. Clarity over cleverness.**
Court reporters use this tool while managing real deadlines. Every screen should answer "what do I do next" within one second. No hunting, no confusion.

**2. Professional trust, not consumer delight.**
This is a legal document tool. It should feel like precision software — calm, structured, credible. Not playful, not flashy.

**3. Progressive disclosure.**
Show the minimum needed for the current task. Secondary information lives in tooltips, collapsed states, or secondary panels — not on the main surface.

**4. Earn the screen real estate.**
Every element must justify its presence. If it's not immediately useful, it shouldn't be visible by default.

## Design Files & References

- `references/tokens.md` — full color token reference with usage guidance
- `references/typography.md` — font families, size scale, when to use each
- `references/components.md` — button, card, badge, table, modal patterns with exact class combinations
- `references/layout.md` — page structure, grid, spacing, max-width rules
- `references/dos-and-donts.md` — explicit do/don't list for common mistakes

## Tech Stack

- **Tailwind CSS** with custom tokens in `tailwind.config.js`
- **Material Symbols Outlined** for all icons (via Google Fonts)
- **Manrope** (headlines) + **Inter** (body/label) + **JetBrains Mono** (code/transcript text)
- React + JSX — all UI components are `.jsx` files in `src/components/` and `src/pages/`

## Quick Reference: Most-Used Patterns

### Surface hierarchy (light to dark)
```
surface-container-lowest (#fff)   → cards, modals, content panels
surface-container-low  (#f3f4f5)  → section backgrounds, alternating rows
surface-container      (#edeeef)  → input backgrounds, subtle dividers  
surface-container-high (#e7e8e9)  → disabled states, skeleton loaders
background             (#f8f9fa)  → page background
```

### Primary action button
```jsx
<button className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow">
  Label
</button>
```

### Secondary/outline button
```jsx
<button className="border-2 border-primary/30 text-primary px-6 py-3 rounded-md font-bold text-sm hover:bg-primary/10 hover:border-primary/10 transition-all">
  Label
</button>
```

### Card
```jsx
<div className="bg-surface-container-lowest rounded-xl editorial-shadow p-6 border border-outline-variant/15">
  {/* content */}
</div>
```

### Status badge
```jsx
<span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
  Processing
</span>
```

### Section label (above headings)
```jsx
<span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
  Category Label
</span>
```
