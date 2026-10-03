# Browser feedback fixes

This change addresses the ten comments on the redesigned solar dashboard. It changes frontend presentation and navigation only.

- The energy-system label opens a selector populated by existing devices, with links to Devices and Integrations. Selecting a device retains the current section and its device query.
- Sidebar and header profile buttons open Account, Settings and Sign out. Logout uses the existing authenticated logout action. Settings and Account no longer occupy separate sidebar rows; the descriptive sidebar note is removed.
- Solar, consumption, battery and grid summary cards link to their existing detail pages for the selected inverter.
- Desktop and tablet keep the app frame within the viewport. Main content and navigation scroll independently, while the profile remains reachable. Phones retain ordinary document scrolling. Main content fills its available column.
- Energy flow uses dimensional SVG equipment on isometric platforms, retaining real values, node routes, SOC fill, direction thresholds and inactive-flow behavior. It supports both existing themes and reduced motion.
- Aggregated energy is rendered as a line/area graph, preserving the original kWh conversions, suspect/null handling and tooltip units.
- Longer charts have a visible time rail, native horizontal scrolling, earlier/later controls, Latest, All readings and keyboard navigation. Horizontal or Shift-wheel gestures pan the timeline; ordinary vertical scrolling moves the page. The overview initially displays its full day. Navigation browses only loaded samples and makes no extra provider requests.

## Verification

- Production build and TypeScript checks passed.
- Lint passed; temporary diagnostic instrumentation was removed.
- Existing unit tests: 37 passed. Existing application journeys: 2 passed, including controls, authentication and tenant isolation.
- Browser regression checks passed for actual menu navigation, logout, summary-card routes, viewport containment, graph tooltips and scrolling controls.
- 62 route/viewport screenshots: zero browser errors and zero horizontal overflow findings. Targeted viewport checks include 1864×884, 1280×600, 768×600, 390×844 and 320×568.
- Sampled text contrast in both themes, keyboard-operated account menus, mobile drawer navigation and confirmation-dialog Escape passed. The existing controlled confirmation dialog's focus-return limitation remains unchanged.
- Hash comparison confirmed 40 protected backend, provider, route, database, worker and configuration files are unchanged. Numeric telemetry transformations and energy-flow conditions were separately compared with the prior source.

Local QA artifacts are stored under `.data/ui-feedback/`. Private session files are not part of the deliverable.
