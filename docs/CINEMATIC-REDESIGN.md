# Cinematic solar interface

## Reference direction and plan

The three supplied references guide the composition: the analytics reference contributes a compact sidebar and layered dashboard modules; the sustainable-home reference contributes architectural atmosphere; TERRA contributes bold editorial scale and a quiet oversized background word. Their layouts, text, branding and artwork are not copied.

1. Preserve the current frontend source and protected-file hashes, with before screenshots under `.data/cinematic-solar`.
2. Build one visual language for the entire app: graphite/slate surfaces, ivory typography, restrained energy colors, consistent panel radii and spacing, an original architectural hero, larger values with quieter units, layered energy flow, charts, timelines and configuration sections.
3. Add presentation-only motion with reduced-motion support. Preserve real formatted values, chart datasets, flow signs/thresholds, freshness states, settings/control logic, configurable widget order and every existing action.
4. Compare the result with the references and verify routes, themes, responsive layouts, long values, source boundaries, browser workflows, accessibility samples, lint/type checks and the production build.

Backend, DESSMonitor integration, API calls/payloads, authentication, database, calculations, polling, routes and environment files are outside the change boundary. The architectural image is decorative artwork and is not a photograph of the user's installation.

## Original asset

Generated with the built-in imagegen tool; final delivery asset: `public/images/solar-home-at-dusk.webp`. The original generated PNG is preserved in the Codex generated-images directory.

Prompt:

> Use case: photorealistic-natural. Asset type: cinematic background photograph for a premium solar-energy monitoring website. Create an ORIGINAL architectural scene, not a screenshot or UI. A sophisticated low horizontal modern home with charcoal stone, warm timber, floor-to-ceiling glass and a clearly visible photovoltaic array on its sloping roof, situated on a quiet rocky hillside with sparse ornamental grasses. Three-quarter elevated camera view so solar panels are legible. Wide panoramic composition approximately 3:1: the architecture occupies the right two thirds, the left third is quiet dark atmospheric negative space for live interface content. Blue-hour sky, a faint warm horizon, softly illuminated amber interior, deep graphite and slate-blue materials, restrained cinematic contrast and natural detail. Elegant and believable contemporary architecture, not science-fiction. No people, no vehicles, no text, no numbers, no logos, no watermarks, no charts, no dashboard interface, no visible cables or floating energy icons. This is an illustrative atmosphere asset, not the user's real installation. Avoid magenta or neon, avoid excessive glow, avoid exaggerated saturation. Crisp high quality editorial architectural photography.

## Completed design and comparison

The dashboard now combines an original architectural hero and oversized translucent ENERGY lettering with a compact graphite sidebar, one connected live-energy instrument, an integrated diagnostics rail, a large chart and an event timeline. The same slate/ivory materials, 16-pixel panel radius, restrained borders, spacing, form controls and typography apply across monitoring, analytics, devices, alerts, controls, settings and authentication. Light mode uses warm ivory surfaces while preserving the same composition and dark navigation.

Against the supplied references, the result takes layered monitoring composition from the analytics image, a large atmospheric visual area from the architectural images, and editorial type scale from TERRA. Energy colors stay tied to the original solar/consumption/battery/grid series; reference branding, layouts, magenta graphics and artwork are not copied. The original backdrop is shared by the overview and authentication surfaces and is delivered locally as a 165,552-byte WebP.

The shared Reading component subdivides an already-formatted string into number and unit spans. It preserves every character, sign, decimal and unit; it does not recalculate or round measurements. CSS fades the displayed number when the real value changes. Battery fill uses the existing SOC value and is absent when SOC is unavailable. Original flow direction and movement thresholds are unchanged. Charts retain their original datasets, linear interpolation, missing-data gaps and formatter; CSS adds a restrained entrance fade rather than generating intermediate readings.

Motion covers panel entry, live status, energy particles, number updates, battery fill, sidebar selection, hover/press feedback, dropdown surfaces, dialogs and skeletons. Existing reduced-motion handling suppresses motion. There are no new request intervals, timers, integration calls or application states.

On mobile, joined two-column readings and compact diagnostics remain prominent. Alerts precede charts only for the default widget sequence; custom saved widget order and visibility continue to govern customized layouts. The existing status/freshness strip stays above the instrument.

## Validation

- Production build, lint and strict TypeScript checks passed.
- Both existing browser workflows passed: monitoring, alert acknowledgement, mock control review/application, login/registration/logout and tenant isolation.
- Final route captures cover 15 routes at 1440, 1280, 768 and 390 pixels, plus dark overview/controls: 62 captures with zero browser errors and zero page-overflow findings. Additional captures cover authentication, loading/empty states, tooltips, long all-time values, hidden widgets and 320/360/390-pixel layouts.
- Date and alert filters, tooltip units/precision, loading/empty states, saved widget layout controls, full-width standalone instruments and mobile alert priority passed.
- Sampled text contrast on overview, alerts, settings and controls is at least 4.62:1 in light mode and 7.92:1 in dark mode, accounting for translucent background layers. Visible focus, skip navigation, sidebar labels, mobile navigation and dialog Escape passed. These are targeted checks, not a full accessibility certification.
- Live flow animation, SOC clipping and reduced-motion suppression passed runtime checks. The existing dialog focus-return limitation remains unchanged and documented.
- Protected hashes confirm 39 existing files are unchanged, including backend/API, authentication logic, providers, database/schema, worker, configuration and environment files. AST comparison verifies original frontend executable logic, handlers, data expressions and dynamic content in ten audited components after excluding presentation markup, equipment drawings and connector geometry.

Application source changes are confined to `globals.css`, the Metric presentation in `dashboard.tsx`, the visual markup in `energy-flow.tsx`, and the new `ui/reading.tsx` typography component. `power-chart.tsx`, authentication handlers and every API/provider/database file are unchanged in this pass. Test harness changes improve presentation coverage and translucent-background contrast measurement.

The app remains in its existing demo/mock mode. No live DESSMonitor connection or control capability was introduced. Source snapshots, screenshots and the private browser session under `.data/cinematic-solar` remain local ignored artifacts.
