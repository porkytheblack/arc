# Arc — Brand Guidelines

---

## Brand Essence

Arc is quiet confidence. It doesn't shout about what it can do — it simply does it. The brand communicates precision, clarity, and calm authority. Every visual and verbal choice should feel like opening a well-organized workspace: everything in its place, nothing unnecessary.

**Brand attributes:** Precise · Calm · Sharp · Grounded · Intelligent

---

## Voice & Tone

Arc speaks like a senior engineer who's also a good communicator. Direct, economical, never condescending. It assumes competence in the reader without requiring expertise.

**Do:**
- Use short, declarative sentences
- Lead with what something does, not what it is
- Be specific — name the action, name the outcome
- Let silence do work — not every feature needs a paragraph

**Don't:**
- Use superlatives or hype language ("revolutionary", "game-changing", "powerful")
- Over-explain simple concepts
- Use filler transitions ("Furthermore", "In addition", "It's worth noting")
- Hedge unnecessarily ("might", "could potentially", "helps to")

**Example:**
- Yes: "Connect a database. Ask a question. Get an answer."
- No: "Arc is a powerful AI-driven platform that helps you seamlessly interact with your databases."

---

## Color System

The Arc palette is rooted in sage and earth tones — natural, low-contrast, and easy on the eyes for extended use. This is a tool people live in. It should feel like a space, not a screen.

### Primary

| Name         | Hex       | Usage                              |
|--------------|-----------|-------------------------------------|
| Sage 900     | `#111a11` | Primary text, buttons, key actions  |
| Sage 700     | `#2d422d` | Secondary text, hover states        |
| Sage 500     | `#4a6b4a` | Accents, active states, links       |
| Sage 200     | `#b8cab8` | Borders, dividers, subtle UI        |
| Sage 100     | `#dce5dc` | Backgrounds, cards, surfaces        |
| Sage 50      | `#f0f4f0` | Tags, badges, light fills           |

### Neutral

| Name         | Hex       | Usage                              |
|--------------|-----------|-------------------------------------|
| Cream 50     | `#fefdfb` | Page background, card surfaces      |
| Cream 100    | `#faf7f2` | App background, subtle contrast     |
| Cream 200    | `#f2ebe0` | Input backgrounds, secondary fills  |

### Semantic

| Name         | Hex       | Usage                              |
|--------------|-----------|-------------------------------------|
| Success      | `#4ade80` | Confirmations, connected states     |
| Warning      | `#d4a853` | Caution states, pending operations  |
| Error        | `#c45c5c` | Destructive actions, failures       |

### Rules
- Never use pure black (`#000`) or pure white (`#fff`).
- Sage 900 on Cream 50 is the primary text combination.
- Maintain high contrast for data-heavy views. Tables and query results should prioritize legibility over atmosphere.
- Color should inform, not decorate.

---

## Typography

### Font Stack

| Role         | Family                | Weight      | Usage                            |
|--------------|----------------------|-------------|-----------------------------------|
| Display      | Instrument Serif     | 400         | Headings, product name, titles    |
| Body         | DM Sans              | 300–600     | Body text, UI labels, buttons     |
| Mono         | DM Mono              | 300–500     | Code, query output, data values, prices |

### Hierarchy

- **Page titles:** Instrument Serif, 24–32px, Sage 900
- **Section headers:** DM Sans, 14–16px, weight 600, Sage 900
- **Body text:** DM Sans, 14px, weight 400, Sage 800, line-height 1.7
- **Labels & captions:** DM Sans, 10–11px, uppercase, letter-spacing 0.08em, Sage 500
- **Data & code:** DM Mono, 13px, weight 400, Sage 700
- **Metadata:** DM Mono, 9–10px, uppercase, letter-spacing 0.1em, Sage 300

### Rules
- Never use Inter, Roboto, Arial, or system sans-serif fonts.
- Instrument Serif is reserved for display use only — never for body or UI.
- Uppercase text must always have increased letter-spacing (minimum 0.05em).

---

## Spatial Language

### Edges
All UI elements use **sharp, square edges**. No border-radius anywhere. This is non-negotiable — it defines Arc's visual identity. Rectangles, not rounded rectangles. Squares, not circles. The only exception is status indicator dots (6px circles).

### Spacing
- Use an 8px base grid.
- Padding inside components: 12–24px.
- Generous whitespace between sections. Let content breathe.
- Asymmetric layouts are acceptable and encouraged where they serve clarity.

### Borders & Dividers
- Primary border: 1px solid Sage 100
- Active/focus border: 1px solid Sage 500
- Hover border: 1px solid Sage 300
- Borders define space — they should be subtle, never heavy.

---

## Motion & Interaction

Arc uses motion sparingly and purposefully. Animation exists to communicate state changes, not to entertain.

**Principles:**
- Transitions: 0.2–0.35s ease. Never longer.
- Entry animations: translateY(8px) + opacity fade. Subtle upward drift.
- Hover states: background and border color shifts only. No scale, no shadow changes.
- Typing indicators: Three dots with staggered vertical bounce (1.2s cycle).
- Loading: Prefer skeleton states over spinners.

**Never:**
- Bounce or elastic easing
- Animations longer than 0.5s
- Motion that blocks interaction
- Decorative animation with no informational purpose

---

## Component Patterns

### Buttons
- **Primary:** Sage 900 background, Cream 50 text, uppercase, letter-spacing 0.05em
- **Secondary:** Transparent background, Sage 200 border, Sage 700 text
- **Hover (primary):** Background shifts to Sage 700
- **Hover (secondary):** Background fills Sage 900, text shifts to Cream 50, border matches

### Cards
- Background: Cream 50
- Border: 1px solid Sage 100
- No shadow. No border-radius. Flat and clean.

### Inputs
- Border: 1px solid Sage 200
- Focus: border-color shifts to Sage 500
- Placeholder text: Sage 300
- No outlines, no glows

### Tags & Badges
- Background: Sage 50
- Border: 1px solid Sage 100
- Text: Sage 500, DM Sans, 10px, uppercase

---

## Brand Mark

Arc's identity is typographic. The word "Arc" in Instrument Serif is the primary mark. No logomark, no icon, no symbol. The name carries the brand.

When paired with dterminal, use:

```
Arc · dterminal
```

Set in DM Mono, 9–10px, uppercase, Sage 300. The centered dot (·) is the standard separator across all dterminal products.

---

## Photography & Imagery

When imagery is used in marketing or documentation, it should feel:
- Natural and organic (plants, materials, textures)
- High contrast silhouettes on muted backgrounds
- Warm tones — never cool or clinical
- Still life and product photography over lifestyle
- Film grain is acceptable. Hyper-digital polish is not.

Reference aesthetic: the Glove Coffee mood board — botanical silhouettes, vintage electronics, warm matte surfaces, sage and cream environments.

---

## Co-branding with Glove

Arc is "built on Glove." This relationship should be present but not dominant.

**Footer format:**
```
POWERED BY Glove · dterminal.net
```
- "POWERED BY" in DM Mono, 9px, uppercase, Sage 300, letter-spacing 0.1em
- "Glove" in Instrument Serif, 12px, Sage 500
- Separator and URL in DM Mono, 9px, Sage 300

---

*These guidelines are a living document. As Arc evolves, so should its expression — but the core principles of precision, calm, and sharpness remain fixed.*
