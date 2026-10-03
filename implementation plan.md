# BUILD A PRODUCTION-QUALITY DESSMONITOR SOLAR INVERTER DASHBOARD

Build a complete, modern, secure, responsive web application for monitoring and managing solar inverter systems through the official DESSMonitor Open Platform API.

This is NOT a generic solar-company marketing website.

This website is a dedicated technical dashboard for:

- monitoring a solar inverter,
- viewing live and historical inverter data,
- monitoring solar generation,
- monitoring battery charging/discharging,
- monitoring grid import/export,
- monitoring household/load consumption,
- displaying inverter state and operating mode,
- receiving inverter alerts and notifications,
- analyzing performance over time,
- changing supported inverter settings,
- securely sending supported configuration commands back to the inverter,
- supporting multiple users,
- allowing each user to connect their own DESSMonitor account/API credentials,
- supporting multiple plants/inverters per user when the account provides them.

The result must feel like a polished commercial energy-monitoring application.

Examples of the visual quality to aim for:

- Tesla Energy
- SolarEdge Monitoring
- Enphase
- Victron VRM
- modern SaaS monitoring dashboards

Do NOT copy those products.

Create an original interface.

---

# 1. REQUIRED TECHNOLOGY STACK

Build the application using:

Frontend:
- Next.js latest stable version
- App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Recharts for analytics
- date-fns for date handling

Backend:
- Next.js server routes / server actions where appropriate
- TypeScript
- PostgreSQL
- Prisma ORM

Authentication:
- Auth.js / NextAuth or another robust authentication system
- Email/password authentication
- secure sessions
- password hashing
- optional OAuth-ready architecture

Realtime updates:
- Server-Sent Events or WebSockets between our backend and frontend
- DO NOT constantly call DESSMonitor directly from the browser

Caching / synchronization:
- Database-backed data synchronization
- optional Redis-compatible caching abstraction
- background polling architecture

Validation:
- Zod

Production requirements:
- environment variables
- typed API layer
- logging
- rate limiting
- proper error handling
- responsive UI
- dark/light theme
- accessibility

---

# 2. CRITICAL ARCHITECTURE RULE

NEVER call the DESSMonitor API directly from client-side React code.

The architecture must be:

DESSMonitor
        ↓
Server-side DESSMonitor Adapter
        ↓
Normalization Layer
        ↓
Database / Cache
        ↓
Application API
        ↓
Realtime Event Layer
        ↓
Browser Dashboard

DESSMonitor passwords, tokens, secrets, company keys, authentication information and signing logic MUST remain server-side.

Never expose them to:

- frontend JavaScript,
- browser localStorage,
- browser sessionStorage,
- page HTML,
- source maps,
- public environment variables.

---

# 3. DESSMONITOR INTEGRATION

Create a dedicated integration layer:

/lib/dessmonitor/

Suggested structure:

client.ts
auth.ts
signing.ts
types.ts
normalizer.ts
devices.ts
projects.ts
collectors.ts
telemetry.ts
analytics.ts
controls.ts
alerts.ts
errors.ts
mock.ts

DO NOT scatter DESSMonitor requests throughout the codebase.

Every interaction with DESSMonitor should pass through this adapter.

---

# 4. IMPORTANT: DO NOT INVENT DESSMONITOR ENDPOINTS

Follow the official DESSMonitor Open Platform API documentation.

The integration must be modular because inverter capabilities vary depending on:

- protocol,
- manufacturer,
- devcode,
- firmware,
- account permissions,
- distributor permissions,
- inverter model.

Never assume that every inverter exposes the same readings or settings.

If an API operation is not documented or is unavailable for a device:

DO NOT fabricate it.

Instead display:

"Not supported by this inverter"

or

"Unavailable through DESSMonitor API"

---

# 5. DESSMONITOR AUTHENTICATION MODEL

Do NOT treat DESSMonitor as a generic:

API_KEY=12345

service.

Implement its documented authentication architecture.

Support storing encrypted integration credentials such as:

- DESSMonitor username
- DESSMonitor password
- company key
- platform/source configuration
- application identifier if required

The server-side integration obtains the appropriate:

- token
- secret

through DESSMonitor authentication.

Then generate properly signed API requests according to DESSMonitor's documented signing system.

Create reusable methods such as:

authenticate()

createSignature()

callDessMonitor()

refreshSessionIfNeeded()

handleDessMonitorError()

NEVER allow signing secrets to reach the browser.

---

# 6. DEMO MODE — ABSOLUTELY REQUIRED

The website must work WITHOUT real solar hardware or private credentials.

Create:

DESSMONITOR_MODE=mock

and:

DESSMONITOR_MODE=live

During initial development use:

DESSMONITOR_MODE=mock

DO NOT put a fabricated "real API key" into the project.

Instead create a complete MockDessMonitorAdapter implementing the exact same internal interface as the real adapter.

For example:

DessMonitorProvider {
    authenticate()
    getProjects()
    getCollectors()
    getDevices()
    getLatestData()
    getHistoricalData()
    getEnergyFlow()
    getControlFields()
    setControlValue()
    getAlerts()
}

Both:

MockDessMonitorProvider

and

LiveDessMonitorProvider

must implement this interface.

This lets the entire application work before real credentials are available.

---

# 7. REALISTIC MOCK SOLAR SYSTEM

Create a realistic demo system.

Example:

Site:
Sulaimani Solar Home

Inverter:
Demo Hybrid 8K

Serial:
DEMO-INVERTER-001

Status:
Online

PV capacity:
10.4 kWp

Battery:
15 kWh

Grid:
Connected

Generate realistic changing values every simulated polling cycle.

Example daytime readings:

PV Power:
4.82 kW

Load:
2.31 kW

Battery:
+1.74 kW charging

Grid:
+0.77 kW export

Battery SOC:
73%

Battery Voltage:
51.8 V

Battery Current:
32.4 A

Grid Voltage:
229.8 V

Grid Frequency:
49.99 Hz

Inverter Temperature:
42.6 °C

Today's Solar Generation:
24.7 kWh

Today's Consumption:
18.9 kWh

Grid Import:
3.6 kWh

Grid Export:
9.4 kWh

Battery Charge:
8.2 kWh

Battery Discharge:
5.9 kWh

Make the data realistic and internally consistent.

For example:

solar production should roughly equal:

load consumption
+ battery charging
+ grid export
- grid import

within reasonable conversion losses.

---

# 8. DATA SYNCHRONIZATION ENGINE

DESSMonitor does not need to be hammered continuously.

Create a synchronization engine.

Default:

poll every 2 minutes

but make this configurable:

DESSMONITOR_SYNC_INTERVAL_SECONDS=120

When a sync happens:

1. authenticate if required
2. retrieve latest inverter data
3. normalize response
4. compare timestamp with most recently stored reading
5. determine whether new data exists
6. store new readings
7. update device state
8. process alert changes
9. calculate derived metrics
10. broadcast an event to connected dashboards

The frontend should update immediately after new server-side data has been processed.

Use:

Server-Sent Events

or:

WebSockets

for backend → dashboard notifications.

DO NOT make every connected browser independently poll DESSMonitor.

---

# 9. LIVE UPDATE INDICATOR

The dashboard header must clearly show:

LIVE

Online / Offline

Last inverter reading:
22:42:15

Last server sync:
22:43:02

Next scheduled sync:
~1m 18s

Include a subtle animated green status indicator when online.

If the inverter has stopped reporting:

Online
→ Delayed
→ Offline

Example rules:

Fresh:
less than 5 minutes

Delayed:
5–15 minutes

Offline:
more than 15 minutes

Make thresholds configurable.

---

# 10. DATA FRESHNESS

Every reading should internally contain:

deviceTimestamp

receivedAt

processedAt

Do not treat these values as identical.

Display the device timestamp when available.

When old data is displayed, clearly mark it as:

STALE DATA

Never make stale readings appear live.

---

# 11. DESSMONITOR DEVICE DISCOVERY

Implement the documented hierarchy:

Account
→ Project / Plant
→ Collector
→ Device

After connecting an account:

discover available projects

then collectors

then devices.

Store:

project ID

collector PN

device SN

devcode

devaddr

device alias

device timezone

device status

and any other useful identifiers returned by DESSMonitor.

Allow a user to select which inverter they want to monitor.

---

# 12. MULTIPLE INVERTERS

Architect the entire application for multiple devices even if the demo initially contains one inverter.

Include a device selector:

Sulaimani Solar Home
  Hybrid Inverter 01
  Garage Inverter

Office Solar
  Main Inverter

Selecting a device updates the entire dashboard.

---

# 13. DASHBOARD NAVIGATION

Create a desktop sidebar and mobile navigation.

Sections:

Overview

Live Power

Analytics

Energy

Battery

Grid

Inverter

Alerts

Controls

History

Devices

Account

Settings

---

# 14. OVERVIEW PAGE

The Overview should immediately answer:

What is happening right now?

Top cards:

Solar Production

Home / Load Consumption

Battery Power

Battery SOC

Grid Power

Today's Energy

Inverter Status

Example:

Solar
4.82 kW

Load
2.31 kW

Battery
73%
Charging · 1.74 kW

Grid
Exporting · 0.77 kW

Today
24.7 kWh generated

---

# 15. ENERGY FLOW VISUALIZATION

Create a beautiful animated energy-flow diagram.

Nodes:

SOLAR

BATTERY

HOME / LOAD

GRID

INVERTER

Use animated directional lines showing energy movement.

Example:

SOLAR
4.82 kW
     ↓
INVERTER
   ↙ ↓ ↘
Battery Home Grid
1.74kW 2.31kW 0.77kW

Direction must dynamically change.

Examples:

Grid → Home

Solar → Battery

Battery → Home

Solar → Grid

Grid → Battery

Animate the flow subtly.

Do not use excessive animation.

Clicking a node opens detailed statistics.

---

# 16. LIVE POWER PAGE

Create a dedicated realtime monitoring screen showing:

PV input power

PV1

PV2

PV voltage

PV current

AC output

Load

Grid

Battery

temperature

frequency

operating mode

state

additional protocol fields

Use cards plus time-series charts.

Provide selectable windows:

30 minutes

1 hour

3 hours

6 hours

12 hours

24 hours

---

# 17. DYNAMIC DEVICE PARAMETERS

Do not hard-code every possible DESSMonitor measurement.

Different protocols expose different fields.

Create a dynamic parameter renderer.

Normalize fields into:

{
  id
  title
  value
  unit
  category
  timestamp
}

Automatically group values into categories:

Solar

AC Output

Grid

Battery

Load

Temperature

Energy

System

Other

Unknown fields should still appear under:

Advanced → Raw Parameters

This makes the application compatible with more inverter models.

---

# 18. ANALYTICS PAGE

Create professional historical analytics.

Time periods:

Today

Yesterday

7 Days

30 Days

Month

Year

All Time

Custom Range

Metrics:

Solar Generation

Consumption

Battery Charge

Battery Discharge

Grid Import

Grid Export

Peak Solar Power

Peak Load

Self Consumption

Solar Utilization

Grid Independence

Battery Utilization

Estimated Conversion Loss

Average Inverter Temperature

Runtime

Offline Time

---

# 19. DAILY ANALYTICS

For a selected day show:

Total generation

Total consumption

Grid imported

Grid exported

Battery charged

Battery discharged

Peak PV power

Peak demand

Solar self-consumption

Approximate solar coverage

Generation graph

Consumption graph

Battery SOC graph

Grid graph

Power-flow graph

---

# 20. WEEK ANALYTICS

Show:

Daily generation bar chart

Daily consumption

Grid import

Grid export

Battery usage

daily peak production

daily peak load

comparison with previous week

Example:

Solar generation
This week: 183.4 kWh

Previous week: 169.2 kWh

Change:
+8.4%

---

# 21. MONTH ANALYTICS

Show:

daily energy production

daily consumption

monthly total

daily average

highest production day

lowest production day

grid independence

battery cycles / estimated equivalent cycles

comparison with previous month

---

# 22. YEAR ANALYTICS

Show one summarized value per month.

Charts:

Monthly Generation

Monthly Consumption

Grid Import / Export

Battery Throughput

Self Consumption

Estimated Savings

Allow year selection.

---

# 23. ALL-TIME SUMMARY

Create an Overall Performance page.

Display:

Total solar produced

Total energy consumed

Total grid import

Total grid export

Total battery throughput

Average daily solar generation

Peak recorded output

Total inverter operating hours where data permits

First recorded date

Last recorded date

Number of recorded data points

System availability

---

# 24. CALENDAR HEATMAP

Add a GitHub-style solar-generation heatmap.

Each square represents one day.

Low generation → subtle shade

High generation → stronger shade

Hover:

October 2, 2026

Generated:
31.8 kWh

Consumed:
22.3 kWh

Exported:
9.1 kWh

---

# 25. DAY COMPARISON

Allow users to compare:

Today vs Yesterday

This Week vs Last Week

This Month vs Last Month

This Year vs Last Year

and:

Custom Date A vs Custom Date B

Overlay charts when useful.

---

# 26. PERFORMANCE INSIGHTS

Generate rule-based insights from measured data.

Examples:

"Solar production is 12% higher than your 30-day daily average."

"Grid consumption was highest between 18:00 and 20:00."

"Battery reached 100% at 13:42."

"PV production peaked at 6.8 kW today."

"Your inverter reported data for 99.2% of the selected period."

Never fabricate AI conclusions.

Only create insights that can be mathematically derived from actual stored data.

---

# 27. ALERTS SECTION

Create a dedicated ALERTS page.

This must be a major application feature.

Sidebar item:

ALERTS

Show an unread badge:

ALERTS  3

Alert severity:

Critical

Warning

Information

Resolved

Each alert should display:

severity

title

description

inverter

plant

first detected

last detected

status

related parameter

current value where applicable

acknowledgement status

resolved time

---

# 28. ALERT EXAMPLES

Demo alerts might include:

Grid Voltage High

Battery SOC Low

Inverter Temperature High

Communication Interrupted

Collector Offline

PV Input Abnormal

Battery Communication Warning

Grid Lost

Device Offline

Do NOT assume these exact alarm types exist on every device.

Map actual DESSMonitor alert/event information where supported.

---

# 29. ALERT PROCESSOR

Whenever new DESSMonitor data is synchronized:

compare new alarm/event state with previous state.

If a previously unseen alert exists:

create alert record.

If alert persists:

update lastSeen.

If alert disappears:

mark resolved when appropriate.

Generate a realtime event:

alert:new

The frontend immediately updates.

---

# 30. NOTIFICATIONS

Build an internal notification center.

Bell icon in header.

Unread count.

Dropdown:

New inverter warning

Battery low

Device back online

Setting successfully applied

Sync failed

Integration disconnected

Users should be able to:

mark as read

mark all as read

filter

open related device

---

# 31. OPTIONAL NOTIFICATION ARCHITECTURE

Prepare provider abstractions for future:

Email

Push Notification

Telegram

Discord

SMS

Do not require these integrations for the initial version.

---

# 32. INVERTER CONTROLS

Create:

Controls

This page allows changing ONLY settings explicitly exposed as writable/control fields by the connected inverter through DESSMonitor.

The application must first retrieve available control fields.

Do not invent configurable inverter properties.

Control UI should dynamically render based on field metadata.

Possible components:

toggle

number input

select dropdown

time selector

range slider

mode selector

These must be generated from actual supported device fields whenever possible.

---

# 33. CONTROL SAFETY

Changing inverter configuration can affect system operation.

For every setting change:

show:

Current Value

Requested Value

Device

Setting

Timestamp

Require an explicit confirmation.

Example:

Apply inverter setting?

Charge Source Priority

Current:
Solar First

New:
Solar + Grid

[Cancel]

[Confirm & Apply]

Never apply a control when the user merely changes a form element.

Require a separate Apply action.

For especially consequential device commands, require a second confirmation.

---

# 34. CONTROL REQUEST STATES

When sending a setting:

QUEUED

SENDING

SENT

CONFIRMING

APPLIED

FAILED

UNKNOWN

Do not immediately label a command successful merely because HTTP returned successfully.

Where technically possible:

send command

wait for next device telemetry

read value back

verify expected value

then display:

Applied successfully

If verification is unavailable:

display:

Command accepted — device confirmation unavailable.

---

# 35. CONTROL AUDIT LOG

Every control action must be logged.

Record:

user

device

setting ID

setting name

old value

requested value

API response

status

requestedAt

completedAt

verification result

Never allow users to silently alter inverter configuration.

Create:

Controls → Activity Log

---

# 36. OPTIONAL SAFE MODE

Add:

Safe Control Mode

Default:

ON

Safe Mode can prevent high-impact commands until deliberately disabled by an authorized account owner.

Separate monitoring permissions from control permissions.

Roles:

Owner

Admin

Viewer

Viewer:
read-only

Admin:
monitor + allowed device settings

Owner:
full account/integration management

---

# 37. DEVICE DETAILS PAGE

Display:

Device Alias

Serial Number

Collector PN

Devcode

Device Address

Status

Timezone

Protocol

Last Data

Last Seen

Firmware if supplied

Model if supplied

Manufacturer if supplied

Connection Status

Allow the user to rename the local display alias without modifying DESSMonitor metadata unless explicitly requested.

---

# 38. BATTERY PAGE

If battery information exists show:

Battery SOC

Battery Power

Charging / Discharging

Voltage

Current

Temperature

Daily Charge Energy

Daily Discharge Energy

Estimated equivalent cycle count

SOC history

Charge/discharge graph

Min SOC today

Max SOC today

If battery telemetry is unavailable:

display:

Battery telemetry unavailable for this inverter.

Do not display fake zero values.

---

# 39. GRID PAGE

Display:

Grid Status

Import Power

Export Power

Grid Voltage

Grid Frequency

Daily Import

Daily Export

Monthly Import

Monthly Export

Peak Import

Peak Export

Graph:

Import above baseline

Export below baseline

or another highly readable visualization.

---

# 40. SOLAR PAGE

Display:

Total PV Power

PV1 Power

PV2 Power

additional MPPT channels dynamically

PV Voltage

PV Current

daily yield

monthly yield

yearly yield

all-time yield

peak power

generation timeline

Make MPPT input cards dynamic based on actual fields.

---

# 41. HISTORY EXPLORER

Build a powerful historical-data explorer.

Filters:

Plant

Device

Metric

Start Date

End Date

Aggregation

Aggregation options:

Raw

5 Minute

15 Minute

Hourly

Daily

Monthly

Allow CSV export of the user's data.

Example columns:

timestamp
pv_power_w
load_power_w
battery_power_w
battery_soc
grid_power_w
temperature_c

---

# 42. SEARCH

Global search.

Users should be able to search:

devices

alerts

settings

metrics

pages

Example:

"battery"

Results:

Battery SOC

Battery Voltage

Battery Alerts

Battery Analytics

Battery Controls

---

# 43. USER ACCOUNT SYSTEM

Create complete user registration.

Pages:

/login

/signup

/forgot-password

/reset-password

/account

/integrations

/signup fields:

Name

Email

Password

Confirm Password

Accept Terms

After registration:

Email verification architecture should be supported.

---

# 44. DESSMONITOR ACCOUNT CONNECTION

Inside:

Settings
→ Integrations
→ DESSMonitor

Display:

Not Connected

[Connect DESSMonitor]

Connection form:

DESSMonitor Username

DESSMonitor Password

Company Key

Advanced Options

Never display stored password after saving.

Store sensitive values encrypted server-side.

After Connect:

validate credentials.

If valid:

discover projects

discover collectors

discover inverters

Display:

Connected

Last Sync

Devices Found

Account

Disconnect

Reconnect

Sync Now

---

# 45. DO NOT CALL THIS AN "API KEY" IF IT ISN'T ONE

In the user-facing UI use:

DESSMonitor Connection

or:

DESSMonitor Credentials

rather than incorrectly requiring:

"DESSMonitor API Key"

unless DESSMonitor introduces an actual API-key credential mechanism.

Internally design the credential model flexibly enough that an API-key field could be added in the future.

---

# 46. CREDENTIAL SECURITY

Sensitive integration credentials must:

be encrypted at rest

never appear in logs

never be included in API responses

never be sent back after initially saving

never be stored in localStorage

never be stored as plaintext database fields

Redact debug output.

Example:

companyKey:
************ABCD

Never show passwords.

---

# 47. SESSION SECURITY

Implement:

httpOnly cookies

secure cookies in production

sameSite protection

CSRF protection where relevant

rate limiting

session expiration

login attempt throttling

password hashing

server-side authorization

Never rely solely on hiding buttons in the frontend.

---

# 48. DATABASE MODELS

Design Prisma models similar to:

User

Account

Session

SolarIntegration

Plant

Collector

Device

DeviceReading

EnergyAggregate

Alert

Notification

ControlAction

ControlField

SyncJob

AuditLog

UserPreference

---

# 49. DEVICEREADING MODEL

Store normalized fields such as:

id

deviceId

deviceTimestamp

receivedAt

processedAt

pvPower

loadPower

batteryPower

batterySoc

gridPower

gridVoltage

gridFrequency

inverterTemperature

dailyGeneration

operatingMode

rawData JSON

Keep:

rawData

for troubleshooting / future normalization.

---

# 50. DATA NORMALIZATION

Create a normalization layer translating inconsistent device-specific DESSMonitor values into common internal names.

Examples:

PV input power
Solar power
PV Power

could map internally to:

pvPowerW

Keep the raw field ID and title as metadata.

Never permanently discard unknown fields.

---

# 51. UNIT NORMALIZATION

Internally use consistent base units:

Power:
W

Energy:
Wh

Voltage:
V

Current:
A

Frequency:
Hz

Temperature:
°C

Percent:
0–100

Then format automatically:

850 W

1.24 kW

950 Wh

21.8 kWh

1.32 MWh

Do not mix units incorrectly.

---

# 52. TIMEZONES

DESSMonitor devices may expose device timezone information.

Store timestamps in UTC internally.

Display them using:

device timezone

or user-selected timezone.

Add account setting:

Timezone

Default:
Auto / Device Timezone

Historical date boundaries must respect the selected timezone.

---

# 53. ANALYTICS ENGINE

Never calculate energy by naively adding instantaneous power measurements.

When energy totals are unavailable from the source, use proper time integration:

Energy ≈ Power × elapsed time

accounting for:

irregular sample spacing

missing data

duplicate timestamps

data gaps

timezone changes

Where DESSMonitor provides authoritative cumulative energy values, prefer those when appropriate.

---

# 54. MISSING DATA

Charts must represent missing intervals accurately.

Do NOT interpolate large missing periods as if the inverter generated continuously.

Show:

Data unavailable

for missing ranges.

Provide system-data quality:

Complete:
98.7%

Missing:
1.3%

---

# 55. SYNC STATUS PAGE

Create an advanced synchronization page.

Show:

DESSMonitor Connection

Last Successful Sync

Last Attempt

Next Sync

Average Sync Duration

Last Error

Records Imported Today

API Status

Device Data Timestamp

Provide:

Sync Now

button.

Rate limit manual syncing.

---

# 56. API FAILURE HANDLING

Handle:

network failure

timeout

authentication expiration

invalid credentials

rate limiting

malformed JSON

DESSMonitor error response

missing device

unsupported protocol

empty response

stale readings

control failure

Never crash the dashboard.

Display useful messages.

Example:

"Unable to refresh inverter data. Last successful reading was 4 minutes ago."

Continue showing cached historical information.

---

# 57. RETRY STRATEGY

Use controlled exponential backoff.

Example:

attempt 1

30 sec

attempt 2

60 sec

attempt 3

120 sec

Do not create aggressive infinite retry loops.

---

# 58. DEDUPLICATION

Prevent duplicated device readings.

Create an appropriate unique key based on:

deviceId

device timestamp

and source identifier where needed.

A repeated DESSMonitor response should update or skip the existing entry, not add another identical row.

---

# 59. AGGREGATION

Do not make yearly charts query millions of raw readings.

Create precomputed aggregates:

5-minute

hourly

daily

monthly

Create background aggregation jobs.

Historical UI should use appropriate aggregation automatically.

Example:

24 hours:
raw / 5-minute

30 days:
hourly

1 year:
daily

all time:
monthly

---

# 60. HOMEPAGE DESIGN

When authenticated, users should enter directly into their inverter dashboard.

Do not waste space with marketing banners.

Header:

device selector

connection indicator

last updated

sync button

notification bell

theme switch

profile menu

Sidebar:

Overview
Live Power
Analytics
Energy
Battery
Grid
Alerts
Controls
History
Devices
Settings

---

# 61. VISUAL DESIGN SYSTEM

Make the interface sophisticated and technical.

Style:

clean

minimal

modern

high readability

professional monitoring platform

Use:

rounded cards

subtle borders

controlled shadows

large metric typography

consistent spacing

responsive grid

Avoid:

huge gradients

overdone glowing effects

glassmorphism everywhere

random neon colors

excessive animations

"AI generated dashboard" appearance

---

# 62. STATUS COLORS

Use consistent semantic states.

Healthy:
green

Solar:
yellow / amber

Battery:
blue or teal

Grid:
purple

Warnings:
orange

Critical:
red

Neutral:
gray

But make dark/light themes accessible.

Do not communicate state through color alone.

Also use:

icons

labels

text.

---

# 63. DARK MODE

Dark mode should look excellent.

Background:
deep neutral gray

Cards:
slightly elevated neutral

Avoid pure black everywhere.

Charts should remain readable.

Persist theme preference.

---

# 64. RESPONSIVE DESIGN

Desktop:
full sidebar and multi-column layout

Tablet:
condensed sidebar

Mobile:
bottom navigation or drawer

Important realtime metrics must remain readable at 375 px width.

Charts must horizontally scale.

Control dialogs must work on phones.

---

# 65. MOBILE DASHBOARD

Mobile overview order:

System Status

Solar

Load

Battery

Grid

Energy Flow

Today's Energy

Alerts

Chart

Avoid squeezing six cards across one row.

---

# 66. PWA SUPPORT

Make the architecture ready for installation as a Progressive Web App.

Include:

manifest

application icons

mobile theme settings

offline shell

When offline:

display cached latest data clearly marked:

OFFLINE / LAST KNOWN DATA

Never pretend cached data is realtime.

---

# 67. CUSTOM DASHBOARD

Allow users to customize their overview.

Widgets:

Solar Power

Battery

Grid

Load

Energy Flow

Today's Generation

Forecast placeholder

Temperature

Recent Alerts

Generation Graph

Users can:

show/hide

reorder

reset layout

Store layout in UserPreference.

---

# 68. DATA EXPORT

Users can export their own data.

Formats:

CSV

JSON

Allow ranges:

Today

Week

Month

Custom

Show exactly which metrics are included.

---

# 69. SYSTEM HEALTH CARD

Create a card showing:

DESSMonitor:
Connected

Collector:
Online

Inverter:
Online

Last telemetry:
2 minutes ago

Database sync:
Healthy

Realtime:
Connected

This makes troubleshooting much easier.

---

# 70. RAW DEVICE INSPECTOR

Advanced users should have:

Device
→ Advanced
→ Raw Data

Show most recent normalized values.

Optional expandable:

Raw DESSMonitor response

Hide credentials and signing information.

Allow JSON copy.

---

# 71. COMMAND HISTORY

Controls page should contain:

Recent Commands

Example:

14:22
Charge Current
20 A → 30 A
Applied

13:48
Operating Mode
Self Use → Battery Priority
Applied

Yesterday
Grid Charge
Off → On
Failed

Allow opening each command for API/verification detail.

---

# 72. ALERT HISTORY

Allow:

Active

Resolved

All

filters.

Filters:

severity

device

date

type

Search alert title/description.

---

# 73. ALERT ACKNOWLEDGEMENT

Users can acknowledge an alert.

Acknowledging does NOT mark the equipment problem resolved.

Statuses should be distinct:

Active

Acknowledged

Resolved

For example:

Battery Communication Lost
ACTIVE
Acknowledged by Admin
Detected 12m ago

---

# 74. DATA QUALITY MONITORING

Create internal checks for impossible or suspicious data.

Examples:

Battery SOC > 100%

NaN

impossible timestamps

massive unexplained sensor spike

future timestamp

negative value where impossible

Do not silently correct questionable readings.

Tag them:

suspect

and exclude them from aggregates where appropriate.

---

# 75. EVENT TIMELINE

Add a unified timeline.

Example:

14:31
Battery reached 80%

14:22
Inverter setting changed

13:44
Grid disconnected

13:46
Grid restored

12:18
Solar output reached today's peak

This creates a powerful diagnostic history.

---

# 76. DASHBOARD SUMMARY

At top of Overview:

Good evening.

Your solar system is online.

Today:

Solar generated
31.8 kWh

Home used
22.4 kWh

Battery
78%

Grid export
8.7 kWh

Last updated
2 minutes ago

Keep this concise.

---

# 77. OPTIONAL WEATHER ARCHITECTURE

Prepare an optional future integration for:

current weather

cloud cover

solar irradiance

temperature

solar forecast

BUT:

do not pretend this information comes from DESSMonitor unless it actually does.

Keep external integrations isolated.

---

# 78. COST AND SAVINGS

Allow optional electricity-rate configuration.

Settings:

Import Price per kWh

Export Price per kWh

Currency

Then calculate:

Estimated grid cost

Estimated exported credit

Estimated solar value

Estimated savings

Clearly label these:

ESTIMATES

They must derive from user-configured tariffs.

---

# 79. CURRENCY

Make currency configurable.

Examples:

IQD

USD

EUR

GBP

Never assume the user's electricity tariff.

---

# 80. ADMIN / DEVELOPMENT DEBUG PANEL

Only in development mode:

show:

current provider

mock/live

last DESSMonitor request action

response latency

normalization results

sync status

Never include:

password

secret

token

company key

or complete signed URLs containing sensitive authentication data.

---

# 81. MOCK DATA CONTROLS

Development-only Mock Control Panel:

Simulation:

Normal Sunny Day

Cloudy Day

Night

Battery Low

Grid Failure

Inverter Offline

High Temperature Alert

Communication Failure

Clicking a mode changes mock data.

This lets every UI condition be tested.

---

# 82. MOCK ALERT GENERATOR

Development mode:

Generate Alert

Choose:

Info

Warning

Critical

Resolve Alert

Use this to test realtime notifications.

---

# 83. MOCK CONTROL SUPPORT

Changing inverter settings in mock mode must update the mock device state realistically.

Example:

change:

Grid Charge
Disabled → Enabled

Command becomes:

SENDING

then:

APPLIED

and mock device state reflects:

Grid Charge:
Enabled

Do not actually contact any external service in mock mode.

---

# 84. ERROR BOUNDARIES

Use appropriate React error boundaries.

A broken chart should not take down the entire dashboard.

Create:

loading state

empty state

error state

offline state

stale state

for all major components.

---

# 85. SKELETON STATES

When first loading:

show tasteful skeletons matching card dimensions.

Do not show fake zeros such as:

0 W

0%

if the value simply hasn't loaded yet.

Use:

—

or:

Loading…

---

# 86. ZERO VS MISSING

Treat these differently:

PV Power = 0 W

means a legitimate measurement.

PV Power = null

means unavailable.

Do not convert null values to zero.

---

# 87. API DESIGN

Create internal endpoints similar to:

GET /api/devices

GET /api/devices/:id

GET /api/devices/:id/latest

GET /api/devices/:id/history

GET /api/devices/:id/energy-flow

GET /api/devices/:id/controls

POST /api/devices/:id/controls

GET /api/devices/:id/alerts

GET /api/analytics

GET /api/notifications

POST /api/integrations/dessmonitor/connect

POST /api/integrations/dessmonitor/disconnect

POST /api/sync

GET /api/events

Protect every user-specific endpoint.

Ensure the user owns or has access to the requested device.

---

# 88. SERVER-SENT EVENTS

Prefer SSE unless WebSockets are actually necessary.

Potential realtime events:

telemetry:new

device:status

alert:new

alert:resolved

sync:completed

sync:failed

control:updated

notification:new

Frontend components should update affected queries when these events arrive.

---

# 89. DATABASE INDEXING

Index:

DeviceReading(deviceId, deviceTimestamp)

Alert(deviceId, status)

ControlAction(deviceId, requestedAt)

Notification(userId, readAt)

EnergyAggregate(deviceId, period, timestamp)

This dashboard may eventually contain millions of samples.

Design for that from the start.

---

# 90. RETENTION

Create configurable data-retention options.

For example:

raw telemetry:
12 months

hourly aggregates:
5 years

daily/monthly:
indefinite

Do not automatically delete data in the initial version.

Only prepare the architecture.

---

# 91. OBSERVABILITY

Implement structured server logging.

Track:

sync started

sync completed

sync failed

device count

new readings

new alerts

command submission

command verification

Never log credentials.

Prepare hooks for production error monitoring.

---

# 92. AUDIT SECURITY EVENTS

Audit:

login

logout

DESSMonitor connected

DESSMonitor disconnected

credentials updated

device setting changed

user role changed

data exported

Store:

user

event

timestamp

IP if appropriate and lawful

metadata

Never store passwords.

---

# 93. ACCESSIBILITY

Use:

keyboard navigation

visible focus states

ARIA labels

semantic markup

screen reader-friendly charts summaries

sufficient contrast

Do not make control features mouse-only.

---

# 94. DEVELOPMENT SEED DATA

Create seed:

Demo User

demo@example.local

Do not use a real email.

Create:

1 plant

1 collector

1 inverter

90 days of realistic historical telemetry

several historical alerts

two active alerts

a few command-history entries

daily/monthly aggregates

This makes analytics immediately useful during development.

---

# 95. DO NOT HARDCODE DEMO LOGIN IN PRODUCTION

Development seed accounts must be enabled only for development.

Production must not automatically create known credentials.

---

# 96. PROJECT FILE STRUCTURE

Keep the project clean.

Example:

app/
  (auth)/
  dashboard/
  api/

components/
  dashboard/
  charts/
  energy-flow/
  alerts/
  controls/
  devices/
  layout/
  ui/

lib/
  auth/
  db/
  dessmonitor/
  analytics/
  realtime/
  validation/
  security/
  units/
  dates/

prisma/
  schema.prisma
  seed.ts

types/

hooks/

workers/

tests/

---

# 97. TESTS

Write meaningful tests.

Unit tests:

signature generation

normalization

unit conversion

analytics calculations

energy integration

alert state transitions

authorization

control validation

Integration tests:

mock provider sync

device discovery

new telemetry

alert creation

control updates

User flow tests:

signup

login

connect demo integration

open inverter

view analytics

acknowledge alert

change safe mock setting

---

# 98. ENVIRONMENT VARIABLES

Create:

.env.example

Example:

DATABASE_URL=

AUTH_SECRET=

DESSMONITOR_MODE=mock

DESSMONITOR_BASE_URL=

DESSMONITOR_SYNC_INTERVAL_SECONDS=120

DESSMONITOR_DEFAULT_SOURCE=1

ENCRYPTION_KEY=

APP_URL=

Do NOT include real secrets.

For optional testing:

DESSMONITOR_TEST_USERNAME=

DESSMONITOR_TEST_PASSWORD=

DESSMONITOR_TEST_COMPANY_KEY=

These MUST be server-only.

---

# 99. OFFICIAL DESSMONITOR API OPERATIONS

Where supported by the current official documentation, implement or prepare adapters for functionality equivalent to:

authentication

project discovery

collector discovery

device discovery

latest device data

historical device data

key parameter daily data

device chart/display fields

device control field discovery

device control

energy-flow information

Do not depend on endpoint/action names from memory.

Verify every production action against the official DESSMonitor API documentation during implementation.

---

# 100. DEVICE LATEST DATA

Use the DESSMonitor operation that retrieves the device's latest data where appropriate.

Normalize:

field title

unit

value

device timestamp

into internal structures.

The dashboard should not require manually defining every device parameter.

---

# 101. DEVICE CHART FIELDS

Where supported, retrieve chart-capable protocol fields.

Use this information to dynamically determine which metrics are chartable.

This is especially important because different inverter protocols expose different data.

---

# 102. DEVICE CONTROLS

Where available, query the device's supported control fields first.

Only render a control when:

the API exposes it

and

the connected account has permission.

Then use the documented device-control operation for supported changes.

Never manufacture hidden inverter commands.

---

# 103. API PERMISSION FAILURES

If DESSMonitor returns that a control is unavailable or permission is insufficient:

show:

"This setting cannot be changed with the connected DESSMonitor account."

Do not retry endlessly.

Do not attempt alternate undocumented commands.

---

# 104. SETTINGS PAGE

Sections:

Profile

Appearance

Dashboard

Energy Tariffs

Notifications

DESSMonitor Integration

Devices

Data & Export

Security

Advanced

---

# 105. INTEGRATION STATUS CARD

Example:

DESSMonitor

CONNECTED

Account
••••••••

Plants
2

Collectors
2

Inverters
3

Last Sync
2 minutes ago

[Sync Now]

[Manage]

[Disconnect]

---

# 106. FIRST-TIME ONBOARDING

After creating an account:

Step 1
Welcome

Step 2
Connect DESSMonitor

Step 3
Discover devices

Step 4
Select primary inverter

Step 5
Choose timezone

Step 6
Dashboard ready

Include:

Try Demo System

This should immediately enable mock mode for that user's workspace.

---

# 107. DEMO EXPERIENCE

A new user should be able to click:

Explore Demo

and immediately see:

live simulated inverter

energy flow

battery

solar

grid

90 days analytics

alerts

controls

No credentials needed.

Show a banner:

DEMO SYSTEM

Simulated inverter data

[Connect My System]

---

# 108. EMPTY STATE

If no DESSMonitor integration exists:

No solar system connected yet.

Connect DESSMonitor to start monitoring your inverter.

[Connect DESSMonitor]

[Explore Demo]

---

# 109. CONFIRMATION BEFORE DISCONNECTING

Disconnecting an integration:

must require confirmation.

Explain:

Historical data will remain in your dashboard unless separately deleted.

Live synchronization will stop.

---

# 110. DELETE ACCOUNT

Account deletion must be separate from integration disconnect.

Require confirmation.

Provide a clear explanation of data deletion.

Never accidentally delete the user's DESSMonitor account.

This application only disconnects from DESSMonitor.

---

# 111. DO NOT MODIFY DESSMONITOR ACCOUNT STRUCTURE UNNECESSARILY

The dashboard should primarily:

read

monitor

analyze

and send explicitly requested supported inverter control actions.

Do not automatically:

rename DESSMonitor plants

delete projects

register collectors

modify unrelated account data

unless a future feature specifically calls for it.

---

# 112. PERFORMANCE

Initial dashboard should load from our database/cache first.

Do NOT block page rendering while waiting for DESSMonitor.

Flow:

browser requests dashboard

↓

our DB returns latest stored data immediately

↓

background sync checks DESSMonitor

↓

new telemetry arrives

↓

SSE event

↓

dashboard updates

This creates a fast interface even if DESSMonitor responds slowly.

---

# 113. OPTIMISTIC UI RULE

DO NOT optimistically assume inverter control changes succeeded.

For regular UI settings such as:

theme

dashboard layout

optimistic updates are fine.

For inverter configuration:

never show "Applied" until command state justifies it.

---

# 114. TOOLTIP QUALITY

Explain technical values.

Example:

Grid Export

"Power currently being sent from your solar/battery system back to the electrical grid."

Battery SOC

"Estimated percentage of usable battery charge remaining."

This makes the dashboard usable by both technical and nontechnical users.

---

# 115. USER-PREFERRED UNITS

Prepare preferences for:

Temperature:
°C / °F

Power:
Auto / W / kW

Energy:
Auto / Wh / kWh / MWh

Time:
12-hour / 24-hour

Date format

---

# 116. SOLAR DAY TIMELINE

Create a visually useful daily power chart.

Lines/areas:

Solar

Load

Battery

Grid

Hover:

14:20

Solar:
5.42 kW

Load:
2.18 kW

Battery:
Charging 2.40 kW

Grid:
Exporting 0.66 kW

---

# 117. FULLSCREEN MONITOR MODE

Add:

Fullscreen Energy Monitor

Designed for:

wall-mounted tablet

desktop screen

control room display

Show:

time

PV power

load

battery SOC

grid

energy flow

daily production

status

recent warning

Minimal navigation.

---

# 118. FAVORITE METRICS

Allow favorite metrics.

Example:

Battery SOC

Grid Voltage

PV Power

Inverter Temperature

Favorites appear in a compact panel.

---

# 119. HEALTH SCORE — DO NOT USE FAKE AI SCORING

Do NOT invent a meaningless:

Solar Health Score 97/100

Instead show measurable statuses:

Reporting normally

No active critical alerts

Data availability 99.2%

Temperature within configured range

Last telemetry 2m ago

This is more trustworthy.

---

# 120. OPTIONAL USER-DEFINED ALERTS

In addition to inverter-provided alarms, allow application alerts.

Examples:

Battery below 20%

Inverter temperature above 65°C

Grid voltage above configured threshold

No inverter data for 15 minutes

Daily solar production below custom target

Clearly distinguish:

DEVICE ALERT

from:

CUSTOM ALERT

---

# 121. CUSTOM ALERT BUILDER

Example:

When

Battery SOC

is below

20%

for

5 minutes

Notify:

In App

[Save Alert]

Validate thresholds.

Do not allow nonsensical units.

---

# 122. SOLAR TARGETS

Optional user-defined targets:

Daily Generation Target

Monthly Generation Target

Self Consumption Target

Grid Import Target

Show target progress but do not shame users for missing goals.

---

# 123. BACKUP AND DATA PORTABILITY

Allow users to export:

settings

devices metadata

telemetry

alerts

control history

as data files where appropriate.

Do not export encrypted DESSMonitor passwords.

---

# 124. README

Write an excellent README explaining:

project purpose

technology stack

architecture

mock mode

live DESSMonitor mode

environment variables

database setup

development commands

production build

DESSMonitor integration

security architecture

sync architecture

testing

known limitations

---

# 125. DESSMONITOR DOCUMENTATION NOTES

Create:

docs/DESSMONITOR.md

Include:

authentication flow

signing architecture

project → collector → device hierarchy

supported implemented actions

normalization approach

control safety

common API errors

testing strategy

mock/live differences

Do not put real credentials in documentation.

---

# 126. SECURITY DOCUMENTATION

Create:

docs/SECURITY.md

Explain:

credential encryption

server-only API calls

session protection

control authorization

audit logging

rate limiting

secret handling

incident considerations

---

# 127. FINAL IMPLEMENTATION EXPECTATION

Do not merely generate static dashboard screenshots.

Build a FUNCTIONAL application.

Every button should either:

work

or

be intentionally disabled with a clear explanation.

No dead controls.

No fake API requests.

No placeholder buttons pretending to work.

The demo provider must make the complete application usable before a live DESSMonitor connection exists.

---

# 128. INITIAL BUILD ORDER

Implement in this order:

PHASE 1

Project structure

UI design system

authentication

database

mock DESSMonitor provider

demo device

dashboard shell

overview

energy flow

realtime mock synchronization

PHASE 2

Historical telemetry

analytics

daily / weekly / monthly / yearly charts

history explorer

alerts

notifications

PHASE 3

controls architecture

control history

safe mode

mock control simulation

roles / permissions

PHASE 4

live DESSMonitor provider

authentication

signing

device discovery

latest telemetry

historical data

control-field discovery

supported control commands

API error mapping

PHASE 5

testing

security review

responsive polish

PWA support

performance optimization

documentation

---

# 129. IMPORTANT INTEGRATION PRINCIPLES

The implementation MUST follow these rules:

1. Never expose DESSMonitor credentials to the browser.

2. Never invent unsupported DESSMonitor API endpoints.

3. Never invent device fields.

4. Never assume all inverters support the same controls.

5. Never identify an accepted HTTP request as proof the inverter changed state unless verified or clearly labeled otherwise.

6. Never display stale data as live data.

7. Never silently convert missing telemetry into zero.

8. Never destroy historical telemetry during ordinary synchronization.

9. Never allow users to control a device they do not own/have authorization for.

10. Never store DESSMonitor credentials in plaintext.

11. Never poll DESSMonitor separately from every browser.

12. Never use real credentials in source control.

13. Never expose tokens/secrets through error messages.

14. Always maintain an audit log for inverter changes.

15. Always provide mock/demo mode.

---

# 130. DESIGN QUALITY

The final product should feel like an actual premium solar monitoring platform rather than an admin template.

Prioritize:

clear hierarchy

large realtime values

excellent charts

meaningful spacing

fast loading

useful empty states

clear status

clear alerts

excellent mobile responsiveness

minimal visual clutter

trustworthy data representation

strong security

robust API abstraction

Use microinteractions sparingly.

No AI-style excessive gradients.

No generic placeholder text.

No fake functionality.

---

# 131. MAIN DASHBOARD EXAMPLE

The desktop page could conceptually look like:

-------------------------------------------------------

☀ Solar Monitor         LIVE ●      🔔 2      Profile

Sulaimani Solar Home
Hybrid Inverter 01

Last inverter reading 2 min ago

-------------------------------------------------------

SOLAR          LOAD          BATTERY          GRID

4.82 kW        2.31 kW       73%              0.77 kW

Producing      Consuming     Charging         Exporting

-------------------------------------------------------

                    SOLAR
                   4.82 kW
                      │
                      ↓
                  INVERTER
                 ↙    ↓    ↘
              BATTERY HOME GRID
              1.74kW 2.31kW 0.77kW

-------------------------------------------------------

Today's Energy

[interactive chart]

Solar 31.8 kWh
Load 22.4 kWh
Import 3.1 kWh
Export 8.7 kWh

-------------------------------------------------------

Battery                         System Status

73%                             Inverter ● Online
Charging                        Collector ● Online
                                DESSMonitor ● Connected

-------------------------------------------------------

Recent Alerts

⚠ Grid voltage briefly exceeded configured threshold
✓ Communication restored

-------------------------------------------------------

---

# 132. MAIN GOAL

The finished website should make it possible for a user to log in and immediately understand:

How much solar power am I producing?

How much power am I using?

Is my battery charging or discharging?

What percentage is my battery?

Am I importing or exporting grid electricity?

How much energy did I generate today?

How does today compare with previous days?

Has my inverter produced any warnings?

Is my inverter online?

When was the latest real reading received?

What settings does my particular inverter allow me to change?

Did my requested inverter setting actually apply?

How has my system performed over days, weeks, months and years?

The dashboard must answer these questions within seconds.

---

# 133. FINAL QUALITY REQUIREMENT

Before declaring the project complete:

Run the application.

Fix TypeScript errors.

Fix build errors.

Fix broken imports.

Run database migrations.

Verify mock mode.

Verify signup/login.

Verify responsive layouts.

Verify all primary routes.

Verify analytics render with demo history.

Verify realtime telemetry updates.

Verify mock alerts.

Verify alert badges.

Verify mock inverter setting changes.

Verify audit logs.

Verify dark/light theme.

Verify that no secret values reach the frontend.

Verify production build succeeds.

Do not finish with pseudocode.

Do not leave critical sections as TODO comments.

The application should be locally runnable and structured so real DESSMonitor credentials can be connected later without rewriting the application architecture.

MAKE NO MISTAKE: prioritize correctness, security, real functionality, accurate DESSMonitor integration boundaries, and reliable data handling over shortcuts or visually impressive fake functionality.