# Styling: Tailwind only

The frontend is styled with **Tailwind CSS v4** utility classes, written directly
in the components. Don't add component stylesheets, CSS Modules or Bootstrap.

## Where things live

| File | What it holds |
|---|---|
| `src/styles/site.css` | Student site entry: `@import "tailwindcss"`, `@theme` tokens, `@layer base` element defaults, `@keyframes`, and overrides for third-party widgets (the Userback launcher). |
| `src/styles/admin.css` | Admin console entry: the same idea, admin tokens only. |
| `postcss.config.mjs` | `@tailwindcss/postcss`. Tailwind v4 needs no `tailwind.config.js`; configure it in CSS with `@theme`. |

The two route groups have separate root layouts, and each imports only its own
entry file, so admin pages never load student-site CSS and vice versa.

## Rules

- **Use utilities in `className`.** If you're about to write a class name in a `.css`
  file, write the utilities in the component instead.
- **Repeated strings become TS constants or small components** (for example the
  admin button styles in `src/components/admin/ui.tsx`), not CSS classes.
- **Conditional classes:** use a small `cx(...)` helper, with no extra dependency.
- **Colors:** add a token to `@theme` (`--color-olive: #7f9a3a;` gives you
  `bg-olive`, `text-olive` and `border-olive`). Use arbitrary values
  (`bg-[#aab2bc]`) only for one-offs.
- **Breakpoints:** prefer the Tailwind defaults (`sm`, `md`, `lg`). For the
  original site's exact widths use arbitrary ones such as `max-[500px]:flex-col`.
- **Dynamic values** computed at runtime (such as bar-chart heights) go in
  `style={{ ... }}`. Never use inline `<style>` tags, because the CSP blocks them.
- **CSS files may hold only:** `@theme`, `@layer base`, `@keyframes`, and rules for
  markup we don't control (third-party widgets).
