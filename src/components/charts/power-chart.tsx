"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatInTimeZone } from "date-fns-tz";
import styles from "./power-chart.module.css";
export type ChartPoint = {
  deviceTimestamp?: string;
  timestamp?: string;
  pvPowerW?: number | null;
  loadPowerW?: number | null;
  batteryPowerW?: number | null;
  gridPowerW?: number | null;
  batterySoc?: number | null;
  solarWh?: number | null;
  loadWh?: number | null;
  importWh?: number | null;
  exportWh?: number | null;
  suspect?: boolean;
};
export function PowerChart({
  rows,
  timezone = "Asia/Baghdad",
  energy = false,
  soc = false,
  grid = false,
  initialView = "window",
}: {
  rows: ChartPoint[];
  timezone?: string;
  energy?: boolean;
  soc?: boolean;
  grid?: boolean;
  initialView?: "all" | "window";
}) {
  const chartId = useId();
  const solarFillId = useId();
  const loadFillId = useId();
  const [anchor, setAnchor] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(initialView === "all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  // The viewport only slices already loaded display points. Measurements,
  // aggregation, missing-value gaps, and provider requests remain untouched.
  const viewportSize = 48;
  const data: Record<string, string | number | null>[] = [];
  rows.forEach((r, i) => {
    const t = r.deviceTimestamp ?? r.timestamp!;
    if (
      !energy &&
      i > 0 &&
      +new Date(t) -
        +new Date(rows[i - 1].deviceTimestamp ?? rows[i - 1].timestamp!) >
        1800000
    )
      data.push({
        timestamp: new Date(+new Date(t) - 1).toISOString(),
        label: formatInTimeZone(new Date(+new Date(t) - 1), timezone, "HH:mm"),
        solar: null,
        load: null,
        battery: null,
        grid: null,
        soc: null,
      });
    data.push({
      timestamp: t,
      label: formatInTimeZone(t, timezone, energy ? "MMM d" : "HH:mm"),
      solar: r.suspect
        ? null
        : energy
          ? r.solarWh == null
            ? null
            : r.solarWh / 1000
          : r.pvPowerW == null
            ? null
            : r.pvPowerW / 1000,
      load: r.suspect
        ? null
        : energy
          ? r.loadWh == null
            ? null
            : r.loadWh / 1000
          : r.loadPowerW == null
            ? null
            : r.loadPowerW / 1000,
      battery:
        r.suspect || r.batteryPowerW == null ? null : r.batteryPowerW / 1000,
      grid: r.suspect
        ? null
        : energy
          ? r.importWh == null
            ? null
            : r.importWh / 1000
          : r.gridPowerW == null
            ? null
            : r.gridPowerW / 1000,
      soc: r.suspect ? null : (r.batterySoc ?? null),
    });
  });
  const maximumStart = Math.max(0, data.length - viewportSize);
  const anchoredIndex =
    anchor === null
      ? maximumStart
      : data.findIndex((point) => point.timestamp === anchor);
  const start = Math.min(Math.max(0, anchoredIndex), maximumStart);
  const canBrowse = maximumStart > 0;
  const visibleData = showAll ? data : data.slice(start, start + viewportSize);
  const navigationLabel = (point: Record<string, string | number | null>) =>
    formatInTimeZone(
      String(point.timestamp),
      timezone,
      energy ? "MMM d" : "MMM d · HH:mm",
    );
  const rangeLabel = visibleData.length
    ? `${navigationLabel(visibleData[0])} – ${navigationLabel(visibleData[visibleData.length - 1])}`
    : "No readings";
  const navigate = (nextStart: number) => {
    const next = Math.max(0, Math.min(maximumStart, nextStart));
    setAnchor(next === maximumStart ? null : String(data[next].timestamp));
  };

  useEffect(() => {
    const scrollbar = scrollRef.current;
    if (!scrollbar || showAll) return;
    const alignScroll = () => {
      const scrollableWidth = scrollbar.scrollWidth - scrollbar.clientWidth;
      const target =
        maximumStart > 0 ? (start / maximumStart) * scrollableWidth : 0;
      if (Math.abs(scrollbar.scrollLeft - target) > 1)
        scrollbar.scrollLeft = target;
    };
    alignScroll();
    const observer = new ResizeObserver(alignScroll);
    observer.observe(scrollbar);
    return () => observer.disconnect();
  }, [start, maximumStart, showAll]);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || showAll || !canBrowse) return;
    const onWheel = (event: WheelEvent) => {
      const distance = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      if (!distance || !scrollRef.current) return;
      event.preventDefault();
      scrollRef.current.scrollLeft += distance;
    };
    plot.addEventListener("wheel", onWheel, { passive: false });
    return () => plot.removeEventListener("wheel", onWheel);
  }, [canBrowse, showAll]);
  if (!rows.length)
    return <div className="chart-empty">No readings in this interval.</div>;
  const common = (
    <>
      <CartesianGrid
        strokeDasharray="3 4"
        vertical={false}
        stroke="var(--border)"
      />
      <XAxis
        dataKey="label"
        axisLine={false}
        tickLine={false}
        minTickGap={36}
        tick={{ fill: "var(--muted)", fontSize: 12 }}
      />
      <YAxis
        axisLine={false}
        tickLine={false}
        width={42}
        tick={{ fill: "var(--muted)", fontSize: 12 }}
        unit={soc ? "%" : ""}
      />
      <Tooltip
        content={({ active, payload, label, formatter }) =>
          active && payload.length ? (
            <div className="telemetry-tooltip">
              <div className="tooltip-time">{label}</div>
              {payload.map((item, index) => {
                const formatted =
                  formatter?.(item.value, item.name, item, index, payload) ??
                  item.value;
                return item.value == null ? null : (
                  <div className="tooltip-reading" key={String(item.dataKey)}>
                    <span>
                      <i style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <strong>
                      {Array.isArray(formatted) ? formatted[0] : formatted}
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : null
        }
        contentStyle={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text)",
          boxShadow: "var(--shadow)",
          padding: "12px 16px",
          fontSize: 12,
        }}
        formatter={(value) =>
          typeof value === "number"
            ? `${value.toFixed(2)} ${soc ? "%" : energy ? "kWh" : "kW"}`
            : value
        }
      />
      <Legend
        iconType="plainline"
        iconSize={7}
        wrapperStyle={{ fontSize: 12, paddingTop: 14 }}
      />
    </>
  );
  return (
    <div className={styles.root}>
      <div
        id={chartId}
        ref={plotRef}
        className={`chart ${styles.plot}`}
        role="img"
        aria-label={`${soc ? "Battery charge in percent" : energy ? "Energy in kilowatt-hours" : "Power in kilowatts"} for ${rows.length} stored samples. Showing ${rangeLabel}. Gaps are left blank.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          {energy ? (
            <AreaChart data={visibleData}>
              {common}
              <defs>
                <linearGradient id={solarFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0"
                    stopColor="var(--chart-solar)"
                    stopOpacity={0.16}
                  />
                  <stop
                    offset="1"
                    stopColor="var(--chart-solar)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
                <linearGradient id={loadFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0"
                    stopColor="var(--chart-load)"
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="1"
                    stopColor="var(--chart-load)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="linear"
                dataKey="solar"
                name="Solar"
                stroke="var(--chart-solar)"
                strokeWidth={2.4}
                fill={`url(#${solarFillId})`}
                connectNulls={false}
                isAnimationActive={false}
                dot={
                  visibleData.length <= 14
                    ? { r: 3, strokeWidth: 2, fill: "var(--card)" }
                    : false
                }
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              />
              <Area
                type="linear"
                dataKey="load"
                name="Consumption"
                stroke="var(--chart-load)"
                strokeWidth={2.2}
                fill={`url(#${loadFillId})`}
                connectNulls={false}
                isAnimationActive={false}
                dot={
                  visibleData.length <= 14
                    ? { r: 3, strokeWidth: 2, fill: "var(--card)" }
                    : false
                }
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={visibleData}>
              {common}
              <defs>
                <linearGradient id={solarFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0"
                    stopColor="var(--chart-solar)"
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="1"
                    stopColor="var(--chart-solar)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              {soc ? (
                <Area
                  type="linear"
                  dataKey="soc"
                  name="Battery SOC"
                  stroke="var(--chart-battery)"
                  fill="var(--green-soft)"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : grid ? (
                <Area
                  type="linear"
                  dataKey="grid"
                  name="Grid (+ import / − export)"
                  stroke="var(--chart-grid)"
                  fill="var(--purple-soft)"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : (
                <>
                  <Area
                    type="linear"
                    dataKey="solar"
                    name="Solar"
                    stroke="var(--chart-solar)"
                    strokeWidth={2.2}
                    fill={`url(#${solarFillId})`}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="linear"
                    dataKey="load"
                    name="Consumption"
                    stroke="var(--chart-load)"
                    strokeWidth={2.2}
                    fill="transparent"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="linear"
                    dataKey="battery"
                    name="Battery (+ charge)"
                    stroke="var(--chart-battery)"
                    fill="transparent"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="linear"
                    dataKey="grid"
                    name="Grid (+ import)"
                    stroke="var(--chart-grid)"
                    fill="transparent"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      {canBrowse && (
        <div
          className={styles.navigation}
          role="group"
          aria-label="Chart time navigation"
        >
          <div className={styles.navigationHeading}>
            <span className={styles.range} aria-live="polite">
              {rangeLabel}
            </span>
            <div className={styles.actions}>
              {!showAll && (
                <>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Earlier readings"
                    disabled={start === 0}
                    onClick={() =>
                      navigate(start - Math.floor(viewportSize / 2))
                    }
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Later readings"
                    disabled={start === maximumStart}
                    onClick={() =>
                      navigate(start + Math.floor(viewportSize / 2))
                    }
                  >
                    <ChevronRight size={15} />
                  </button>
                </>
              )}
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  setAnchor(null);
                  setShowAll(false);
                }}
                disabled={!showAll && start === maximumStart}
              >
                Latest
              </button>
              <button
                type="button"
                className={styles.textButton}
                aria-pressed={showAll}
                onClick={() => {
                  setShowAll(!showAll);
                  setAnchor(null);
                }}
              >
                {showAll ? "Time window" : "All readings"}
              </button>
            </div>
          </div>
          {!showAll && (
            <>
              <div className={styles.timelineShell}>
                <span
                  className={styles.selectionRail}
                  aria-hidden="true"
                  data-chart-selection-rail=""
                  style={{
                    left: `${(start / data.length) * 100}%`,
                    width: `${(viewportSize / data.length) * 100}%`,
                  }}
                />
                <div
                  ref={scrollRef}
                  className={styles.timelineScrollbar}
                  role="scrollbar"
                  aria-label="Scroll chart time"
                  aria-controls={chartId}
                  aria-orientation="horizontal"
                  aria-valuemin={0}
                  aria-valuemax={maximumStart}
                  aria-valuenow={start}
                  aria-valuetext={rangeLabel}
                  tabIndex={0}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    const width = element.scrollWidth - element.clientWidth;
                    if (width <= 0) return;
                    const next = Math.round(
                      (element.scrollLeft / width) * maximumStart,
                    );
                    if (next !== start) navigate(next);
                  }}
                  onKeyDown={(event) => {
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? maximumStart
                          : event.key === "ArrowLeft"
                            ? start - 1
                            : event.key === "ArrowRight"
                              ? start + 1
                              : event.key === "PageUp"
                                ? start - viewportSize
                                : event.key === "PageDown"
                                  ? start + viewportSize
                                  : null;
                    if (next === null) return;
                    event.preventDefault();
                    navigate(next);
                  }}
                >
                  <div
                    className={styles.timelineTrack}
                    style={{ width: `${(data.length / viewportSize) * 100}%` }}
                  />
                </div>
              </div>
              <div className={styles.navigationFootnote}>
                <span>{navigationLabel(data[0])}</span>
                <span>Scroll timeline · Shift + wheel on graph</span>
                <span>{navigationLabel(data[data.length - 1])}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
