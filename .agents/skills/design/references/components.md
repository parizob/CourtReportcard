# Component Patterns

Exact class combinations used in production. Match these precisely — don't invent variations.

---

## Buttons

### Primary CTA (gradient)
```jsx
<button className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow">
  Label
</button>
```
Use for the single most important action on a surface. Only one per view.

### Secondary / outline
```jsx
<button className="border-2 border-primary/30 text-primary px-6 py-3 rounded-md font-bold text-sm hover:bg-primary/10 hover:border-primary/10 transition-all">
  Label
</button>
```

### Ghost / text button
```jsx
<button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
  <span className="material-symbols-outlined text-sm">refresh</span>
  Label
</button>
```

### Icon button (action)
```jsx
<button className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors">
  <span className="material-symbols-outlined text-lg">edit_note</span>
</button>
```

### Destructive button
```jsx
<button className="flex items-center justify-center gap-2 bg-error text-on-error px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all">
  <span className="material-symbols-outlined text-base">delete</span>
  Delete Permanently
</button>
```

---

## Cards

### Standard content card
```jsx
<div className="bg-surface-container-lowest rounded-xl editorial-shadow p-6 border border-outline-variant/15">
```

### Interactive card (hover lift)
```jsx
<div className="group relative bg-surface-container-lowest p-8 rounded-xl transition-all hover:translate-y-[-4px]">
```

### Stat card
```jsx
<div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 editorial-shadow flex items-center gap-3 sm:gap-4">
  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
    <span className="material-symbols-outlined text-on-secondary-container">{icon}</span>
  </div>
  <div className="min-w-0">
    <p className="text-2xl font-headline font-black text-primary leading-none">{value}</p>
    <p className="text-[10px] uppercase tracking-wide sm:tracking-widest font-bold text-on-surface-variant mt-1 break-words">{label}</p>
  </div>
</div>
```
Grid wrapper: `grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4`. The `min-w-0` on the text column and `break-words` on the label are required — without them, a long uppercase label (e.g. "TOTAL SUGGESTIONS") in a 2-column mobile grid can overflow past the card edge instead of wrapping.

### Feature card with number watermark
```jsx
<div className="group relative bg-surface-container-lowest p-8 rounded-xl transition-all hover:translate-y-[-4px]">
  <div className="w-14 h-14 bg-primary-fixed rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
    <span className="material-symbols-outlined text-primary group-hover:text-on-primary">{icon}</span>
  </div>
  <h3 className="font-headline font-bold text-xl mb-3">{title}</h3>
  <p className="text-on-surface-variant leading-relaxed">{description}</p>
  <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">01</div>
</div>
```

---

## Badges / Status Pills

### Status badge (colored)
```jsx
<span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
  Processing
</span>
```
See `tokens.md` for the full status color map.

### Tag / label pill
```jsx
<span className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full">
  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
  Early Access — Now Open
</span>
```

### Speaker label (in transcript)
```jsx
<div className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-2">
  Q. MR. HARPER
</div>
```

---

## Tables / Lists

### Table container
```jsx
<div className="bg-surface-container-lowest rounded-2xl editorial-shadow overflow-x-auto">
  <div className="min-w-[720px]">
    {/* header row */}
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-outline-variant/10 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
      <span>Column</span>
      <span className="w-24 text-center">Column</span>
    </div>
    {/* data rows */}
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-4 items-center border-b border-outline-variant/5 last:border-b-0 hover:bg-surface-container/30 transition-colors">
    </div>
  </div>
</div>
```
Always use `min-w-[Npx]` wrapper inside an `overflow-x-auto` container for tables with fixed columns.

---

## Modals

### Standard modal
```jsx
<div className="fixed inset-0 z-[100] flex items-center justify-center">
  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
  <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow p-8 max-w-md w-full mx-4 z-10">
    {/* content */}
  </div>
</div>
```
Always use `z-[100]` for modals. Always allow closing by clicking the backdrop (unless a destructive action is in progress).

---

## Icons

All icons use **Material Symbols Outlined** via the `material-symbols-outlined` class. Use `text-lg` (18px) for inline icons, `text-2xl` or `text-4xl` for decorative/empty state icons.

```jsx
<span className="material-symbols-outlined text-lg">edit_note</span>
```

Icon containers follow this pattern:
```jsx
<div className="w-11 h-11 rounded-lg bg-secondary-container flex items-center justify-center">
  <span className="material-symbols-outlined text-on-secondary-container">folder_open</span>
</div>
```

---

## Empty States

```jsx
<div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 flex flex-col items-center text-center">
  <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-6">
    <span className="material-symbols-outlined text-primary text-4xl">inbox</span>
  </div>
  <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Nothing here yet</h3>
  <p className="text-sm text-on-surface-variant max-w-md mb-8 leading-relaxed">
    Explanation of what this space is for and what to do next.
  </p>
  {/* Primary CTA button */}
</div>
```

---

## Loading States

### Spinner (inline)
```jsx
<svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
</svg>
```

### Page-level loading (centered)
Wrap the spinner in the same container as the empty state (`p-12 flex flex-col items-center`).

---

## Forms / Inputs

### Search input
```jsx
<div className="flex items-center bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/20 editorial-shadow">
  <span className="material-symbols-outlined text-outline text-sm">search</span>
  <input
    className="bg-transparent border-none outline-none focus:ring-0 text-sm ml-2 placeholder:text-on-surface-variant/50"
    placeholder="Search..."
    type="text"
  />
</div>
```

Standard inputs follow the same container pattern — `bg-surface-container-lowest`, `rounded-lg`, `border border-outline-variant/20`.
