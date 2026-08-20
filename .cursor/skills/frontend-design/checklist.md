# Pre-ship UI checklist

## Type and color

- [ ] Geologica / `--font`; no random Google font added for one screen
- [ ] Hierarchy via size and `--text-muted`, not bold-on-everything
- [ ] Accent used sparingly; surfaces are `--bg` / `--bg-card`
- [ ] Contrast holds on midnight, emerald, crimson

## Layout

- [ ] Screen has one job
- [ ] Not a centered three-card template
- [ ] Guest `/info/*` readable without login
- [ ] Mobile: 480 / 768; no `user-scalable=no`

## Components

- [ ] `:focus-visible` ring on buttons, links, inputs
- [ ] Hover/disabled/empty/error exist where the control can fail
- [ ] No emoji icons in hubs, headings, primary buttons
- [ ] Chat/spectator labels are words, not emoji

## Motion

- [ ] No scale-bounce on every card hover
- [ ] `prefers-reduced-motion` respected for looping animations (logo pulse)

## Copy

- [ ] Russian, specific, no marketing stack
- [ ] Numbers match config (`MAX_PLAYERS` is 15)
