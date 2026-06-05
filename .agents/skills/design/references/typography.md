# Typography

## Font Families

| Family | Token | Use |
|---|---|---|
| Manrope | `font-headline` | Page titles, section headings, stat numbers, hero copy |
| Inter | `font-body` / `font-label` | All body text, UI labels, navigation, captions |
| JetBrains Mono | `font-mono` | Transcript text, code, file names, technical output |

## Scale & Usage

### Display / Hero
```jsx
<h1 className="font-headline font-extrabold text-5xl sm:text-6xl lg:text-7xl text-on-surface leading-[1.1] tracking-tight">
```
Use only once per page — the top-level page title.

### Page heading (H1 in dashboard)
```jsx
<h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
```

### Section heading (H2)
```jsx
<h2 className="font-headline font-bold text-3xl sm:text-4xl text-on-surface">
```

### Card / panel heading (H3)
```jsx
<h3 className="font-headline font-bold text-xl text-on-surface">
```

### Body text (standard)
```jsx
<p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
```
`leading-relaxed` is required on all paragraph text. Never use `leading-tight` on body copy.

### Caption / meta text
```jsx
<p className="text-xs text-on-surface-variant">
```

### Section label (above a heading)
```jsx
<span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
  Category Name
</span>
```
Always pair with a heading immediately below it. Never use this as standalone text.

### Table / list header
```jsx
<span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
```

### Stat number
```jsx
<p className="text-2xl font-headline font-black text-primary leading-none">
```
Use `leading-none` to keep numbers tight when paired with a small label below.

### Transcript / legal text
```jsx
<p className="font-mono text-sm text-on-surface leading-relaxed">
```

## Rules

- **Headline font is for display only.** Don't use `font-headline` on body copy, captions, labels, or buttons.
- **Font weight**: use `font-bold` (700) for emphasis, `font-semibold` (600) for secondary emphasis. `font-black` (900) only on stat numbers.
- **Color**: headings → `text-on-surface`. Body → `text-on-surface-variant`. Never use `text-primary` for body copy — it's for interactive elements only.
- **Italic**: use sparingly, only for legal case names or transcript speaker context labels.
- **ALL CAPS**: only for section labels and table headers with `tracking-[0.2em]` or `tracking-widest`. Never for body copy or headings.
