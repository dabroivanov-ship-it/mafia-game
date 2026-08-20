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

**Refined Minimal + Technical/Mono.** Same chrome, four palettes. Do not mix
brutalist, editorial magazine, or playful geometric. Do not invent a second brand.

Visible picker themes (`client/src/themes.css`):

| Id | Name | Neutrals | Accent (~5–10% of pixels) |
|---|---|---|---|
| `midnight` | Полночь | Near-black violet `#0B0B10` / cards `#14141C` | Linear-like purple `#8B85E8` |
| `emerald` | Изумруд | Forest `#0A0F0C` / `#121A15` | Calm green `#3DCF9A` |
| `crimson` | Мафия | Navy `#071018` / `#0C1824` | Turquoise `#3EC8E0` (not electric cyan) |
| `day` | Светлая | Paper `#F3F2EE` / cards `#FAF9F6` (not `#fff`) | Ink `#1C1B18`, purple `#5C56C8` |

Default: `midnight`. Shared `--radius` in `App.css` — never shrink radius per theme.
`aurora` / `sunset` / `ocean` stay valid for saved accounts; do not show in picker.

One accent, rest neutrals. Not pure black, not pure white. Hairline `--border`.
No aurora/mesh/glassmorphism. No purple–blue **gradient heroes**. A single purple
accent (Linear-like) is OK. Do not add Мафия-only VIZOR overlays, button gradients,
or extra body meshes — all four use the same token set.

North stars: Linear, Stripe dashboard, Vercel. Type already in use: **Geologica**.

Would Linear ship this? If no — redesign.

## Existing tokens — use them

Colors live in `client/src/themes.css`. Radius and layout in `client/src/App.css`.
Polish in `client/src/ui-flat.css`. Components use:

`--bg`, `--bg-card`, `--bg-hover`, `--bg-elevated`, `--border`, `--text`,
`--text-muted`, `--accent`, `--accent-hover`, `--accent-glow`, `--danger`,
`--success`, `--warning`, `--body-glow-1`, `--body-glow-2`, `--radius`,
`--radius-sm`.

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
