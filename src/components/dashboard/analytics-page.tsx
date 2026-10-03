"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Sun,
  House,
  UtilityPole,
  BatteryCharging,
} from "lucide-react";
import { Panel, Metric } from "./dashboard";
import { PowerChart } from "../charts/power-chart";
import { Button } from "../ui/button";
import { formatValue } from "@/lib/domain";
const rowSchema = z.object({
  timestamp: z.string().optional(),
  deviceTimestamp: z.string().optional(),
  solarWh: z.number().nullable().optional(),
  loadWh: z.number().nullable().optional(),
  importWh: z.number().nullable().optional(),
  exportWh: z.number().nullable().optional(),
  chargeWh: z.number().nullable().optional(),
  dischargeWh: z.number().nullable().optional(),
  peakSolarW: z.number().nullable().optional(),
  peakLoadW: z.number().nullable().optional(),
  coveredSeconds: z.number().optional(),
  sampleCount: z.number().optional(),
  pvPowerW: z.number().nullable().optional(),
  loadPowerW: z.number().nullable().optional(),
  batteryPowerW: z.number().nullable().optional(),
  gridPowerW: z.number().nullable().optional(),
  batterySoc: z.number().nullable().optional(),
  temperatureC: z.number().nullable().optional(),
  suspect: z.boolean().optional(),
});
const responseSchema = z.object({
  rows: z.array(rowSchema),
  previous: z.array(rowSchema),
  start: z.string(),
  end: z.string(),
});
type Row = z.infer<typeof rowSchema>;
export function AnalyticsPage({
  deviceId,
  timezone,
  history,
  serverNow,
}: {
  deviceId: string;
  timezone: string;
  history: boolean;
  serverNow: number;
}) {
  const [now] = useState(serverNow);
  const today = formatInTimeZone(new Date(now), timezone, "yyyy-MM-dd");
  const [period, setPeriod] = useState("7days"),
    [start, setStart] = useState(
      formatInTimeZone(new Date(now - 6 * 86400000), timezone, "yyyy-MM-dd"),
    ),
    [end, setEnd] = useState(today),
    [aggregation, setAggregation] = useState(history ? "raw" : "day"),
    [metric, setMetric] = useState(history ? "pvPowerW" : "solarWh"),
    [rows, setRows] = useState<Row[]>([]),
    [previous, setPrevious] = useState<Row[]>([]),
    [heat, setHeat] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ start, end, aggregation });
    fetch(`/api/devices/${deviceId}/analytics?${query}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return responseSchema.parse(data);
      })
      .then((data) => {
        setRows(data.rows);
        setPrevious(data.previous);
        setPage(0);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [deviceId, start, end, aggregation]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/devices/${deviceId}/analytics?${new URLSearchParams({ start: formatInTimeZone(new Date(Date.now() - 364 * 86400000), timezone, "yyyy-MM-dd"), end: today, aggregation: "day" })}`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((r) => setHeat(responseSchema.parse(r).rows))
      .catch(() => {});
    return () => controller.abort();
  }, [deviceId, timezone, today]);
  function selectPeriod(value: string) {
    setPeriod(value);
    const d = new Date(today + "T12:00:00Z");
    let first = new Date(d),
      last = new Date(d);
    if (value === "yesterday") {
      first = new Date(+d - 86400000);
      last = first;
    }
    if (value === "7days") first = new Date(+d - 6 * 86400000);
    if (value === "30days") first = new Date(+d - 29 * 86400000);
    if (value === "month")
      first = new Date(today.slice(0, 7) + "-01T12:00:00Z");
    if (value === "year") first = new Date(today.slice(0, 4) + "-01T12:00:00Z");
    if (value === "all") first = new Date(+d - 3650 * 86400000);
    setStart(first.toISOString().slice(0, 10));
    setEnd(last.toISOString().slice(0, 10));
    if (!history)
      setAggregation(
        value === "all" || value === "year"
          ? "month"
          : value === "today" || value === "yesterday"
            ? "hour"
            : "day",
      );
  }
  const sum = (
    list: Row[],
    key:
      | "solarWh"
      | "loadWh"
      | "importWh"
      | "exportWh"
      | "chargeWh"
      | "dischargeWh",
  ) =>
    list.some((r) => r[key] != null)
      ? list.reduce((n, r) => n + (r[key] ?? 0), 0)
      : null;
  const solar = sum(rows, "solarWh"),
    load = sum(rows, "loadWh"),
    imported = sum(rows, "importWh"),
    exported = sum(rows, "exportWh"),
    lastSolar = sum(previous, "solarWh");
  const change =
    solar !== null && lastSolar !== null && lastSolar > 0
      ? ((solar - lastSolar) / lastSolar) * 100
      : null;
  const dateString = (r: Row) =>
    formatInTimeZone(
      r.timestamp ?? r.deviceTimestamp!,
      timezone,
      aggregation === "month"
        ? "MMM yyyy"
        : aggregation === "day"
          ? "MMM d, yyyy"
          : "MMM d, HH:mm",
    );
  const raw = !["day", "hour", "month", "5min", "15min"].includes(aggregation);
  const exportUrl = (format: string) =>
    `/api/devices/${deviceId}/export?${new URLSearchParams({ start, end, aggregation, format })}`;
  return (
    <>
      <div className="analytics-toolbar">
        <div className="segmented scrollable">
          {[
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["7days", "7 days"],
            ["30days", "30 days"],
            ["month", "Month"],
            ["year", "Year"],
            ["all", "All time"],
          ].map(([id, title]) => (
            <button
              key={id}
              className={period === id ? "selected" : ""}
              onClick={() => selectPeriod(id)}
            >
              {title}
            </button>
          ))}
        </div>
        <Button variant="outline" asChild>
          <a href={exportUrl("csv")}>
            <ArrowDownToLine size={16} />
            Export CSV
          </a>
        </Button>
      </div>
      <div className="filter-bar">
        <label>
          From
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => {
              setStart(e.target.value);
              setPeriod("custom");
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={end}
            min={start}
            max={today}
            onChange={(e) => {
              setEnd(e.target.value);
              setPeriod("custom");
            }}
          />
        </label>
        <label>
          Aggregation
          <select
            value={aggregation}
            onChange={(e) => {
              setAggregation(e.target.value);
              setMetric(e.target.value === "raw" ? "pvPowerW" : "solarWh");
            }}
          >
            {[
              ["raw", "Raw readings"],
              ["5min", "5 minute energy"],
              ["15min", "15 minute energy"],
              ["hour", "Hourly"],
              ["day", "Daily"],
              ["month", "Monthly"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <a className="text-link" href={exportUrl("json")}>
          Download JSON <ArrowUpRight size={14} />
        </a>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="skeleton" aria-label="Loading historical data" />
      ) : (
        <>
          <div className="metrics">
            <Metric
              title="Solar generated"
              value={formatValue(solar, "Wh")}
              sub={
                change === null
                  ? "No comparable previous data"
                  : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs previous equal period`
              }
              icon={Sun}
              tone="solar"
            />
            <Metric
              title="Energy consumed"
              value={formatValue(load, "Wh")}
              sub="Integrated from available samples"
              icon={House}
              tone="blue"
            />
            <Metric
              title="Grid import"
              value={formatValue(imported, "Wh")}
              sub={
                load && imported !== null
                  ? `${Math.max(0, (1 - imported / load) * 100).toFixed(1)}% grid independence (estimate)`
                  : "Coverage unavailable"
              }
              icon={UtilityPole}
              tone="purple"
            />
            <Metric
              title="Battery throughput"
              value={formatValue(
                sum(rows, "chargeWh") === null
                  ? null
                  : (sum(rows, "chargeWh") ?? 0) +
                      (sum(rows, "dischargeWh") ?? 0),
                "Wh",
              )}
              sub="Charge + discharge"
              icon={BatteryCharging}
              tone="green"
            />
          </div>
          <Panel
            title={history ? "History explorer" : "Energy over time"}
            sub={`${start} to ${end} · ${rows.length} ${raw ? "readings" : "buckets"} · ${timezone}`}
          >
            <PowerChart rows={rows} timezone={timezone} energy={!raw} />
          </Panel>
          {!history && (
            <>
              <div className="two-col">
                <Panel
                  title="Period comparison"
                  sub="Compared with the immediately preceding equal-length date range"
                >
                  <dl className="detail-list">
                    <div>
                      <dt>Selected period solar</dt>
                      <dd>{formatValue(solar, "Wh")}</dd>
                    </div>
                    <div>
                      <dt>Previous period solar</dt>
                      <dd>{formatValue(lastSolar, "Wh")}</dd>
                    </div>
                    <div>
                      <dt>Change</dt>
                      <dd>
                        {change === null
                          ? "Unavailable"
                          : `${change.toFixed(1)}%`}
                      </dd>
                    </div>
                    <div>
                      <dt>Energy exported</dt>
                      <dd>{formatValue(exported, "Wh")}</dd>
                    </div>
                  </dl>
                  <p className="chart-caption">
                    A partial current day is not directly comparable with a
                    complete day. Missing intervals are excluded.
                  </p>
                </Panel>
                <Panel
                  title="Observed performance"
                  sub="Derived from stored measurements"
                >
                  <dl className="detail-list">
                    <div>
                      <dt>Peak solar</dt>
                      <dd>
                        {formatValue(
                          rows.some((r) => r.peakSolarW != null)
                            ? Math.max(...rows.map((r) => r.peakSolarW ?? 0))
                            : null,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Peak load</dt>
                      <dd>
                        {formatValue(
                          rows.some((r) => r.peakLoadW != null)
                            ? Math.max(...rows.map((r) => r.peakLoadW ?? 0))
                            : null,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Covered observation time</dt>
                      <dd>
                        {(
                          rows.reduce(
                            (n, r) => n + (r.coveredSeconds ?? 0),
                            0,
                          ) / 3600
                        ).toFixed(1)}{" "}
                        h
                      </dd>
                    </div>
                    <div>
                      <dt>Stored sample count</dt>
                      <dd>
                        {rows
                          .reduce(
                            (n, r) => n + (r.sampleCount ?? (raw ? 1 : 0)),
                            0,
                          )
                          .toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </Panel>
              </div>
              <Panel
                title="A year of sunshine"
                sub="Daily solar generation · empty squares mean no recorded data"
              >
                <div className="heatmap">
                  {Array.from({ length: 365 }, (_, i) => {
                    const date = formatInTimeZone(
                      new Date(now - (364 - i) * 86400000),
                      timezone,
                      "yyyy-MM-dd",
                    );
                    const row = heat.find(
                      (r) =>
                        r.timestamp &&
                        formatInTimeZone(
                          r.timestamp,
                          timezone,
                          "yyyy-MM-dd",
                        ) === date,
                    );
                    const value = row?.solarWh;
                    return (
                      <button
                        key={date}
                        aria-label={`${date}: ${value == null ? "No data" : formatValue(value, "Wh")}`}
                        title={`${date}\nGenerated: ${formatValue(value, "Wh")}\nConsumed: ${formatValue(row?.loadWh, "Wh")}\nExported: ${formatValue(row?.exportWh, "Wh")}`}
                        className={`heat-square heat-${value == null ? "empty" : Math.min(4, Math.floor(value / 15000) + 1)}`}
                        onClick={() => {
                          setStart(date);
                          setEnd(date);
                          setPeriod("custom");
                          setAggregation("hour");
                        }}
                      />
                    );
                  })}
                </div>
                <div className="heatmap-legend">
                  <span>Less</span>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <i key={i} className={`heat-square heat-${i || "empty"}`} />
                  ))}
                  <span>More</span>
                </div>
              </Panel>
            </>
          )}
          <Panel
            title="Data table"
            sub="Exports contain the selected device, range and aggregation. Missing values remain empty."
            action={
              <label className="inline-label">
                Metric
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {(raw
                    ? [
                        "pvPowerW",
                        "loadPowerW",
                        "batteryPowerW",
                        "gridPowerW",
                        "batterySoc",
                        "temperatureC",
                      ]
                    : [
                        "solarWh",
                        "loadWh",
                        "importWh",
                        "exportWh",
                        "chargeWh",
                        "dischargeWh",
                      ]
                  ).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp ({timezone})</th>
                    <th>{metric}</th>
                    <th>Quality / coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(page * 20, (page + 1) * 20).map((r, i) => {
                    const v = r[metric as keyof Row];
                    return (
                      <tr key={i}>
                        <td>{dateString(r)}</td>
                        <td>{typeof v === "number" ? v.toFixed(2) : "—"}</td>
                        <td>
                          {r.suspect
                            ? "Suspect — excluded"
                            : raw
                              ? "Stored reading"
                              : `${Math.round((r.coveredSeconds ?? 0) / 60)} min observed`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && (
                <p className="chart-empty">No data recorded in this range.</p>
              )}
            </div>
            <div className="table-pagination">
              <span>
                {rows.length} records · page {page + 1} of{" "}
                {Math.max(1, Math.ceil(rows.length / 20))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * 20 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
