# Layout

## Page Structure

### Public pages (landing, about, platform)
- Max width: `max-w-[1440px] mx-auto`
- Horizontal padding: `px-6 sm:px-8`
- Sections alternate between `bg-background` and `bg-surface-container-low` to create rhythm without borders
- `SiteHeader` at top, `SiteFooter` at bottom

### Dashboard pages
- Left sidebar: `DashboardLayout` wraps all `/dashboard/*` routes
- `SideNav`: fixed, `w-64`, `bg-surface-container-low`, hidden on mobile (`hidden md:flex`)
- Main content: `min-h-screen p-4 sm:p-8 lg:p-12 bg-background`
- Content max width: `max-w-6xl mx-auto`

## Spacing

Use Tailwind's default spacing scale. Key anchors:
- `gap-4` (16px) — standard gap between cards and grid items
- `gap-6` (24px) — gap inside card content
- `gap-12` (48px) — between major sections within a page
- `mb-6` / `mb-8` — below section headers
- `mb-10` / `mb-16` — between major page sections
- `p-5` or `p-6` — card internal padding (smaller cards)
- `p-8` or `p-12` — card internal padding (larger cards, modals, empty states)

## Grid System

### Hero (12-column)
```jsx
<div className="grid lg:grid-cols-12 gap-12 items-center">
  <div className="lg:col-span-6"> {/* copy */} </div>
  <div className="lg:col-span-6"> {/* visual */} </div>
</div>
```

### Feature cards (responsive 3-col)
```jsx
<div className="grid md:grid-cols-3 gap-6 sm:gap-12">
```

### Stat cards (2-up on mobile, 4-up on desktop)
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```

### Split section (50/50, full-bleed colored background)
```jsx
<div className="bg-primary rounded-2xl overflow-hidden flex flex-col lg:flex-row">
  <div className="lg:w-1/2 p-8 sm:p-12 lg:p-20"> {/* copy */} </div>
  <div className="lg:w-1/2 bg-surface-container-high relative min-h-[400px]"> {/* visual */} </div>
</div>
```

## Border Radius

The radius scale is intentionally conservative — this communicates precision, not friendliness.

| Class | Value | Use |
|---|---|---|
| `rounded` (default) | `2px` | Almost never used directly |
| `rounded-lg` | `4px` | Buttons, small badges |
| `rounded-xl` | `8px` | Cards, inputs, icon containers |
| `rounded-2xl` | `16px` | Large cards, modals, empty state containers |
| `rounded-full` | `12px` (custom) / `9999px` (Tailwind default) | Pills, avatar circles, status badges |

Note: Tailwind's `rounded-full` is overridden in config to `0.75rem` (12px). For true circles use `rounded-full` with equal width/height.

## Elevation / Shadow

One shadow utility in the system:

```css
.editorial-shadow {
  box-shadow: 0px 12px 32px rgba(25, 28, 29, 0.06);
}
```

Use `editorial-shadow` on: cards, modals, floating inputs, CTAs. Do not stack multiple shadows. Do not use `shadow-lg` or other Tailwind shadow utilities — they're too strong for this aesthetic.

For glass panels (rare, decorative only):
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
}
```

## Responsive Breakpoints

Standard Tailwind breakpoints. Key patterns:
- `sm:` (640px) — font size bumps, wider padding
- `md:` (768px) — grid columns activate (2→3 col), sidebar shows
- `lg:` (1024px) — 12-col hero, full sidebar layout, larger padding

Always design mobile-first. The profession uses desktop primarily, but reporters are often in the field on iPads.

## Z-Index Conventions

| Layer | z-index |
|---|---|
| Sidebar | `z-30` |
| Sticky header | `z-40` |
| Tooltips | `z-10` (relative to parent) |
| Modals / overlays | `z-[100]` |
