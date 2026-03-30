# Design System Document: The Precision Editorial

## 1. Overview & Creative North Star
**Creative North Star: "The Authoritative Transcript"**
This design system moves away from the "SaaS-dashboard" trope and toward a high-end, editorial aesthetic. In the legal and transcription world, clarity is a mandate, not a preference. Our goal is to create a digital environment that feels as reliable as a leather-bound brief but as fast as modern thought.

We break the "template" look by rejecting rigid grid lines in favor of **Intentional Asymmetry** and **Tonal Depth**. By using expansive white space (breathing room) and overlapping surface layers, we create a sense of focused calm. The interface doesn't just display data; it curates it.

---

## 2. Colors & Surface Philosophy
The palette is rooted in the deep authority of `primary` (#001939) and the pristine clarity of `surface` (#f8f9fa).

### The "No-Line" Rule
**Strict Mandate:** Traditional 1px solid borders for sectioning are prohibited. Boundaries must be defined solely through background color shifts. To separate the navigation from the editor, place a `surface-container-low` (#f3f4f5) sidebar against a `surface` (#f8f9fa) main stage. This creates a "soft edge" that feels integrated and premium.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of heavy-weight vellum.
*   **Base:** `surface` (#f8f9fa) – The desk.
*   **Secondary Area:** `surface-container-low` (#f3f4f5) – A recessed tray for secondary tools.
*   **Focus Component:** `surface-container-lowest` (#ffffff) – An elevated sheet of paper for the primary transcript.
*   **Active Interaction:** `surface-container-high` (#e7e8e9) – To denote a selected or hovered state.

### Signature Textures: The "Glass & Gradient" Rule
For main CTAs or high-level summaries, avoid flat fills. Use a subtle linear gradient transitioning from `primary` (#001939) to `primary_container` (#002d5e). For floating utility bars (like playback controls), use **Glassmorphism**: 
*   **Fill:** `surface_container_lowest` at 80% opacity.
*   **Effect:** 12px Backdrop Blur.
*   **Result:** The UI feels "anchored" to the content beneath it.

---

## 3. Typography
We use a dual-typeface system to balance modern precision with editorial authority.

*   **Display & Headlines (Manrope):** Chosen for its geometric clarity and unique "legal-print" feel. Use `display-lg` (3.5rem) for high-impact data points (e.g., total case hours) to create an asymmetrical focal point.
*   **Body & Labels (Inter):** The workhorse. Use `body-md` (0.875rem) for the transcript text itself. It is optimized for long-form reading and rapid scanning.
*   **Tonal Hierarchy:** Headers should always use `on_surface` (#191c1d), while secondary metadata (timestamps, speaker names) should drop to `on_surface_variant` (#43474f) to reduce visual noise.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than structural lines.

### The Layering Principle
Instead of using a shadow to show a card, place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f3f4f5) background. The 2% shift in brightness provides a "natural lift" that feels sophisticated and easy on the eyes during 8-hour legal reviews.

### Ambient Shadows
If a floating element (like a context menu) is required:
*   **Shadow:** 0px 12px 32px.
*   **Color:** `on_surface` (#191c1d) at 6% opacity.
*   **Intent:** Mimic a natural, soft shadow cast by a desk lamp, not a digital drop shadow.

### The "Ghost Border" Fallback
If accessibility requires a container boundary:
*   **Rule:** Use `outline_variant` (#c3c6d0) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** A gradient fill (`primary` to `primary_container`) with `rounded-md` (0.375rem). Use `on_primary` text.
*   **Secondary:** No fill. `primary` text. Underline on hover using the `tertiary_fixed` (amber) color at 2px thickness to signal "legal-style" marking.

### Input Fields & Search
*   **Style:** `surface_container_lowest` fill. No border. Use a 2px `primary` bottom-bar only when focused.
*   **Error State:** For critical transcription errors, use a `soft red` (`error_container` #ffdad6) background with a 1px `error` (#ba1a1a) "Ghost Border."

### The Transcript Editor (Specialized Component)
*   **Warning Underline:** Use `tertiary_fixed` (#ffba38) for low-confidence transcript words.
*   **Critical Circle:** Use a soft, non-filled stroke of `error` (#ba1a1a) around words that conflict with the audio dictionary.
*   **Spacing:** Use `spacing-6` (1.3rem) between speaker turns. **Never use dividers.** Separation is achieved through vertical white space.

### Chips (Speaker ID)
*   Use `secondary_container` (#c2d4ff) for the background and `on_secondary_container` (#495b81) for the text. Set `rounded-full` for a distinct "pill" shape that contrasts against the rectangular editorial layout.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use `tertiary_fixed_dim` (amber) sparingly as a "highlighter" for key evidence.
*   **Do** leverage the `spacing-20` (4.5rem) or `spacing-24` (5.5rem) values for top-level page margins to create an "Editorial Gallery" feel.
*   **Do** group related transcript metadata using background shifts (e.g., `surface-container-highest`) rather than boxes.

### Don’t
*   **Don't** use 100% black. Always use `on_surface` (#191c1d) for text to maintain a high-end, ink-on-paper feel.
*   **Don't** use `rounded-none`. Even for the most professional legal tool, the `DEFAULT` (0.25rem) radius provides a modern, "precision-milled" finish.
*   **Don't** use heavy shadows. If the interface feels "heavy," remove the shadow and increase the background color contrast between layers instead.