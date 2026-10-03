# DESSMonitor integration notes

Official documentation inspected October 2–3, 2026. No private DESSMonitor credentials were provided or used.

## Verified source pages

| Function | Official reference |
| --- | --- |
| Authentication and request signing | [API help](https://api.dessmonitor.com/en/chapter1/apiHelp.html), [authentication](https://api.dessmonitor.com/en/chapter2/authSource.html), [Java example](https://api.dessmonitor.com/en/chapter1/demoJava.html) |
| Projects | [queryPlants](https://api.dessmonitor.com/en/chapter3/queryPlants.html) |
| Collector list | [webQueryCollectorsEs](https://api.dessmonitor.com/en/chapter4/webQueryCollectorsEs.html) |
| Collector ownership / project | [queryCollectorInfoEs](https://api.dessmonitor.com/en/chapter4/queryCollectorInfoEs.html) |
| Device enumeration | [queryCollectorDevices](https://api.dessmonitor.com/en/chapter4/queryCollectorDevices.html) |
| Device timezone / identifiers | [queryDeviceInfo](https://api.dessmonitor.com/en/chapter5/queryDeviceInfo.html) |
| Latest parameters | [queryDeviceLastData](https://api.dessmonitor.com/en/chapter5/queryDeviceLastData.html) |
| Daily history | [queryDeviceDataOneDay](https://api.dessmonitor.com/en/chapter5/queryDeviceDataOneDay.html) |
| Flow directions | [webQueryDeviceEnergyFlowEs](https://api.dessmonitor.com/en/chapter5/webQueryDeviceEnergyFlowEs.html) |
| Controls | [queryDeviceCtrlField](https://api.dessmonitor.com/en/chapter5/queryDeviceCtrlField.html), [queryDeviceCtrlValue](https://api.dessmonitor.com/en/chapter5/queryDeviceCtrlValue.html), [ctrlDevice](https://api.dessmonitor.com/en/chapter5/ctrlDevice.html) |
| Alarm records | [queryDeviceWarning](https://api.dessmonitor.com/en/chapter5/queryDeviceWarning.html) |
| Chart metadata | [queryDeviceChartField](https://api.dessmonitor.com/en/chapter5/queryDeviceChartField.html) |
| Errors | [Generic error codes](https://api.dessmonitor.com/en/chapter1/errCode.html) |

## Authentication and signing

`authSource` receives the account name, manufacturer company key, source and app identity. It returns a token, secret and expiry in seconds. The adapter caches these only in server memory for its lifetime and refreshes before expiry. Read requests may reauthenticate once for `ERR_NO_AUTH`; physical writes are never automatically retried.

The implementation follows the documented SHA-1 formulas:

```text
authentication = SHA1(salt + SHA1(password) + exact_action_tail)
business       = SHA1(salt + secret + token + exact_action_tail)
```

`exact_action_tail` starts with `&action=` and includes all subsequent serialized parameters in order. Values are encoded before hashing and the same string is sent. Digests are lowercase hexadecimal. The password is not sent as a plaintext query parameter. SHA-1 is required by this external protocol; local passwords use scrypt instead.

The example URL in API help prints a signature that does **not** match its stated sample inputs and formula. Node crypto and an independent .NET SHA-1 calculation both produce `aebd599bd6d36ec7bebde87a661eb27bfa0a08fb` for that full parameter tail, while the page prints `675bd5418fce7be5e30b920a16a46ce075c90a35`. The test locks the formula-derived result, not the inconsistent sample URL. Vendor/hardware authentication remains unverified.

Examples in the documentation use HTTP. This application refuses credential-bearing HTTP and accepts only the official HTTPS host/path, with redirects disabled. It never falls back to plaintext transport.

## Discovery

Pagination uses zero-based pages with at most 50 results per call and bounded total pages. Projects are discovered first. The verified collector listing does not document a project filter, so `queryCollectorInfoEs` establishes each collector's project association. Device discovery follows the collector, then `queryDeviceInfo` supplies the device timezone. Local aliases never rename upstream objects.

## Telemetry and history

Latest data is an ordered array of title/unit/value entries. The documented second entry is a timestamp in device local time. The adapter converts it to UTC, records receipt and processing separately, and validates with Zod. History aligns `title` metadata with each `row.field` array and rejects length mismatches. The parameter table misspells `field` as `filed`; the implementation follows the response examples and rejects unexpected shapes instead of guessing.

Power and energy conversion only accept recognized units. Known unambiguous PV input channels are summed. Unknown fields remain in parameter JSON. Generic battery/grid signs are not inferred from titles. The separate flow method recognizes documented directions and power units; a battery entry expressed in Ah is not treated as watts. Its response lacks a device timestamp, so it is not silently inserted into timestamped historical readings.

The worker imports the previous seven days at first synchronization, in bounded batches with deduplication. Interrupted imports can resume. Failed imports are marked unavailable; the UI shows the import state. Automatic polling subsequently accumulates new telemetry. A separate persisted flow snapshot carries only its server receipt time, which the dashboard labels explicitly. Missing data is never substituted with demo values in live mode.

Alarm records use `gts` for occurrence and `cts` for disappearance, interpreted in the device timezone. `handle` means handled, not resolved. The adapter checks all returned device identifiers and limits pagination. An absent record, unsupported alarm operation or incomplete result never resolves an existing live alert. The documentation example uses `device` inconsistently; the implementation follows the parameter table's `pn` field.

## Controls

Controls must be discovered for the exact PN, SN, protocol and address. Enumerations are mapped from returned options. Generic numeric hints do not establish safe numeric ranges, so such live fields stay disabled. Live writable IDs must also be explicitly enabled by the operator, and the current read value must match a discovered option.

The command queue checks ownership, role, current value, safe mode, extra confirmation and idempotency. `ctrlDevice` can return opaque response bytes or null. That is acceptance evidence, not proof of physical application. Generic live outcomes therefore become UNKNOWN with an explicit unverified message. The simulator returns APPLIED only after reading its persisted state separately.

## Failure policy

Envelope and operation payloads are validated. Errors are mapped to sanitized messages. Authentication, permission, rate-limit and protocol errors are not printed with signed URLs or upstream diagnostic bodies. Sync failures retain the last stored readings and use bounded backoff. Incomplete or unsupported alarm responses cannot clear existing alarms.

## Testing boundary

Mock tests exercise the complete application without external API calls. Signature and normalization tests use public-format fixtures. Real account discovery, unusual URL-encoded credentials, vendor-specific meanings, alarm semantics and physical controls require an authorized staging inverter before deployment.
