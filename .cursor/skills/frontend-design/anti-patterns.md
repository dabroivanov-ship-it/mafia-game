# Anti-patterns (this repo)

If listed — redesign. Full catalog: [AkyRayy/Frontend-Design-SKILLS-for-AI](https://github.com/AkyRayy/Frontend-Design-SKILLS-for-AI/blob/main/anti-patterns.md).

## Visual

| Reject | Do instead |
|---|---|
| Purple–blue–pink logo / hero gradients | `var(--accent)` on `--bg` / `--bg-card` |
| Glass `backdrop-filter` on every card | Solid `--bg-card` + `--border` hairline |
| Emoji as section icons (📖 🎭 🤖 🏆) | Type, index `01`, or one SVG set |
| Pill radius on cards and images | `--radius` / `--radius-sm`; pills only for tiny tags |
| Stacked gummy shadows | One hairline, or one modal shadow |
| Aurora / radial glow behind every page | Theme glow is already on `body`; don’t add more blobs |
| `drop-shadow` on headlines | Contrast and size |

## Structure

| Reject | Do instead |
|---|---|
| Identical 3-column feature grids | Stacked index rows (info hub already) |
| “Hero → logos → 3 cards → FAQ → CTA” | Guest: brand, login, one path to play |
| Fake “Trusted by 10,000+” | Real counts from stats, or omit |

## Copy

| Reject | Do instead |
|---|---|
| «Добро пожаловать в Мафию» | Claim: что делает стол |
| Empowering / seamlessly / future of | Конкретные правила, роли, числа |
| Lorem / «описание здесь» | Живые тексты из `content/` |

## Code

| Reject | Do instead |
|---|---|
| Raw `#8b85e8` / `#3ec8e0` in components | Theme tokens |
| `outline: none` with no `:focus-visible` | Accent ring, 2px offset |
| `transition-all` | Explicit `color`, `border-color`, `background` |
| Emoji in JSX for chrome | Text or CSS `::after` |
