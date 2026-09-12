# NCC Supply — Design System Specification

A complete, implementation-ready design system for rebuilding a site that looks and feels identical to the current NCC Supply storefront. Written for a coding agent (Claude Code). Stack-agnostic where possible; Tailwind v4 tokens given verbatim.

---

## 1. Design principles

1. **Light, tech-forward, high clarity.** White and near-white surfaces, sky-blue accents, near-black ink for footers and text. No dark hero.
2. **Gradients as accent, never as background noise.** One hero gradient (light), one sky gradient (for CTAs, badges, price chips).
3. **Motion is small and fast.** 200–320ms, cubic-bezier(0.22, 1, 0.36, 1). Lift on hover, rise-in on mount. Never bounce, never long.
4. **Semantic tokens only.** No hardcoded hex or `text-white`/`bg-black` in components.
5. **Typographic hierarchy over decoration.** Inter everywhere; weight and size do the work.

---

## 2. Color tokens (OKLCH)

Define on `:root`, map through `@theme inline` so Tailwind utilities resolve.

### Light (default)

```css
:root {
  --radius: 0.75rem;
  --background: oklch(0.99 0.003 240);
  --foreground: oklch(0.19 0.015 250);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.19 0.015 250);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.19 0.015 250);
  --primary: oklch(0.66 0.15 236);          /* sky blue ≈ #009EE1 */
  --primary-foreground: oklch(0.99 0.005 240);
  --secondary: oklch(0.96 0.008 240);
  --secondary-foreground: oklch(0.24 0.018 250);
  --muted: oklch(0.955 0.008 240);
  --muted-foreground: oklch(0.53 0.02 250);
  --accent: oklch(0.93 0.045 232);
  --accent-foreground: oklch(0.24 0.03 245);
  --destructive: oklch(0.58 0.22 25);
  --destructive-foreground: oklch(0.99 0 0);
  --border: oklch(0.9 0.01 245);
  --input: oklch(0.9 0.01 245);
  --ring: oklch(0.66 0.15 236);
  --ink: oklch(0.16 0.012 250);             /* footer / dark blocks */
  --ink-foreground: oklch(0.97 0.005 240);
  --sky-soft: oklch(0.95 0.035 232);        /* alternating section tint */
}
```

### Dark

```css
.dark {
  --background: oklch(0.16 0.012 250);
  --foreground: oklch(0.97 0.005 240);
  --card: oklch(0.21 0.018 250);
  --card-foreground: oklch(0.97 0.005 240);
  --popover: oklch(0.21 0.018 250);
  --popover-foreground: oklch(0.97 0.005 240);
  --primary: oklch(0.72 0.14 232);
  --primary-foreground: oklch(0.16 0.012 250);
  --secondary: oklch(0.26 0.02 250);
  --secondary-foreground: oklch(0.97 0.005 240);
  --muted: oklch(0.26 0.02 250);
  --muted-foreground: oklch(0.72 0.015 245);
  --accent: oklch(0.32 0.05 240);
  --accent-foreground: oklch(0.97 0.005 240);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 16%);
  --ring: oklch(0.72 0.14 232);
  --ink: oklch(0.12 0.01 250);
  --ink-foreground: oklch(0.97 0.005 240);
  --sky-soft: oklch(0.28 0.04 240);
}
```

### Hex fallbacks (for Shopify/theme editors that reject OKLCH)

| Role | Hex |
|---|---|
| Primary sky blue | `#009EE1` |
| Primary deep | `#1E6FD9` |
| Background | `#FBFCFD` |
| Card | `#FFFFFF` |
| Foreground / text | `#1B2027` |
| Muted text | `#6B7683` |
| Border | `#E1E5EA` |
| Sky soft tint | `#E4F2FB` |
| Ink (footer) | `#14181E` |

---

## 3. Gradients, shadows, radii

```css
:root {
  --gradient-hero: linear-gradient(135deg, oklch(1 0 0) 0%, oklch(0.98 0.008 232) 45%, oklch(0.93 0.035 232) 100%);
  --gradient-sky: linear-gradient(120deg, oklch(0.72 0.14 232), oklch(0.62 0.16 244));
  --gradient-surface: linear-gradient(180deg, oklch(1 0 0), oklch(0.965 0.012 235));
  --shadow-soft: 0 1px 2px oklch(0.2 0.02 250 / 0.06), 0 12px 30px -18px oklch(0.4 0.08 240 / 0.35);
  --shadow-lift: 0 18px 40px -20px oklch(0.45 0.12 238 / 0.45);
}
```

Radii scale from `--radius: 0.75rem`: sm `calc(r - 4px)`, md `calc(r - 2px)`, lg `r`, xl `+4px`, 2xl `+8px`, 3xl `+12px`.
Defaults: buttons/inputs `rounded-lg`, cards `rounded-xl`, badges/pills `rounded-full`.

---

## 4. Typography

- **Family:** Inter for both display and body. `--font-display` and `--font-sans` both `"Inter", system-ui, sans-serif`. Load via `<link>` to Google Fonts in the document head — never `@import` a remote URL in CSS.
- **Headings:** `letter-spacing: -0.02em`, weight 600.
- **Body:** weight 400/500, `-webkit-font-smoothing: antialiased`.
- **Title case** for section headings ("Shop By Category", "Popular This Month").

| Role | Size | Weight | Notes |
|---|---|---|---|
| Hero h1 | 2.25rem → 3.75rem (md) | 600 | `leading-[1.05]`, max-w-3xl |
| Section h2 | 1.5rem → 1.875rem | 600 | font-display |
| Card h3 | 1rem | 600 | `leading-snug` |
| Body | 0.875–1rem | 400 | `text-muted-foreground` for support copy |
| Eyebrow | 0.7rem | 600 | uppercase, `tracking-[0.18em]`, `text-primary` |
| Meta / SKU | 0.6875–0.75rem | 400/500 | muted |

---

## 5. Custom utilities (Tailwind v4 `@utility`)

```css
@utility surface-card {
  background-image: var(--gradient-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
  transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s ease, border-color .28s ease;
  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lift);
    border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
  }
}

@utility hero-gradient { background-image: var(--gradient-hero); color: var(--color-foreground); }
@utility sky-gradient  { background-image: var(--gradient-sky); color: var(--color-ink-foreground); }
@utility text-gradient { background-image: var(--gradient-sky); background-clip: text; color: transparent; }

@utility grid-mesh {
  background-image:
    linear-gradient(color-mix(in oklab, var(--color-primary) 16%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--color-primary) 16%, transparent) 1px, transparent 1px);
  background-size: 44px 44px;
}

@utility rise-in { animation: rise-in .6s cubic-bezier(.22,1,.36,1) both; }

@keyframes rise-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
```

Stagger lists: `style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}`.

---

## 6. Layout & spacing

- Container: `mx-auto max-w-7xl px-4`. **Every** section uses the same max width — no narrower one-offs.
- Section rhythm: `py-20` (hero `py-24`). Alternate white and `bg-sky-soft/50` bands.
- Grids: categories/products `grid gap-5 sm:grid-cols-2 lg:grid-cols-4`; FAQ `md:grid-cols-2 lg:grid-cols-3` with `items-start` so cards keep natural height.
- Breakpoints: sm 640, md 768, lg 1024, xl 1280. Mobile-first; nav collapses to a hamburger below `md`.

---

## 7. Components

### Header
Sticky, `z-50`, `border-b border-border/70`, `bg-background/85 backdrop-blur-xl`.
Row 1: thin `sky-gradient` announcement strip, centered, `text-xs`, `py-1.5`.
Row 2: blue logo (h-8) · main nav (hidden below md) · basket button with count pill (`sky-gradient rounded-full px-2 py-0.5 text-xs`) · hamburger below md.
Row 3 (md+): horizontally scrollable category rail, `text-xs`, hover `bg-sky-soft`.
Active link: `text-foreground bg-secondary`.

### Footer
`bg-ink text-ink-foreground`, `mt-24`, 4-column grid at md, `py-14`. White logo, muted copy at `/70`, fine print at `/50`, bottom bar separated by `border-white/10`.

### Buttons
- **Primary:** `sky-gradient rounded-lg px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95`.
- **Secondary:** `border border-border px-5 py-3 rounded-lg font-semibold hover:bg-secondary`.
- **Tertiary/link:** `text-foreground/80 underline-offset-4 hover:underline`.

### Product card (corrected 2026-09-13 to match the reference site's actual card layout)
`surface-card rise-in flex flex-col overflow-hidden rounded-xl p-0`.
Media block: the real `product.thumbnail` image, full-bleed (`h-40 w-full object-cover`), no padding — falls back to `sky-gradient grid-mesh` only if the image fails to load (never a blank box). No fabricated "grade" badge — there is no grade field in the data model; a repair-parts grade UI can be added once that data exists.
Body (`p-4`): category eyebrow (primary, uppercase) → title (`text-base font-semibold`, hover primary) → SKU (muted `text-xs`) → footer row (`p-4 pt-0`) with price (`font-display text-xl font-semibold`), `ex VAT · Available to order` micro-copy, and an icon+label Add button that swaps to a check for 1.4s.

### Category card (corrected 2026-09-13 — see DECISIONS.md)
White `surface-card` shell, not a dark image-overlay tile: the real `category.thumbnail` image at top (`h-32 w-full object-cover`, `hover:scale-105`), a line-count pill badge (`bg-card/90`, top-left over the image), then a `p-4` body with a short primary accent bar, title, `category.description`, and a "View products →" link in `text-primary` with an arrow icon that nudges right on hover. Falls back to `sky-gradient grid-mesh` only when no thumbnail exists. Whole card is a link with visible focus ring (`ring-2 ring-ring ring-offset-2`).

### Product banner (hero / promo / category top)
Full-width banner block used for the homepage hero, category page tops, and promotional callouts.
- **Current state:** Background is the `hero-gradient` with the `grid-mesh` overlay at 40% opacity. No product photography is used yet.
- **Future state:** Replace the gradient background with a product/context image, covered by a subtle dark or sky-tinted scrim to guarantee text contrast.
- **Structure:** `relative overflow-hidden rounded-none` (or `rounded-xl` for in-page promos), `min-h-[320px] md:min-h-[420px]`, content constrained to `max-w-7xl px-4 py-24`.
- **Image treatment:** `object-cover` full-bleed image, `absolute inset -z-10`, overlaid with `bg-foreground/40` or a gradient scrim (`from-background/80 via-background/40 to-transparent`) so headings and CTAs remain legible.
- **Text:** dark text on light hero, light `text-ink-foreground` on photographic/dark hero. Keep one `h1`, one short value prop, one primary CTA, and a supporting secondary link.
- **Placeholder rule until images are supplied:** keep `hero-gradient` + `grid-mesh`; do not leave a blank or solid-color fallback.

### FAQ / disclosure
`<details>` card: `rounded-xl border border-border bg-card p-6 shadow-sm`, `open:border-primary/50 open:shadow-soft`, hover `-translate-y-0.5`. Summary row with chevron rotating 180° on open, native marker hidden. Below the grid, a full-width CTA banner: `border-primary/30 bg-hero-gradient p-6 shadow-soft`, stacked on mobile, row at md.

### Step / process cards
Numbered, Lucide icon, short label + one-line description, `1 / 2 / 3 / 5` column responsive ladder, animated accent bar on hover.

### Form fields
`rounded-lg border border-input bg-card px-3 py-2 text-sm`, focus `ring-2 ring-ring outline-none`, label `text-sm font-medium`, helper `text-xs text-muted-foreground`, error `text-destructive`.

---

## 8. Iconography & imagery

- **Icons:** Lucide only, stroke default, `h-4 w-4` inline, `h-5 w-5` for feature rows, `h-12 w-12` for success states. Decorative icons get `aria-hidden`.
- **Category imagery:** 4:3 product-in-context photography on light neutral backgrounds, cool-toned, single subject, no text baked in.
- Logos: blue logo on light surfaces, white logo on ink surfaces. Always `alt="NCC Supply"` with explicit width/height.

---

## 9. Motion

| Interaction | Spec |
|---|---|
| Card hover | `translateY(-4px)` + `--shadow-lift`, 280ms |
| Button hover | `scale(1.03)`; active `scale(0.95)` |
| Image hover | `scale(1.05)`, 300ms |
| Mount | `rise-in` 600ms, 40ms stagger, capped at 8 items |
| Disclosure chevron | `rotate-180`, 300ms |

Respect `prefers-reduced-motion: reduce` by disabling transforms and animations.

---

## 10. Content & voice

- Trade, plain, precise. No hype adjectives.
- Never claim live stock. Products are **"Available to order"**.
- Currency: GBP, `£1,234.56` formatting.
- Sentence case for body, Title Case for section headings and buttons.

---

## 11. Accessibility

- Contrast: body text ≥ 4.5:1; sky gradient buttons use near-white foreground.
- Visible focus on every interactive element (`ring-2 ring-ring ring-offset-2`).
- One `h1` per page; headings never skip levels.
- All controls reachable by keyboard; mobile menu toggles `aria-label` between Open/Close menu.
- Images have meaningful alt text; decorative layers use `aria-hidden`.

---

## 12. Implementation notes for the agent

- Tailwind v4, CSS-first: all tokens in the entry stylesheet under `@theme inline`; there is no `tailwind.config.js`.
- Custom utilities must use `@utility`, not `@layer utilities`.
- Never hardcode color utilities in components — only semantic token classes (`bg-card`, `text-muted-foreground`, `border-border`, `bg-sky-soft`, `text-ink-foreground`).
- Reuse the named utilities (`surface-card`, `sky-gradient`, `hero-gradient`, `text-gradient`, `grid-mesh`, `rise-in`) rather than re-declaring gradients inline.
- Fonts load via `<link>` in the document head.
