# Main dashboard composition

## Implementation plan

Scope: the main `/dashboard` overview only. Keep all existing data, state, requests, event streams, calculations, routes, authentication, settings and control behavior unchanged.

1. **Primary dashboard reference.** Adapt the dark Meet AI reference's proportions: a narrow sidebar, a compact header, a broad primary module on the left, and a smaller supporting column. Join the existing four live readings to the energy-flow panel instead of presenting another isolated card row. Place a large production/consumption chart directly below the live module, with diagnostics and the alert feed in the supporting column. Use tight spacing, unequal panel sizes, inset divisions and restrained pink illumination to create one organized composition.
2. **Architecture references.** Borrow TERRA's oversized lettering behind the content, overlapping foreground/background layers, and the architectural home's atmospheric lighting. Keep the header compact; use the existing original solar-home image as a subdued environmental layer within the instrument panel instead of another large marketing hero.
3. **Difference from the current page.** Replace the tall header and long vertical stack with a dense desktop control center. Give live numbers an editorial scale, make the energy diagram the central visual anchor, and bring the chart and supporting panels into the same viewport. Add chart reveals, illuminated navigation/hover states and clearer energy motion. Tablet and mobile use deliberately reorganized modules, while custom widget visibility and ordering retain their existing behavior.

## Implementation boundary

Use an overview-only CSS module and attach its root class only when the current section is `overview`. Shared styles and shared energy/chart components remain unchanged. This isolates the new composition from every other page, including the fullscreen monitor, controls and settings.

## Verification

Capture before/after desktop, laptop, tablet and mobile views. Verify protected source hashes, compare the dashboard's non-presentation source, check other pages' presentation is unchanged, and exercise existing dashboard interactions and saved widget layouts. Run lint, type checking, the production build and the existing application tests.

## Result

The default desktop overview uses a 176px sidebar, compact editorial heading, joined live-reading/energy-flow module on the left, diagnostics on the right, and a large chart with a supporting alert feed below. Solar/home readings have more prominence than battery/grid readings. Restrained pink reflections, equipment-colored moving paths, an architectural background layer, a chart reveal and number/nav transitions add depth without changing the underlying readings.

At 1440px width, the complete page is about 1,223px tall compared with the previous 2,089px. Mobile puts system status first, followed by solar/home/battery/grid readings and energy flow, then alerts before the chart. Customized layouts retain their saved visibility and DOM ordering.

Application changes are confined to the new `overview.module.css` and one conditional root class/import in `dashboard.tsx`. Every other snapshotted presentation file, including global styles and the shared energy/chart components, remains byte-identical. The boundary-check helper now recognizes CSS-module imports as presentation.

Validation completed:

- Lint, strict type checking and the production build passed.
- Both existing application journeys passed, including mock monitoring/control and authentication/tenant isolation.
- Protected hashes matched for 40 backend, database, worker, configuration and other source files. Executable logic, handlers, data bindings and dynamic content matched the baseline across all 10 checked components.
- All 15 dashboard routes were captured at desktop, laptop, tablet and mobile widths, with no browser errors or horizontal overflow. The final overview was additionally captured in both themes at all four sizes.
- Overview style isolation was verified on all 14 other dashboard routes. Customized widget visibility/reordering, standalone modules, 320/360/390px layouts, chart tooltips and the existing filters/loading/empty states passed the presentation checks.
- Navigation, reading, flow and chart animations are present in normal mode and disabled for reduced motion. Corrected overview panel corners were verified against the old global rules.
- Sampled overview text contrast is at least 4.70:1 in light mode and 8.38:1 in dark mode. Skip-link focus, rail labels, mobile navigation and dialog Escape checks passed. The pre-existing controlled dialog's focus-return limitation remains unchanged because controls are outside this request.

Screenshots and local QA records are in `.data/dashboard-composition/`; the private test session remains in that ignored directory.
