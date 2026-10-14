# Design system

HIMVEDA's interface is built to look like it belongs to an agricultural traceability company in Nepal, not like a template. Every decision below was checked against one question: *could this appear on any other site?* If it could, it was changed.

## Principles

1. **Show the system, don't describe it.** The hero is a real batch drawn across a real map of Nepal. The producer section shows an actual receipt, and the technology section shows live record counts.
2. **Spend boldness once per screen.** The map, the receipt and the scroll story carry the personality. Everything around them is quiet.
3. **Marigold means trace.** The single accent colour marks the path a harvest takes and the active state, and nothing else.
4. **Structure is information.** Numbers appear only on true sequences (the five checkpoints, the producer steps). Section names live in an editorial margin, not as caps eyebrows.
5. **Honest placeholders.** Generated specimen plates stand in for missing photography. Stock photos never pose as HIMVEDA products, farmers or people.

## Palette (`src/styles/base.css`)

| Token | Hex | Use |
| --- | --- | --- |
| `--mist` | `#ECEDE5` | Page: a cool hill-mist off-white (deliberately not cream) |
| `--paper` | `#F6F6F0` | Raised surfaces, specimen plates |
| `--paper-2` | `#E3E5DA` | Recessed wells |
| `--ink` | `#18221D` | Text |
| `--ink-2` | `#44514A` | Secondary text (WCAG AA on mist) |
| `--forest` | `#173A2C` | Immersive sections, Studio sidebar |
| `--moss` | `#5B6E45` | Positive marks, bars |
| `--slate` | `#5F7783` | Mineral/glacial data tone |
| `--marigold` | `#E2A019` | **The trace**: route lines, active states, focus rings. Never body text on light grounds |
| `--marigold-ink` | `#8A5D00` | Marigold for text on light grounds |
| `--soil` | `#7B5B3E` | "Sample data" labels and notice |

Marigold (*sayapatri*) is the flower of Tihar garlands. It's a Nepali reference that works without being decorative.

## Typography

- **Newsreader** (variable, optical sizes): display and editorial text. Display sizes use `opsz 72`, weight about 380, and tight tracking.
- **Schibsted Grotesk** (variable): UI, labels and data. Figures use `tabular-nums` inside tables only.
- **Mukta**: Devanagari (रू, category names, checkpoint names), loaded only when glyphs appear.

The scale is a 1.25 ratio anchored at 17 px, with fluid `clamp()` at the display end. Line length stays under about 75 characters, and serif body text gets more leading than sans.

## Layout

- 1360 px max width, fluid gutter `clamp(16px, 3.2vw, 40px)`.
- **Margin grid**: a narrow column holds the section's name and the wide column holds content. It collapses on phones.
- **Hero composition** follows Nepal's diagonal. The headline sits in the empty south-west triangle and the batch tag in the empty north-east.
- Section rhythm alternates light editorial, dark data (forest), dense tables and near-empty owner space.
- Radii are 4 px for controls, 8–14 px for cards and plates, and pills only for chips and status.

## Motion

Motion appears only when it explains something or answers an action:

- **Hero load (once)**: the route draws from origin to market and the nodes arrive in order. The batch tag lands last.
- **Scroll**: the trace path draws down each trace page's timeline, the ecosystem line connects its four participants, and checkpoint progress fills in.
- **Responsive**: prices count to their new value when the currency changes, buttons lean slightly toward fine pointers, filters re-stagger results, and the cart count bumps.
- No fade-up-on-scroll for ordinary sections.
- `prefers-reduced-motion` removes travel and keeps state changes.

## Illustration system

- **Map of Nepal**: real outline (Natural Earth 1:10m), illustrative contours, a marigold route, and numbered sequence markers with a legend where points cluster. `fit` mode zooms to a batch's route.
- **Specimen plates**: line drawings per commodity (pod, seed, leaf, grain, root, berry, flower, comb) on a plate with registration ticks, concentric "origin rings", the category name in Devanagari and the batch code.
- **Receipt and batch tag**: physical objects from the supply chain rendered as UI, with a torn receipt edge, a punched tag hole and an inspection stamp.

## Accessibility

- Semantic landmarks, a skip link, one `h1` per page, and labelled forms with inline, associated errors.
- Native `<dialog>` for the menu, cart, Studio forms and link editor, which provides focus trapping and Escape handling.
- Visible 2 px marigold focus rings, and hit targets of at least 40–44 px.
- Prices expose an unanimated screen-reader text ("approximately $10.71").
- No duplicated carousel content; the product rail is a single scrollable list.
- Contrast: body text ≥ 7:1 on mist, secondary ≥ 4.5:1.
