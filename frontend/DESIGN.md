# DESIGN.md — Veluate Brand System

> Version 1.0 · June 2026

---

## 1. Brand Essence

**What Veluate is:**
An AI-powered teacher evaluation system. Precise, evidence-based, built for institutions that take pedagogy seriously.

**The tension to hold:**
Clinical rigour + academic warmth. Think a peer-reviewed journal that also genuinely cares about the person writing it. The brand should feel like the most thoughtful professor you ever had — demanding, but on your side.

**One sentence:**
> *Veluate shows teachers exactly where understanding breaks down.*

---

## 2. Logomark

### Concept: The Intersection

The logomark is a **Venn diagram of two overlapping circles** — one representing teaching, one representing understanding. The overlap (filled solid black) is the core product insight: Veluate finds what lives at their intersection.

This is a deliberate geometric abstraction. It carries mathematical precision while remaining human and relational. The filled lens shape formed by the overlap is the "finding" — the moment of diagnostic clarity that Veluate surfaces.

```
  ○   ●
 ○ ● ●●
  ○   ●

 Left circle = Teaching (outline)
 Right circle = Understanding (outline)
 Overlap = filled solid black
```

### Logomark Rules

- The two circles are equal in radius
- The overlap is exactly 40% of one circle's diameter (creating a substantial but not-equal intersection)
- The overlap fill is always solid — never gradient, never halftone
- Minimum size: 24px height (icon use). Below this, use wordmark only
- Clear space: equal to the radius of one circle on all sides

### Lockups

| Name | Usage |
|------|-------|
| **Mark + Wordmark** (horizontal) | Primary: product, marketing |
| **Mark + Wordmark** (stacked) | Reports, headers, footers |
| **Mark only** | App icon, favicon, avatar |
| **Wordmark only** | When mark is already established in context |

---

## 3. Typography

### Display — `Georgia` / `Playfair Display`
Used for: wordmark, hero headlines, report section headers

Georgia is the fallback for guaranteed rendering. Playfair Display (via Google Fonts) is preferred when web fonts load. Both are sharp-serif — editorial, authoritative, slightly warm through their bracketed serifs.

```
font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
```

### Body — `Inter` / System UI
Used for: UI labels, body copy, metadata, data values

```
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Mono — `JetBrains Mono`
Used for: timestamps, scores, technical data in reports

```
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

---

## 4. Type Scale

| Role | Font | Size | Weight | Letter-spacing | Usage |
|------|------|------|--------|----------------|-------|
| Wordmark | Playfair Display | 38px | 400 | +6px | Logo lockup |
| Display | Playfair Display | 32–48px | 400 | +2px | Hero headings |
| Section | Playfair Display | 22px | 400 | +1px | Report section headers |
| UI Label | Inter | 14px | 500 | +0.5px | Nav, buttons, badges |
| Body | Inter | 16px | 400 | 0 | Paragraphs, descriptions |
| Caption | Inter | 12px | 400 | +0.5px | Metadata, footnotes |
| Data | JetBrains Mono | 13px | 400 | 0 | Scores, timestamps |
| Eyebrow | Inter | 10–11px | 500 | +3–4px | Category labels (ALL CAPS) |

**Rule:** Display type is used sparingly — one headline per section maximum. The body does the work; display type sets the tone.

---

## 5. Colour Palette

Veluate is black and white at its core, with a single functional accent. No decorative colour.

### Primary

| Name | Hex | Usage |
|------|-----|-------|
| **Ink** | `#0A0A0A` | Primary text, logomark, filled elements |
| **Paper** | `#FAFAFA` | Primary background |
| **White** | `#FFFFFF` | Cards, surfaces on Paper |

### Neutrals

| Name | Hex | Usage |
|------|-----|-------|
| **Ink 70** | `#3D3D3D` | Secondary text |
| **Ink 40** | `#8A8A8A` | Tertiary text, placeholders |
| **Ink 15** | `#D9D9D9` | Borders, dividers |
| **Ink 06** | `#F0F0F0` | Subtle surface, hover states |

### Functional Accent

| Name | Hex | Usage |
|------|-----|-------|
| **Signal** | `#1A1A6E` | Links, active states, key data callouts |

This deep navy reads as near-black — it is barely an accent. Use it to direct attention, not to decorate. It is the only colour on the palette that departs from pure greyscale.

### Confusion Heatmap (in-product only)

The heatmap is the one place full colour is permitted — it is a data encoding, not a brand choice.

| Level | Hex | Label |
|-------|-----|-------|
| None | `#F0F0F0` | No signal |
| Low | `#FDE8D8` | Mild confusion risk |
| Medium | `#F4A26A` | Moderate confusion risk |
| High | `#E05C2A` | High confusion risk |
| Critical | `#9E1B1B` | Teaching breakdown |

These colours appear only inside report visualisations — never in UI chrome, navigation, or marketing.

---

## 6. Spacing & Layout

Veluate uses an **8px base grid**. All spacing is a multiple of 8.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 8px | Icon padding, tight gaps |
| `space-2` | 16px | Component internal padding |
| `space-3` | 24px | Between related elements |
| `space-4` | 32px | Between sections |
| `space-6` | 48px | Page-level breathing room |
| `space-8` | 64px | Hero / section separation |

**Max content width:** 1120px. Centred, with 40px minimum side gutters.

**Report layout:** Two-column. Left column (280px) = navigation + metadata. Right column (flex) = content, heatmap, agent outputs.

---

## 7. Border & Surface Treatment

```
Border radius: 0 (no rounding — crisp, institutional edges)
Exception: pill badges only → border-radius: 100px
```

Veluate uses **zero border-radius** on all cards, inputs, and containers. This is intentional. It references academic documents, printed reports, and rigorous evaluation systems — not consumer apps. The sharpness signals precision.

| Surface | Background | Border |
|---------|-----------|--------|
| Page | `#FAFAFA` | — |
| Card | `#FFFFFF` | `0.5px solid #D9D9D9` |
| Nested card | `#F0F0F0` | none |
| Input | `#FFFFFF` | `1px solid #D9D9D9` → `1px solid #0A0A0A` on focus |
| Active/Selected | `#0A0A0A` bg | — |

---

## 8. Iconography

- Style: **thin line icons**, 1px stroke weight, no fill
- Recommended set: Tabler Icons (outline variant)
- Size: 16px inline, 20px feature, 24px max
- Colour: always inherit from text — `#0A0A0A` or `#8A8A8A`
- Never use filled icons. Never use colour icons. Never use emoji.

---

## 9. Motion

Veluate's motion language is **deliberate and minimal**. Transitions communicate state, not personality.

| Type | Duration | Easing |
|------|----------|--------|
| Micro (hover, focus) | 100ms | `ease-out` |
| Component (panel open, expand) | 200ms | `ease-in-out` |
| Page (route transition) | 300ms | `ease-in-out` |
| Heatmap reveal | 600ms | `cubic-bezier(0.4, 0, 0.2, 1)` |

The heatmap reveal is the signature animation: timestamps sweep left-to-right, heat levels fading in sequentially as the agent populates the timeline. This is the one moment of designed drama.

**Respect `prefers-reduced-motion`:** all transitions collapse to instant when set.

---

## 10. Voice & Tone

Veluate speaks with the confidence of evidence.

| Context | Tone |
|---------|------|
| Marketing | Precise, measured, quietly urgent |
| Onboarding | Warm, direct, no jargon |
| Reports | Clinical, specific, never judgmental of the teacher as a person |
| Errors | Clear cause, clear action, no apology |
| Empty states | Instructional — tell them what to do next |

### Core vocabulary

- ✅ *analysis, evidence, breakdown, mapping, insight*
- ✅ *teaching moment, confusion signal, exam gap*
- ❌ *AI magic, smart, powerful, revolutionary*
- ❌ *grade, fail, bad teacher* (Veluate evaluates delivery, never the person)

### Sample copy

> "Three teaching moments contributed to this exam gap. Here's where the lecture lost the thread."

> "Upload a lecture recording to begin your first analysis."

> "The confusion heatmap updates as each agent completes its pass."

---

## 11. Logo Usage — Do's and Don'ts

| ✅ Do | ❌ Don't |
|-------|---------|
| Use on white or `#FAFAFA` backgrounds | Place on coloured backgrounds |
| Scale proportionally | Stretch or distort the circles |
| Use the outlined version on dark backgrounds | Use the primary lockup on dark without inversion |
| Keep clear space equal to one circle's radius | Crowd with other elements |
| Use the mark solo at small sizes | Use the stacked lockup below 120px wide |

---

## 12. Dark Mode

Veluate supports dark mode. The palette inverts cleanly because it is built from pure neutrals.

| Light | Dark |
|-------|------|
| Page: `#FAFAFA` | Page: `#0F0F0F` |
| Card: `#FFFFFF` | Card: `#1A1A1A` |
| Text primary: `#0A0A0A` | Text primary: `#F0F0F0` |
| Text secondary: `#3D3D3D` | Text secondary: `#A0A0A0` |
| Border: `#D9D9D9` | Border: `#2C2C2C` |
| Logomark fill: `#0A0A0A` | Logomark fill: `#F0F0F0` |

The logomark inverts — filled lens becomes light on dark. The wordmark similarly flips. All logomark assets should be prepared in both variants.

---

## 13. File Assets Checklist

```
/brand/
  logo/
    veluate-logo-black.svg       ← primary lockup, light backgrounds
    veluate-logo-white.svg       ← inverted lockup, dark backgrounds
    veluate-mark-black.svg       ← mark only, light
    veluate-mark-white.svg       ← mark only, dark
    veluate-wordmark-black.svg   ← wordmark only, light
    veluate-wordmark-white.svg   ← wordmark only, dark
    veluate-favicon.png          ← 32×32, mark only
    veluate-og-image.png         ← 1200×630, lockup centred on Paper
  fonts/
    playfair-display-400.woff2
    inter-400.woff2
    inter-500.woff2
    jetbrains-mono-400.woff2
  colours/
    veluate-palette.ase          ← Adobe Swatch Exchange
    veluate-palette.json         ← for design tokens / CSS generation
```

---

*Veluate brand system — internal reference. Not for distribution.*
