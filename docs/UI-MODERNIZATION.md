# UI modernization plan and audit

Scope: presentation only, following the user's pasted request. No backend, API, DESSMonitor, authentication, database, environment, route, event handler, state, filtering, calculation or synchronization changes are authorized by this redesign.

## Presentation inventory and bindings

| Component                                            | Existing source / interaction                                                                                           | Presentation work                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `dashboard/dashboard.tsx`: shell, navigation, header | Existing `section`, `navigation`, selected device, profile, search, theme, notifications and handlers                   | Spacing, visual groups, active/focus treatments, accessible labels for collapsed navigation                    |
| Shared `Panel` and `Metric`                          | Existing title, value, subtitle, icon, action and children props                                                        | Consistent hierarchy, typography, restrained accents, surface treatment                                        |
| Overview and monitoring                              | Existing latest reading, freshness, connection state, timestamps, today aggregates, saved widgets and live timeline     | Responsive presentation and readable status treatments                                                         |
| `energy-flow.tsx`                                    | Existing PV/load/battery/grid/SOC props, active state and signed directions; existing node destinations                 | Node surfaces, connectors, energy colors and focus states; retain unavailable values and all existing bindings |
| `charts/power-chart.tsx`                             | Existing rows, data transformation, gap handling, units, filters and series                                             | Colors, axis/legend/tooltip styling only; preserve interpolation and formatting                                |
| `analytics-page.tsx`                                 | Existing date periods, aggregation, totals, comparisons, heatmap, pagination and downloads                              | Summary/card accents, filters, chart/table hierarchy and responsive spacing                                    |
| Alerts in `dashboard.tsx`                            | Existing filtered alert list, original order, severity, source, timestamps and acknowledgement handler                  | Scannable rows, severity badges, semantics and mobile action placement                                         |
| `controls-page.tsx`                                  | Existing field metadata, role/safe-mode checks, current/requested values, confirmation, command states and audit dialog | Form section layout, disabled states and confirmation presentation                                             |
| `settings-page.tsx`                                  | Existing profile, preferences, aliases, widgets, tariffs, integration/account actions and forms                         | Field spacing, panel grouping, actions and focus states                                                        |
| `ui/button.tsx`, `ui/dialog.tsx`                     | Existing variants, open/close handlers and Radix keyboard/focus behavior                                                | Shared styling; preserve props and interaction behavior                                                        |
| Dashboard loading and existing error/empty states    | Existing rendering branches, messages and retry/reset handlers                                                          | Loading surfaces and semantic presentation, no new values                                                      |

Routes retained: `/dashboard`, and `/dashboard/live`, `/analytics`, `/energy`, `/battery`, `/grid`, `/inverter`, `/alerts`, `/controls`, `/history`, `/devices`, `/settings`, `/account`, `/integrations`, `/monitor`. Login, signup, password reset, terms and all API routes remain unchanged.

The current CSS breakpoints are 1500, 1200, 1000, 800 and 600 px. The sidebar is full width on desktop, an icon rail below 1000 px, and the existing drawer below 600 px. The redesign keeps this navigation pattern and all destinations.

## Phases and per-component checklist

1. Audit, save source/hash baseline, and capture desktop (1440), laptop (1280), tablet (768) and mobile (390) screenshots before implementation.
2. Introduce consistent neutral and semantic tokens, typography, spacing, radii, shadows and 180–220 ms interactions. Refine the shell and shared cards.
3. Restyle existing flow, charts, alerts, controls and settings without modifying any binding or handler. Add semantic labels and focus treatments to existing controls.
4. Verify all routes at the four target widths, both themes, keyboard focus, overflow and existing workflows. Compare final screenshots and protected-file hashes.
5. Run lint, strict type checking, existing tests and production build. Record results and material limitations here.

For every affected component: preserve displayed content and units; preserve handlers and props that govern behavior; preserve loading/error/empty branches; keep all existing controls reachable; review light/dark and narrow layouts; verify the diff against the saved source.

No new trends, weather, health metrics, telemetry fields or controls will be added. The existing flow keeps unavailable readings explicit; no direction is inferred when signed power is unavailable. If a requested enhancement would require new data or state, it is excluded from this presentation-only change.

Baseline and final screenshots, protected-file checksums and source copies are saved under the ignored `.data/ui-modernization/` directory.

## Completed implementation

- Introduced neutral light/dark surfaces, readable text tokens, semantic energy/status colors, spacing and typography scales, consistent radii and 200 ms interaction treatments. Retained the existing reduced-motion preference.
- Refined the sidebar, active route markers, icon rail labels, header, inverter selector, freshness stripe, shared metric cards and panels. The original desktop/rail/drawer navigation pattern and every destination remain intact.
- Matched solar/consumption/battery/grid colors across cards, flow nodes, connectors, chart series and summary values. Preserved all readings, sign/direction checks, unavailable values, paths, chart transformations, formatting, linear interpolation and gap handling.
- Improved alerts with severity badges and responsive action placement; improved existing control/settings forms, confirmation surfaces, disabled controls, tables, empty/error surfaces and loading semantics through shared styles.
- Preserved saved widget order and all original event handlers, requests, permissions, state, timers, filters, calculations and workflows.

Only six existing source files changed: `globals.css`, dashboard loading markup, dashboard presentation markup, analytics metric tones, flow presentation and chart styling. Settings/control/Button/Dialog logic and all backend files remain unchanged.

## Validation results

- Before: 62 screenshots covering 15 routes at 1440, 1280, 768 and 390 px, plus two dark-theme captures. No page overflow or browser errors.
- After: the same 62 captures, plus mobile confirmation. No page overflow or browser errors. Reviewed the overview, analytics, monitoring, alerts, settings, integrations and confirmation presentation at the target widths.
- AST comparison: executable code, event handlers, data bindings and content are unchanged across all 10 audited presentation components after excluding only allowed presentation attributes and connector colors.
- Hash comparison: all 39 protected source/configuration/environment/database/worker files match the baseline.
- Sampled normal-text contrast: minimum 4.89:1 in light mode and 6.24:1 in dark mode across overview, alerts, settings and controls. This is a targeted contrast check, not a full accessibility audit.
- Keyboard checks: visible 2 px focus indicator, skip link, accessible icon-rail labels, mobile drawer activation/navigation and Escape dismissal of confirmations passed.
- Lint, strict TypeScript checking, 37 existing tests, optimized production build and both existing browser workflow tests passed. Browser regressions covered signup/login/logout, tenant isolation, analytics, acknowledgement, confirmed mock control execution and SSE update, audit/security checks, widget ordering, theme switching and mobile navigation.

The final local preview runs the production build at `http://127.0.0.1:3000` with the existing database and synchronization worker.

## Preserved limitations and excluded changes

- The existing controlled Radix dialog has no Trigger and does not automatically restore focus to the Review change button on close. Its source is unchanged. Fixing the close/focus interaction would exceed the explicit presentation-only boundary, so this limitation is recorded in the accessibility report.
- Initial baseline capture exposed an existing implicit-locale hydration difference with the browser's default locale. The capture harness explicitly uses `en-US`, matching current server formatting. Application date formatting was not changed.
- Telemetry and freshness change naturally while the existing worker runs. Screenshot values may therefore differ between captures; source comparisons verify that their bindings and calculations did not change.
- Flow availability continues to use the existing explicit unavailable/last-known-data presentation. No new conditional behavior, inferred direction, data field, trend or value was added.
- Chart interpolation remains linear to preserve existing visual meaning; no new chart data or smoothing was introduced.

The optional local QA scripts are `tests/ui-capture.ts`, `tests/ui-boundary.ts` and `tests/ui-accessibility.ts`. Capture the `before` phase before a new redesign, then use `UI_CAPTURE_PHASE=after` for the protected-file comparison and final screenshots. Do not overwrite the saved `before` phase after modifying source. These artifacts use a private demo fixture and remain in the ignored local data directory.
