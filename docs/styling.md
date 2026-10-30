# Styling

Import the stylesheet once, anywhere in your app:

```tsx
import "@tsquare-js/react/styles.css";
```

It styles everything around the board: the expand button, the problem lists, the viewer's bar, chips and zoom buttons, and the full-size dialog. The board itself is an image and looks the same everywhere, as tsquare draws it: grayscale, with the board's accent color.

Without the stylesheet the components still work, unstyled: `<Wireframe>`'s image still fits its container, but the viewer needs a height from you, and buttons look like the browser's defaults.

## Your colors

The stylesheet reads these CSS variables. Set any of them, on `:root` or on a component, and leave the rest:

| Variable | Used for | Default (light / dark) |
|---|---|---|
| `--tsquare-bg` | panels, buttons, the dialog | `#ffffff` / `#1b1d21` |
| `--tsquare-fg` | text and icons | `#1f2328` / `#e6e8eb` |
| `--tsquare-muted` | secondary text | `#656d76` / `#9aa1a9` |
| `--tsquare-border` | borders | `#d8dce0` / `#3a3f46` |
| `--tsquare-stage` | the area behind the board in the viewer | `#f3f4f6` / `#25282d` |
| `--tsquare-accent` | the selected screen chip, focus rings | `#1f2328` / `#e6e8eb` |
| `--tsquare-accent-fg` | text on the accent | `#ffffff` / `#1b1d21` |
| `--tsquare-error` | problem lists | `#cf222e` / `#ff7b72` |
| `--tsquare-highlight` | outlines on elements in the viewer (`selected`, hover); works without the stylesheet too | `#3B99FB` |
| `--tsquare-font` | text | your page's font |
| `--tsquare-font-mono` | problem lines | `ui-monospace, Menlo, …` |
| `--tsquare-radius` | corners | `6px` |
| `--tsquare-viewer-height` | `<WireframeViewer>`'s height | `32rem` |
| `--tsquare-editor-height` | `<WireframeEditor>`'s height | `20rem` |
| `--tsquare-playground-height` | `<WireframePlayground>`'s height | `36rem` |

Point them at your own design tokens:

```css
:root {
  --tsquare-accent: var(--brand-600);
  --tsquare-error: var(--danger);
  --tsquare-radius: 10px;
  --tsquare-font: var(--font-sans);
}
```

## Light and dark

The components follow your page's color scheme:

- **`color-scheme`**: if your page sets `color-scheme: dark` (or `light dark`, to follow the system) on `<html>`, the components match it. This is the most reliable way, and most dark modes set it already.
- **A class or attribute**: a `dark` class or `data-theme="dark"` on any ancestor turns them dark; `light` / `data-theme="light"` turns them light. The nearest one wins, so a dark section inside a light page works. This covers Tailwind's `dark` class and most theme switchers.

A page that changes its colors only with `@media (prefers-color-scheme: dark)` and never declares a color scheme gets the light components. Add `:root { color-scheme: light dark; }` to fix that.

## The editor's highlighting

The editor takes its background, text, gutter, popups, error color and fonts from the variables above. Its syntax colors have their own, each with a light and a dark default: `--tsquare-syntax-component`, `--tsquare-syntax-string`, `--tsquare-syntax-prop`, `--tsquare-syntax-number`, `--tsquare-syntax-word`, `--tsquare-syntax-color`, `--tsquare-syntax-comment` and `--tsquare-syntax-punct`. The active line and selection are `--tsquare-editor-active-line` and `--tsquare-editor-selection`.

```css
:root {
  --tsquare-syntax-component: var(--brand-700);
  --tsquare-syntax-string: #0a7a42;
}
```

For different dark colors, set the variables inside your dark selector:

```css
.dark {
  --tsquare-bg: #0b0c0e;
  --tsquare-stage: #16181b;
}
```

## Class names

Every part has a class, so you can restyle it from your CSS. The stylesheet's rules all have the lowest possible priority (they're wrapped in `:where()`), so yours win without `!important`.

| Class | Element |
|---|---|
| `tsquare-board` | `<Wireframe>`'s `<figure>` |
| `tsquare-board-image` | its `<img>` |
| `tsquare-stale` | on the figure while problems show under the last good board (the image is dimmed) |
| `tsquare-expand` | the expand button |
| `tsquare-problems` | a problem list: `tsquare-problems-title`, `tsquare-problems-list`, `tsquare-problem` |
| `tsquare-viewer` | `<WireframeViewer>`'s root |
| `tsquare-viewer-bar` | the bar above the board: `tsquare-chips` (its buttons have `aria-pressed`) and `tsquare-zoom` (`tsquare-zoom-out`, `tsquare-zoom-level`, `tsquare-zoom-in`) |
| `tsquare-stage` | the area the board moves in, with `tsquare-canvas` inside; it gets `panning` while dragged and `stale` while problems show |
| `tsquare-note` | problems over the viewer's board |
| `tsquare-highlight` | an outline on an element in the viewer, with `tsquare-highlight-selected` or `tsquare-highlight-hover` |
| `tsquare-dialog` | the full-size view: `tsquare-dialog-header`, `tsquare-dialog-title`, `tsquare-dialog-close` |
| `tsquare-editor` | `<WireframeEditor>`'s root; the editor inside is CodeMirror's `cm-editor` |
| `tsquare-playground` | `<WireframePlayground>`'s root (`data-layout` is `auto`, `row` or `column`), with `tsquare-playground-panes` holding the editor and the viewer |

For example, a quieter problem list and square chips:

```css
.tsquare-problems {
  border-left-width: 2px;
  font-size: 0.8rem;
}
.tsquare-chips button {
  border-radius: 0;
}
```

`className` and `style` on each component go on its root element.
