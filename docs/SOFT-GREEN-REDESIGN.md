# Soft green dashboard redesign

## Reference analysis and implementation plan

1. **Layout structure.** The supplied Donezo screenshot uses a large white rounded application frame on a cool gray page. An off-white sidebar takes about 17% of the frame's width. A shallow rounded header sits above an off-white content area. Four compact summaries lead into a mixed-size widget composition, with a broad analytics panel and narrower supporting panels.
2. **Spacing system.** Use an 8px base, 12–16px widget gaps, 20–24px card padding and about 32px around the desktop app frame. Keep sections aligned to the same column edges. Reduce outer framing on tablet/phone and use the existing rail/drawer navigation.
3. **Card styles.** White cards on a very light gray canvas, approximately 20px corners, quiet borders and soft shadows. The solar-production summary receives the reference's green emphasis; the other readings stay white. Pills, circular icon containers and light green selected states make controls consistent with the cards. Avoid background photos and ambient lighting.
4. **Typography hierarchy.** A clean 36–40px page title, compact 17–18px widget headings, 42–50px summary values, 12–14px supporting text and quieter units. Use clear weight differences and tabular numbers without oversized background lettering.
5. **Translation to solar.** Reuse the existing solar, home, battery and grid summaries. Place the real production/consumption chart in a broad panel, with the existing system diagnostics and alert feed beside it. Place the live energy diagram below, within a wide matching panel. Preserve saved widget visibility/ordering, real readings, stale/offline states, all links and all actions. Apply the same light/green surface system to the existing dashboard shell and supporting pages.

## Implementation boundary

Presentation only: scoped CSS modules and dashboard presentation classes. Preserve backend source, routes, authentication, database logic, DESSMonitor providers, calculations, request payloads, polling and inverter/control/settings behavior. Shared chart/flow data and formatting remain intact. Keep the existing optional theme toggle functional; the supplied light design is the primary visual treatment.

## Verification plan

Capture the current application before edits. Verify backend/configuration hashes and compare executable frontend logic/data bindings against the baseline. Build and check types/lint; exercise the existing application journeys and presentation checks. Review desktop, tablet and phone captures against the reference for frame proportions, card spacing, readability and overflow.

## Completed design

The dashboard now uses a cool gray outer page, a white 30px rounded frame, a continuous off-white sidebar column, a 76px rounded header, and white 20px cards. The solar-production card is forest green; the other live readings remain white. The real daily energy chart and system diagnostics share the first widget row, with live energy flow and recent alerts below. Custom saved layouts retain their existing order and visibility. On phones the summary readings lead, followed by status/flow/alerts and the chart.

The shared workspace layer gives the existing analytics, equipment, alerts, controls, settings and integration pages matching surfaces, navigation, pills, inputs and chart styling. The header displays the existing user's initial, name and email through the same account link. The primary treatment follows the supplied light reference; the existing optional theme control continues to work.

Application edits are limited to `dashboard.tsx` presentation markup/classes, the replaced `overview.module.css` and the new `workspace.module.css`. Global styles, backend code, providers, routes, schema, worker logic, chart data/formatting and control/settings logic are unchanged. Verification helpers explicitly account for the CSS modules and the read-only account identity block.

## Verification results

- Lint, strict type checking and the production build passed.
- Both existing application journeys passed: mock monitoring/control and authentication/tenant isolation.
- The 40 protected backend/configuration/other source files matched their baseline hashes. Existing executable frontend logic, handlers, data bindings and dynamic content matched the baseline in all 10 checked components; the new account identity only displays already-supplied data.
- All 15 dashboard routes were captured at 1440, 1280, 768 and 390px widths, with no browser errors or horizontal overflow.
- Existing power/SOC/energy tooltips, date/alert filters, loading/empty states, saved widget visibility/reordering and 320/360/390px reading layouts passed the presentation checks.
- Sampled text contrast passed in both themes, as did skip-link focus, rail labels, mobile drawer navigation and dialog Escape. The pre-existing controlled dialog's focus-return limitation was recorded without changing its behavior.
- Reviewed the desktop and phone overview against the supplied reference and corrected the full-height sidebar material and low-contrast colored legend labels.

Screenshots and QA records are in `.data/soft-green/`. The private test-session file remains in that ignored directory.
