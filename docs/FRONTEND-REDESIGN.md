# Energy monitoring console redesign

This redesign follows the new frontend-only brief. The previous modernization is the baseline, preserved under `.data/ui-modernization`; new source copies, protected-file hashes and screenshots are recorded separately under `.data/energy-console` before editing application source.

## Audit and implementation plan

The current frontend uses shared Metric/Panel components, one EnergyFlow visualization, one PowerChart, reusable settings/control forms, Radix confirmation dialogs and responsive full-sidebar/icon-rail/drawer navigation. Dashboard values come from the existing DashboardData snapshot; analytical data comes from the existing analytics request and transformation; flow uses the existing signed power and availability checks. Theme and widget order are saved through existing preferences. None of these behaviors will change.

1. Record the current source and visual baseline at desktop, laptop, tablet and mobile widths.
2. Replace the current rounded-card composition with a compact monitoring shell, a connected instrument strip, an engineering schematic, asymmetric status rail, dominant production chart and event timeline. Treat dark graphite as the primary design direction, with a matching light theme and unchanged theme choices.
3. Apply the same design language to all monitoring/analytics/device routes, hardware configuration rows, account/integration forms, authentication surfaces, loading/empty/error states and confirmation dialogs. Reuse every existing value, action and control.
4. Review both themes and all routes at the target widths; verify keyboard/focus/contrast, source boundaries, existing browser workflows, type/lint checks, tests and the production build.

No backend, API, DESSMonitor adapter, authentication behavior, database, environment, routes, request payloads, timers, settings/control logic, calculations or filtering may change. Decorative SVG equipment illustrations and connector geometry are presentation only. No new telemetry, weather, trends, inferred values or hardware controls are introduced. Saved widget order and responsive navigation remain functional.

The existing dialog focus-return limitation and implicit-locale formatting behavior are retained because changing them would alter behavior outside this brief.

## Completed implementation

The interface now uses a graphite monitoring shell, compact navigation, connected metric strips, a dominant equipment schematic, an asymmetric diagnostics rail, a larger production chart and alert timelines. Light mode uses the same hierarchy with neutral surfaces. Controls are presented as hardware configuration rows, with restrained emphasis for existing high-impact settings. Shared styles also cover analytics, device tables, account/integration forms, authentication, loading, empty/error states and confirmation dialogs.

Application changes are limited to five presentation files: `globals.css`, `dashboard.tsx`, `controls-page.tsx`, `energy-flow.tsx` and `power-chart.tsx`. Equipment drawings and connector geometry are decorative; the existing flow direction, thresholds, signed values and links remain intact. Custom chart tooltips reuse the existing formatter and preserve values, units and precision. Static overview labels were revised to suit the monitoring console. Long mobile metrics wrap without shortening values or changing their formatting.

## Validation

- Production build, lint and strict TypeScript checks passed.
- All 37 unit/provider tests and both existing browser workflow tests passed. Browser workflows exercise monitoring, alerts, mock control confirmation/application, authentication, permissions and tenant isolation.
- Final captures cover 15 dashboard routes at 1440, 1280, 768 and 390 pixels, plus dark overview/controls: 62 screenshots, zero browser errors and zero page-overflow findings. Additional captures cover tooltips, authentication, loading/empty states, mobile confirmation and long all-time values.
- Power, battery-percentage and energy tooltips preserve kW, %, kWh and two-decimal formatting. Date and alert filters, loading states and actual empty historical intervals passed browser checks.
- Source hashes confirm 39 protected files are unchanged, including backend/API, authentication logic, providers, database/schema, worker, configuration and environment files. A semantic AST comparison verifies executable logic, handlers, data bindings and dynamic content in 10 frontend components after accounting for documented presentation changes.
- Keyboard checks passed for the skip link, responsive navigation and dialog Escape. Focus indicators remain visible. Sampled text contrast on overview, alerts, settings and controls exceeded 4.78:1 in light mode and 7.74:1 in dark mode; this is a targeted check, not a complete accessibility certification.

The running application remains in its existing mock/demo mode. No DESSMonitor integration, credentials, API behavior, database data model or control execution logic was changed. Screenshot fixtures and source snapshots are local ignored artifacts under `.data/energy-console`; they contain no production credentials and should remain private.
