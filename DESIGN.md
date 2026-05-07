---
name: Goodgame
description: A premium dark personal gaming library where cover art carries the richness and controls stay quiet.
colors:
  background: "#0a0b0d"
  surface: "#16181c"
  surface-raised: "#1e2228"
  border: "#ffffff12"
  border-soft: "#ffffff0a"
  primary: "#0052ff"
  primary-active: "#003ecc"
  primary-disabled: "#a8b8cc"
  text-primary: "#ffffff"
  text-secondary: "#a8acb3"
  text-muted: "#6b7178"
  text-muted-soft: "#454b53"
  success: "#05b169"
  error: "#cf202f"
  warning: "#f4b000"
typography:
  display:
    fontFamily: "Inter-Regular, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-1.5px"
  headline:
    fontFamily: "Inter-Regular, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-1px"
  title:
    fontFamily: "Inter-Regular, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.11
    letterSpacing: "-0.5px"
  body:
    fontFamily: "Inter-Regular, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter-Medium, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.6px"
  mono:
    fontFamily: "JetBrainsMono-Medium, monospace"
    fontSize: "15px"
    fontWeight: 500
    letterSpacing: "-0.3px"
rounded:
  none: "0px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "100px"
  full: "9999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "44px"
  button-icon:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    size: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "16px"
  game-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
    height: "38px"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  bottom-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    height: "64px"
---

# Design System: Goodgame

## 1. Overview

**Creative North Star: "The Private Backlog Vault"**

Goodgame is a dark, restrained product interface for a personal gaming collection. It should feel professional, premium, simple, and calm: a place to decide what to play, remember what mattered, and keep a backlog tidy without making the user feel like they are doing admin work.

The visual system is flat and tonal. The page floor is nearly black, panels rise one step above it, and cover art supplies most of the color and emotion. The interface rejects gamer neon/RGB, corporate SaaS dashboards, childish arcade energy, and cluttered Steam clone density.

The app is used repeatedly, often for quick decisions. Controls should be compact, familiar, and durable: filter, sort, add, status, reorder, continue. Explanatory panels are rare. Labels, icons, and counts do the work.

**Key Characteristics:**
- Restrained dark canvas: near-black background, two tonal surface layers, faint white borders.
- One action accent: Goodgame Blue is reserved for active navigation, selected controls, and primary actions.
- Game artwork carries richness; UI chrome stays quiet and sparse.
- Status is always text plus color, never color alone.
- Cards and chips are rounded but controlled; the product should feel premium, not bubbly.

## 2. Colors

The palette is a restrained dark product palette: graphite surfaces, cool gray text, one blue action color, and three semantic status colors.

### Primary
- **Goodgame Blue:** The only primary action color. Use it for selected navigation, active filter state, primary CTAs, focused actions, and loading spinners. Its scarcity is part of the premium feel.
- **Pressed Blue:** Pressed and active variant for primary actions. Use only for interaction states that need a darker blue.
- **Disabled Blue:** Disabled primary-action tint. Use sparingly; opacity-based disabled states are already common in the codebase.

### Neutral
- **Vault Black:** The page floor. It should sit behind every main screen and never be replaced by pure black.
- **Shelf Surface:** The standard card, side nav, bottom nav, modal, and search surface.
- **Raised Shelf:** Elevated chips, icon buttons, selected rows, skeleton loaders, and pressed states.
- **Quiet Border:** Faint white border for cards, nav, panels, and filter pills.
- **Soft Border:** Subtler dividers inside lists and modal sheets.
- **Primary Text:** Main text on dark surfaces.
- **Secondary Text:** Captions, inactive labels, helper text, and secondary metadata.
- **Muted Text:** Placeholder text, inactive iconography, empty-state icons, and lower-priority labels.
- **Disabled Text:** Disabled chevrons, unavailable controls, and deep-muted details.

### Tertiary
- **Playing Green:** Semantic success and the Playing status. Use as text or border, not as filled surfaces.
- **Danger Red:** Destructive actions, errors, low Metacritic scores, and remove controls.
- **Completion Amber:** Done status, medium scores, and completion signals.

### Named Rules

**The Artwork Carries Color Rule.** Interface color stays restrained so game covers can provide the visual range.

**The One Blue Rule.** Blue is for action and selection only. Do not add extra accent hues for decoration.

**The Text Plus Color Rule.** Status colors must be paired with labels, icons, or visible text for accessibility.

## 3. Typography

**Display Font:** Inter-Regular with system fallbacks  
**Body Font:** Inter-Regular with Inter-Medium, Inter-SemiBold, and Inter-Bold for emphasis  
**Label/Mono Font:** JetBrainsMono-Medium for numerical values

**Character:** The typography is quiet and direct. Display text stays light and modest, while labels and buttons get confidence from medium or semibold weight rather than large size.

### Hierarchy
- **Display** (400, 36px, 1.0): Reserved for the largest screen-level moments.
- **Headline** (400, 28px, 1.0): Main screen headings such as Library and dashboard greetings.
- **Title** (400, 22px, 1.11): Section headers, modal titles, and high-level panel names.
- **Body** (400, 15px, 1.5): Game titles, row labels, descriptions, and normal UI text.
- **Caption** (400, 13px, 1.5): Metadata, helper text, footers, and secondary information.
- **Label** (500, 11px, 0.6px tracking): Chips, status labels, badges, and small controls. Defaults to uppercase unless a button overrides it.
- **Mono** (500, 15px): Ratings, counts, playtime, scores, and tabular numbers.

### Named Rules

**The Calm Display Rule.** Screen headings stay regular weight. Do not bold display copy to create drama.

**The Numbers Are Objects Rule.** Numerical values should use the mono style when they are meant to be scanned or compared.

## 4. Elevation

Goodgame uses tonal layering instead of shadow-heavy depth. Surfaces rise by changing from Vault Black to Shelf Surface to Raised Shelf. Borders are faint and structural. Shadows exist only in the shared Card elevated variant, and even there they are extremely soft.

### Shadow Vocabulary
- **Soft Raised Card** (`0 4px 12px rgba(0,0,0,0.04)`): Optional hover or elevated-card treatment. It should never become a decorative glow.
- **Modal Scrim** (`rgba(0,0,0,0.6)`): Used behind status and sort pickers to separate an active decision from the app.

### Named Rules

**The Tonal First Rule.** Reach for surface tone and border before shadow.

**The No Glow Rule.** Glowing outlines, neon washes, and glassy blur are prohibited.

## 5. Components

### Buttons

Buttons are compact, pill-shaped, and action-focused.

- **Shape:** Full pill for text actions (100px radius), full circle for icon-only actions.
- **Primary:** Goodgame Blue background, white text, 44px height, 12px vertical and 24px horizontal padding.
- **Secondary:** Shelf Surface background, Quiet Border outline, white text.
- **Ghost:** Transparent background, white text; use where the surrounding surface already gives enough structure.
- **Icon:** Raised Shelf circular button, 44px square, centered icon.
- **Pressed / Disabled:** Pressed state lowers opacity to 0.75. Disabled state lowers opacity to 0.4.

### Chips

Chips are the main control language for status and filtering.

- **Filter Chips:** Pill shape, Shelf Surface background, Quiet Border outline, 38px minimum height, icon + label + count badge.
- **Active Filter:** Raised Shelf background, Goodgame Blue border, blue icon, blue label, blue count.
- **Status Chips:** Pill shape with semantic border and semantic label. Never fill the chip with the status color.
- **Platform Chips:** Small rounded rectangles on game cards, Raised Shelf background, compact label.

### Cards / Containers

Cards frame individual games and repeated items, not whole page sections.

- **Corner Style:** Large cards use 24px radius. Compact library cards sometimes use 10px where density requires it.
- **Background:** Shelf Surface for cards; Raised Shelf for image placeholders, chips, selected rows, and skeletons.
- **Border:** Quiet Border on cards and primary panels.
- **Internal Padding:** 8px for dense game cards, 12px for compact rows, 16px for base Card, 24px or 32px only for modals and spacious empty states.
- **Media:** Game covers use `expo-image`, disk cache, cover fit, and 200ms transitions.

### Inputs / Fields

Inputs are dark, rectangular, and quietly rounded.

- **Style:** Shelf Surface background, Quiet Border stroke, 12px radius, 12px vertical and 16px horizontal padding.
- **Text:** Inter body size, Primary Text value, Muted Text placeholder.
- **Search:** Leading search icon, compact gap, no explanatory wrapper text.
- **Focus:** Use Goodgame Blue as the focus indicator when a platform exposes focus styling.

### Navigation

Navigation uses the same dark surface system as the rest of the app.

- **Web Side Nav:** 220px wide Shelf Surface rail with Quiet Border on the right. Active item uses Raised Shelf and Goodgame Blue text/icon.
- **Mobile Bottom Nav:** Shelf Surface bar with top border. Active tab uses Goodgame Blue icon and label.
- **Logo:** Text wordmark in Goodgame Blue, Inter-Regular, 22px, slight tight tracking.
- **Tab Labels:** Small, calm, and direct. Do not add badges unless they are functional.

### Game Cards

Game cards are the signature product component. Artwork leads, metadata follows.

- **Cover:** Full-width artwork, 130px tall in standard cards, Rounded by the parent overflow.
- **Title:** Body text, often manually reduced to 13-14px for dense card grids.
- **Metadata:** Year, platform chips, Metacritic badge, status chip, rating, and playtime.
- **Score Badge:** Dark background or transparent chip with semantic border and semantic label. Never use solid green, amber, or red fills.

### Modals / Sheets

Status and sort pickers appear as bottom sheets on native and centered cards on web.

- **Native:** Bottom sheet, 24px top radius, no bottom border, visible handle.
- **Web:** Centered 360px card, 24px radius, Quiet Border.
- **Rows:** 16px vertical rhythm, icon + label + selected checkmark.
- **Selected State:** Raised Shelf background, semantic or primary color on icon and label.

## 6. Do's and Don'ts

### Do:
- **Do** keep the interface dark, restrained, and premium: Vault Black, Shelf Surface, Raised Shelf.
- **Do** let game artwork carry visual richness.
- **Do** reserve Goodgame Blue for active navigation, selected controls, and primary actions.
- **Do** pair status colors with labels or icons every time.
- **Do** use compact, repeatable controls for recurring workflows like filter, sort, add, reorder, and status change.
- **Do** use faint borders and tonal layering before adding shadows.
- **Do** keep RAWG attribution visible wherever app rules require it.

### Don't:
- **Don't** use gamer neon/RGB.
- **Don't** make the product feel like a corporate SaaS dashboard.
- **Don't** use childish arcade styling.
- **Don't** build a cluttered Steam clone.
- **Don't** add glowing gradients, cyberpunk purple, busy achievement walls, or dense marketplace shelves.
- **Don't** use aggressive cards everywhere. Cards are for repeated items and real containers, not every section.
- **Don't** use semantic green, red, or amber as filled button backgrounds.
- **Don't** use glassmorphism, blur panels, gradient text, or neon glows.
