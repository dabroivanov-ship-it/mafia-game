---
name: frontend-design
description: >-
  Applies senior frontend design for the realmafia.online game UI: dark
  refined-minimal craft, Russian copy, existing CSS tokens. Use when changing
  CSS, React components, auth/info/lobby/room chrome, or when the user asks to
  restyle, polish, or redesign the interface.
---

# Frontend design — craft, not slop

You are a senior frontend designer-craftsman on this mafia game. Output should
read as Linear-grade product UI, not as an LLM landing template.

**Job of this product:** get a player into a room and through a party. Guest
pages convince them to sign in. Everything else is secondary.

## Aesthetic (locked)

**Refined Minimal + Technical/Mono.** Dark surfaces, one amber accent
(`midnight` default). Do not mix brutalist, editorial magazine, or playful
geometric. Do not invent a second brand.

North stars: Linear, Stripe dashboard, Vercel. Type already in use: **Geologica**.

Would Linear ship this? If no — redesign.

## Existing tokens — use them

Colors and radius live in `client/src/themes.css` (`[data-theme='midnight']`
etc.) and polish in `client/src/ui-flat.css`. Components use:

`--bg`, `--bg-card`, `--bg-hover`, `--border`, `--text`, `--text-muted`,
`--accent`, `--accent-hover`, `--danger`, `--success`, `--radius`, `--radius-sm`.

**No raw hex in new CSS** except inside a theme token definition. No new
purple/blue gradients. No `border-radius: 9999px` on new cards/images.

## Process

1. One sentence: what is this screen’s job?
2. Stay in the locked aesthetic.
3. Typography and spacing do the work; accent on <10% of pixels.
4. Real Russian copy. No “Welcome to…”, no “Empowering”, no lorem.
5. States: default, hover, `:focus-visible`, disabled, empty, error.
6. Before done, run [checklist.md](checklist.md). If it looks like AI default, read [anti-patterns.md](anti-patterns.md).

## Instant reject

- Purple-to-blue / aurora / mesh / glassmorphism-everywhere
- Emoji as icons in product chrome (hubs, headings, buttons, nav)
- Centered hero + three identical feature cards
- `transition-all`, `transform: scale(1.05)` on every hover
- Emoji in commit messages and code comments

Game-table **text** may name roles (Катани, дон). Chat tags use short words
(`набл.`, `выб.`), not emoji. Keep `🤖 Ведущий` only as a **parse alias** for
old messages.

## Files

- Guest/public: `Auth.tsx`, `GuestHeader.tsx`, `Info.tsx`, `client/index.html`
- Theme: `themes.css`, `ui-flat.css`, `App.css`
- Product chrome: `Lobby.tsx`, `CabinetHub.tsx`, `Room.tsx`, `Menu.tsx`

Details: [anti-patterns.md](anti-patterns.md), [checklist.md](checklist.md).
