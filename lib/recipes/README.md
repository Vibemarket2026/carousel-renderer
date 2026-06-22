# Recipe Engine (v2.2 — template grammar)

Named art-direction "recipes" (Clinical Editorial, Data Story, Soft Wellness,
Mono Premium, Noir, Bold Promo, Studio Lux) on top of the Satori renderer.
They give structural variety across slides while keeping brand coherence.

## How it plugs in
- Activated only when a render request includes a `recipe` field.
  Requests WITHOUT `recipe` keep using the existing mood/layout/decoration path, unchanged.
- Palette: derived from the brand's two colors (light + dark variants), WCAG-aware text.
- Fonts: hybrid — brand fonts when in the registry, else the recipe's signature pairing.
  Recipe fonts are fetched at runtime from Google Fonts and cached (same idea as the
  Twemoji emoji fetch in render-slide.ts), so no binary font files need to be committed.

## Files
- `tokens.ts` — derive a full design-token set (roles) from 2 brand colors.
- `fonts.ts`  — recipe font registry + runtime loader.
- `engine.ts` — descriptor interpreter (`composeFromTemplate`) + the 7 recipes + skeleton descriptors.

## Safety
- Additive. The legacy render path in `api/render-slide.ts` is untouched.
- Lives on branch `v2.2-templates`; `main` stays production.
