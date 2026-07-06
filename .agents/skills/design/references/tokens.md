# Color Tokens

All tokens are defined in `tailwind.config.js`. Use them by name — never use raw hex values in components.

## Brand Colors

| Token | Hex | Use |
|---|---|---|
| `primary` | `#001939` | Deep navy. CTAs, active nav, key data labels, links |
| `primary-container` | `#002d5e` | Gradient end for primary buttons |
| `primary-fixed` | `#d6e3ff` | Soft highlight backgrounds (icon containers on hover-away state) |
| `primary-fixed-dim` | `#a9c7ff` | Subtle accent, secondary highlights |
| `on-primary` | `#ffffff` | Text/icons on primary backgrounds |
| `on-primary-container` | `#7696cd` | Muted text on dark primary surfaces |

## Secondary (Steel Blue)

| Token | Use |
|---|---|
| `secondary` | `#4c5e84` — secondary actions, links |
| `secondary-container` | `#c2d4ff` — icon container backgrounds, tags |
| `on-secondary-container` | `#495b81` — text inside secondary containers |

## Tertiary / Accent (Amber)

| Token | Use |
|---|---|
| `tertiary-fixed` | `#ffdeac` — warm highlight backgrounds |
| `tertiary-fixed-dim` | `#ffba38` — amber accent, upgrade CTAs, "early access" indicators |
| `on-tertiary-fixed` | `#281900` — dark text on amber |

## Surface (Neutrals)

Use this scale to create depth. Light surfaces come forward, dark surfaces recede.

| Token | Hex | Use |
|---|---|---|
| `surface-container-lowest` | `#ffffff` | Cards, modals, content panels — foreground |
| `surface-container-low` | `#f3f4f5` | Section backgrounds, sidebar |
| `surface-container` | `#edeeef` | Input backgrounds, row hover, subtle dividers |
| `surface-container-high` | `#e7e8e9` | Disabled states, skeleton loaders |
| `surface-container-highest` | `#e1e3e4` | Borders, heavy dividers |
| `background` | `#f8f9fa` | Page background |
| `surface` | `#f8f9fa` | Same as background — interchangeable |

## Text

| Token | Use |
|---|---|
| `on-surface` | `#191c1d` — primary text, headings |
| `on-surface-variant` | `#43474f` — secondary text, labels, captions |
| `outline` | `#747780` — placeholder text, tertiary labels |
| `outline-variant` | `#c3c6d0` — dividers, borders, subtle separators |

## Status Colors

These are raw Tailwind utilities (not custom tokens) used for status badges and inline indicators. Keep consistent:

| State | Background | Text |
|---|---|---|
| Uploaded | `bg-blue-100` | `text-blue-700` |
| Processing | `bg-gray-100` | `text-gray-700` (paired with an animated spinner) |
| Analyzed | `bg-amber-100` | `text-amber-700` |
| Reviewed | `bg-green-100` | `text-green-700` |
| Exported | `bg-purple-100` | `text-purple-700` |
| Error / Delete | `bg-error/10` | `text-error` |
| Purged / Disabled | `bg-surface-container` | `text-on-surface-variant/70` |

## Error

| Token | Use |
|---|---|
| `error` | `#ba1a1a` — destructive actions, error text, error icons |
| `error-container` | `#ffdad6` — error background panels |
| `on-error` | `#ffffff` — text on error buttons |
| `on-error-container` | `#93000a` — text inside error-container panels |

## Usage Rules

- **Never** put `text-on-surface` on a `primary` background. Use `text-on-primary`.
- **Never** use opacity hacks (e.g. `text-primary/70`) to soften a primary text — use `text-on-surface-variant` instead.
- **Surface depth**: if two panels overlap, the foreground panel must be a lighter surface token than the background panel.
- Amber (`tertiary-fixed-dim`) is reserved for upgrade CTAs and "early access" indicators — don't use it for generic accents.
