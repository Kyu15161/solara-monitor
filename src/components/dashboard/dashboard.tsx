"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BatteryCharging,
  Bell,
  ChevronDown,
  Cpu,
  House,
  LayoutDashboard,
  Maximize2,
  Menu,
  Moon,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UtilityPole,
  X,
  AlertTriangle,
  History,
  Layers,
  UserRound,
  LogOut,
  Check,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { DashboardData } from "@/lib/data";
import { formatValue, formatTemperature, freshness } from "@/lib/domain";
import { Button } from "../ui/button";
import { Reading } from "../ui/reading";
import { MenuPopover } from "../ui/menu-popover";
import { EnergyFlow } from "../energy-flow";
import { PowerChart } from "../charts/power-chart";
import { AnalyticsPage } from "./analytics-page";
import { ControlsPage } from "./controls-page";
import { SettingsPage } from "./settings-page";
import styles from "./overview.module.css";
import workspaceStyles from "./workspace.module.css";

export const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "live", label: "Live power", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "energy", label: "Solar energy", icon: Sun },
  { id: "battery", label: "Battery", icon: BatteryCharging },
  { id: "grid", label: "Grid", icon: UtilityPole },
  { id: "inverter", label: "Inverter", icon: Cpu },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "controls", label: "Controls", icon: SlidersHorizontal },
  { id: "history", label: "History", icon: History },
  { id: "devices", label: "Devices", icon: Layers },
];
export type Action = (
  path: string,
  input: unknown,
  message?: string,
) => Promise<boolean>;
export function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Metric({
  title,
  value,
  sub,
  icon: Icon,
  tone = "green",
  href,
}: {
  title: string;
  value: string;
  sub: string;
  icon: typeof Sun;
  tone?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="metric-top">
        <span>{title}</span>
        <span className="metric-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>
        <Reading value={value} />
      </strong>
      <p>{sub}</p>
    </>
  );
  return href ? (
    <Link href={href} className={`metric metric-${tone}`}>
      {content}
    </Link>
  ) : (
    <div className={`metric metric-${tone}`}>{content}</div>
  );
}
export function Dashboard({
  initial,
  section,
  liveEnabled,
}: {
  initial: DashboardData;
  section: string;
  liveEnabled: boolean;
}) {
  const [data, setData] = useState(initial),
    [connected, setConnected] = useState(false),
    [now, setNow] = useState(initial.serverNow),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [drawer, setDrawer] = useState(false),
    [notifications, setNotifications] = useState(false),
    [search, setSearch] = useState(""),
    [theme, setTheme] = useState(initial.preference?.theme ?? "light");
  const router = useRouter();
  const device = data.devices.find((d) => d.id === data.selectedId);
  const integration = data.integrations.find(
    (i) => i.id === device?.integrationId,
  );
  const r = data.latest;
  const timezone =
    data.preference?.timezone ?? device?.timezone ?? "Asia/Baghdad";
  const status = freshness(
    r?.deviceTimestamp ?? null,
    now,
    data.freshness.delayed,
    data.freshness.offline,
  );
  const online = status === "online" && connected && device?.connected;
  const activeAlerts = data.alerts.filter((a) => !a.resolvedAt);
  const unread = data.notifications.filter((n) => !n.readAt).length;
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/dashboard${data.selectedId ? `?device=${data.selectedId}` : ""}`,
        { cache: "no-store" },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setConnected(false);
    }
  }, [data.selectedId, router]);
  useEffect(() => {
    setData(initial);
  }, [initial]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => setConnected(true);
    source.addEventListener("update", () => {
      setConnected(true);
      void refresh();
    });
    source.addEventListener("connection-error", () => setConnected(false));
    source.onerror = () => setConnected(false);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
    return () => {
      source.close();
      clearInterval(interval);
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const act: Action = async (path, input, message = "Saved") => {
    setBusy(true);
    try {
      const response = await fetch(`/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Request failed.");
      if (message) setToast(message);
      await refresh();
      return true;
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : "Unable to complete this action.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const href = (id: string) =>
    `/dashboard${id === "overview" ? "" : "/" + id}${device ? "?device=" + device.id : ""}`;
  const time = (value: string | null | undefined) =>
    value ? formatInTimeZone(value, timezone, "HH:mm:ss") : "—";
  const flowReading = device?.mode === "live" ? data.energyFlow : r;
  const flowActive =
    device?.mode === "live"
      ? !!device.connected &&
        connected &&
        !!data.energyFlowAt &&
        now - +new Date(data.energyFlowAt) < data.freshness.delayed * 1000
      : !!online;
  const flow = (
    <>
      <EnergyFlow
        pv={flowReading?.pvPowerW ?? null}
        load={flowReading?.loadPowerW ?? null}
        battery={flowReading?.batteryPowerW ?? null}
        grid={flowReading?.gridPowerW ?? null}
        soc={device?.mode === "live" ? null : (r?.batterySoc ?? null)}
        active={flowActive}
        device={device?.id ?? ""}
      />
      {device?.mode === "live" && (
        <p className="muted">
          Separate DESSMonitor flow snapshot received {time(data.energyFlowAt)}.
          The API supplies no device timestamp for this snapshot.
        </p>
      )}
    </>
  );
  const metrics = (
    <div className="metrics">
      <Metric
        title="Solar production"
        value={formatValue(r?.pvPowerW)}
        sub={`${device?.capacityW ? formatValue(device.capacityW) + "p installed" : "Capacity unavailable"}`}
        icon={Sun}
        tone="solar"
        href={href("energy")}
      />
      <Metric
        title="Home consumption"
        value={formatValue(r?.loadPowerW)}
        sub="Measured household load"
        icon={House}
        tone="blue"
        href={href("live")}
      />
      <Metric
        title="Battery level"
        value={formatValue(r?.batterySoc, "%")}
        sub={
          r?.batteryPowerW == null
            ? "Power unavailable"
            : `${r.batteryPowerW >= 0 ? "Charging" : "Discharging"} · ${formatValue(Math.abs(r.batteryPowerW))}`
        }
        icon={BatteryCharging}
        tone="green"
        href={href("battery")}
      />
      <Metric
        title="Grid power"
        value={formatValue(
          r?.gridPowerW == null ? null : Math.abs(r.gridPowerW),
        )}
        sub={
          r?.gridPowerW == null
            ? "Unavailable"
            : r.gridPowerW > 0
              ? "Importing from the grid"
              : r.gridPowerW < 0
                ? "Exporting to the grid"
                : "No grid exchange"
        }
        icon={r?.gridPowerW && r.gridPowerW > 0 ? ArrowDownLeft : ArrowUpRight}
        tone="purple"
        href={href("grid")}
      />
    </div>
  );
  const alertsPanel = (
    <Panel
      title="Recent alerts"
      sub={`${activeAlerts.length} active · ${activeAlerts.filter((a) => !a.acknowledgedAt).length} unacknowledged`}
      action={
        <Link className="text-link" href={href("alerts")}>
          View all <ArrowUpRight size={14} />
        </Link>
      }
    >
      <div className="compact-alerts">
        {data.alerts.slice(0, 3).map((a) => (
          <div key={a.id}>
            <span
              className={`alert-symbol ${a.resolvedAt ? "resolved" : a.severity.toLowerCase()}`}
            >
              <AlertTriangle size={17} />
            </span>
            <div>
              <strong>{a.title}</strong>
              <small>
                {a.resolvedAt
                  ? "Resolved"
                  : a.acknowledgedAt
                    ? "Active · acknowledged"
                    : "Active"}{" "}
                · {formatInTimeZone(a.firstSeen, timezone, "MMM d, HH:mm")}
              </small>
            </div>
          </div>
        ))}
        {!data.alerts.length && <p className="muted">No alerts reported.</p>}
      </div>
    </Panel>
  );
  const health = (
    <Panel title="System status" sub="Device and connection diagnostics">
      <div className="health-list">
        {[
          ["Inverter", status],
          [
            "Integration",
            integration?.connected
              ? integration.mode === "mock"
                ? "Demo connected"
                : "Connected"
              : "Disconnected",
          ],
          [
            "Database sync",
            integration?.lastError
              ? "Needs attention"
              : integration?.lastSync
                ? "Healthy"
                : "Waiting for worker",
          ],
          ["Realtime", connected ? "Connected" : "Reconnecting"],
          [
            "Temperature",
            formatTemperature(
              r?.temperatureC,
              data.preference?.temperatureUnit,
            ),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              <i
                className={
                  value === "online" ||
                  value === "Healthy" ||
                  value === "Connected"
                    ? "dot"
                    : "dot neutral"
                }
              />
              {value}
            </strong>
          </div>
        ))}
      </div>
      <div className="health-foot">
        <ShieldCheck size={17} />
        {activeAlerts.some((a) => a.severity === "CRITICAL")
          ? "Critical alert needs attention"
          : "No active critical alerts"}
      </div>
    </Panel>
  );
  const widgets = Array.isArray(data.preference?.widgets)
    ? data.preference.widgets.filter((v): v is string => typeof v === "string")
    : ["metrics", "flow", "health", "chart", "alerts"];
  const accountOptions = (
    <>
      <Link
        href={href("account")}
        aria-current={section === "account" ? "page" : undefined}
        onClick={() => setDrawer(false)}
      >
        <UserRound />
        Account
      </Link>
      <Link
        href={href("settings")}
        aria-current={section === "settings" ? "page" : undefined}
        onClick={() => setDrawer(false)}
      >
        <Settings2 />
        Settings
      </Link>
      <hr />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (await act("auth/logout", {}, "")) router.replace("/login");
        }}
      >
        <LogOut />
        Sign out
      </button>
    </>
  );
  return (
    <div
      className={`app-shell ${workspaceStyles.workspace} ${section === "monitor" ? "monitor-mode" : ""} ${section === "overview" ? styles.overview : ""}`}
      data-section={section}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={`sidebar ${drawer ? "open" : ""}`}>
        <Link href={href("overview")} className="brand">
          <span className="brand-icon">
            <Sun size={25} />
          </span>
          solara<span className="brand-tag">ENERGY MONITOR</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <MenuPopover
          key={`workspace:${section}:${data.selectedId}`}
          className="workspace-chip"
          label="Choose energy system"
          regionLabel="Energy systems"
          trigger={
            <>
              <div>
                <House size={17} />
              </div>
              <span>
                My energy system
                <small>{device?.plant ?? "Get connected"}</small>
              </span>
              <ChevronDown size={14} />
            </>
          }
        >
          {data.devices.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard${section === "overview" ? "" : "/" + section}?device=${d.id}`}
              aria-current={d.id === device?.id ? "true" : undefined}
              onClick={() => setDrawer(false)}
            >
              <Cpu />
              <span>
                <strong>{d.alias}</strong>
                <small>{d.plant}</small>
              </span>
              {d.id === device?.id && <Check />}
            </Link>
          ))}
          {!data.devices.length && (
            <p className="muted">No energy systems connected.</p>
          )}
          <hr />
          <Link href={href("devices")} onClick={() => setDrawer(false)}>
            <Layers />
            Manage devices
          </Link>
          <Link href={href("integrations")} onClick={() => setDrawer(false)}>
            <House />
            Connect a system
          </Link>
        </MenuPopover>
        <div className="nav-label">MONITOR</div>
        <nav aria-label="Main navigation">
          {navigation.map((item, i) => (
            <div key={item.id}>
              {i === 7 && <div className="nav-label">MANAGE</div>}
              <Link
                href={href(item.id)}
                onClick={() => setDrawer(false)}
                className={`nav-item ${section === item.id ? "active" : ""}`}
                aria-current={section === item.id ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <item.icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === "alerts" &&
                  activeAlerts.filter((a) => !a.acknowledgedAt).length > 0 && (
                    <b className="nav-count">
                      {activeAlerts.filter((a) => !a.acknowledgedAt).length}
                    </b>
                  )}
                {item.id === "live" && <i className="dot" />}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <MenuPopover
            key={`profile:${section}:${data.selectedId}`}
            className="profile"
            label={`View account for ${data.user.name}`}
            regionLabel="Account options"
            placement="above"
            trigger={
              <>
                <span className="avatar">{data.user.name.slice(0, 1)}</span>
                <span>
                  {data.user.name}
                  <small>
                    {data.user.isDemo
                      ? "Demo workspace"
                      : data.user.role.toLowerCase()}
                  </small>
                </span>
                <ChevronDown size={14} />
              </>
            }
          >
            {accountOptions}
          </MenuPopover>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setDrawer(true)}
          >
            <Menu size={20} />
          </Button>
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>
              {navigation.find((n) => n.id === section)?.label ??
                section.charAt(0).toUpperCase() + section.slice(1)}
            </strong>
          </div>
          <div className="topbar-tools">
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="Search pages and metrics"
                placeholder="Search anything…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌕</kbd>
              {search && (
                <div className="search-results">
                  {navigation
                    .filter((n) =>
                      n.label.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((n) => (
                      <Link
                        key={n.id}
                        href={href(n.id)}
                        onClick={() => setSearch("")}
                      >
                        <n.icon size={16} />
                        {n.label}
                      </Link>
                    ))}
                  {data.latest?.fields
                    .filter((f) =>
                      f.title.toLowerCase().includes(search.toLowerCase()),
                    )
                    .slice(0, 5)
                    .map((f) => (
                      <Link
                        key={f.id}
                        href={href("inverter")}
                        onClick={() => setSearch("")}
                      >
                        {f.title}
                      </Link>
                    ))}
                  {data.alerts
                    .filter((a) =>
                      a.title.toLowerCase().includes(search.toLowerCase()),
                    )
                    .slice(0, 3)
                    .map((a) => (
                      <Link
                        key={a.id}
                        href={href("alerts")}
                        onClick={() => setSearch("")}
                      >
                        {a.title}
                      </Link>
                    ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                theme === "light"
                  ? "Switch to dark theme"
                  : "Switch to light theme"
              }
              onClick={() => {
                const value = theme === "light" ? "dark" : "light";
                setTheme(value);
                void act("preferences", { theme: value }, "");
              }}
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </Button>
            <div className="notification-wrap">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Notifications, ${unread} unread`}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {unread > 0 && <i className="notification-dot" />}
              </Button>
              {notifications && (
                <div className="notification-panel">
                  <div>
                    <h3>Notifications</h3>
                    <button
                      onClick={() =>
                        void act(
                          "notifications/read",
                          {},
                          "All notifications marked read",
                        )
                      }
                    >
                      Mark all read
                    </button>
                  </div>
                  {data.notifications.slice(0, 12).map((n) => (
                    <button
                      className={n.readAt ? "read" : ""}
                      key={n.id}
                      onClick={() => {
                        void act("notifications/read", { id: n.id }, "");
                        router.push(n.href);
                        setNotifications(false);
                      }}
                    >
                      <strong>{n.title}</strong>
                      <span>{n.message}</span>
                    </button>
                  ))}
                  {!data.notifications.length && <p>You’re all caught up.</p>}
                </div>
              )}
            </div>
            <MenuPopover
              key={`account:${section}:${data.selectedId}`}
              className="header-account"
              label="Account"
              regionLabel="Account options"
              placement="right"
              trigger={
                <>
                  <span className="header-avatar">
                    {data.user.name.slice(0, 1)}
                  </span>
                  <span className="header-identity">
                    <strong>{data.user.name}</strong>
                    <small>{data.user.email}</small>
                  </span>
                </>
              }
            >
              {accountOptions}
            </MenuPopover>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {device?.mode === "mock" && (
            <div className="demo-banner">
              <span>
                <span className="demo-pill">DEMO SYSTEM</span> Simulated
                inverter data ·{" "}
                {integration?.scenario === "sunny"
                  ? "Sunny daytime"
                  : integration?.scenario.replaceAll("-", " ")}{" "}
                scenario
              </span>
              <Link href={href("integrations")}>
                Connect my system <ArrowRightIcon />
              </Link>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {device?.plant ?? "YOUR ENERGY WORKSPACE"}
              </div>
              <h1>
                {section === "overview"
                  ? "Energy overview"
                  : section === "monitor"
                    ? "Energy monitor"
                    : (navigation.find((n) => n.id === section)?.label ??
                      section.charAt(0).toUpperCase() + section.slice(1))}
              </h1>
              <p>
                {section === "overview"
                  ? "Power distribution and system diagnostics."
                  : section === "controls"
                    ? "Supported settings, deliberate changes, verified outcomes."
                    : section === "analytics"
                      ? "Turn your energy history into a clearer picture."
                      : (device?.model ??
                        "Connect a system or explore the demo.")}
              </p>
            </div>
            <div className="heading-actions">
              {device && (
                <label className="device-select">
                  <Cpu size={16} />
                  <select
                    aria-label="Select inverter"
                    value={device.id}
                    onChange={(e) =>
                      router.push(
                        `/dashboard/${section}?device=${e.target.value}`,
                      )
                    }
                  >
                    {data.devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.alias} · {d.plant}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button
                variant="outline"
                disabled={busy || !integration?.connected}
                onClick={() =>
                  integration &&
                  void act(
                    "sync",
                    { integrationId: integration.id },
                    "Sync queued for the background worker",
                  )
                }
              >
                <RefreshCw size={15} className={busy ? "spin" : ""} />
                Sync now
              </Button>
            </div>
          </div>
          {device && (
            <div className="freshness-strip">
              <span
                className={`status-badge ${online ? "healthy" : !device.connected || status === "offline" ? "offline" : "warning"}`}
              >
                <i className={`dot ${online ? "" : "neutral"}`} />
                {!device.connected
                  ? "DISCONNECTED"
                  : !connected
                    ? "RECONNECTING"
                    : status === "online"
                      ? "LIVE · ONLINE"
                      : status.toUpperCase()}
              </span>
              <span>
                Inverter reading <b>{time(r?.deviceTimestamp)}</b>
              </span>
              <span>
                Server sync <b>{time(integration?.lastSync)}</b>
              </span>
              <span>
                Next sync{" "}
                <b>
                  {integration?.connected
                    ? `${Math.max(0, Math.ceil((+new Date(integration.nextSync) - now) / 1000))}s`
                    : "Paused"}
                </b>
              </span>
              <span className="timezone">{timezone}</span>
            </div>
          )}
          {device && (!online || r?.suspect) && (
            <div className="notice warning" role="status">
              <Radio size={17} />
              {!connected
                ? "Realtime connection interrupted. Showing last known data."
                : !device.connected
                  ? "Integration disconnected. Historical data remains available."
                  : r?.suspect
                    ? "Suspect telemetry. Excluded from energy calculations."
                    : "STALE DATA — the inverter is not reporting fresh readings."}
            </div>
          )}
          {integration?.lastError && (
            <div className="error-message">{integration.lastError}</div>
          )}
          {!device ? (
            <div className="empty-state">
              <Sun size={52} />
              <h2>No solar system connected yet.</h2>
              <p>
                Connect DESSMonitor or explore a simulated home with 90 days of
                energy history.
              </p>
              <div>
                <Button
                  disabled={busy}
                  onClick={() => void act("demo", {}, "Demo system ready")}
                >
                  {busy ? "Preparing your demo…" : "Try demo system"}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/integrations">
                    Connect DESSMonitor
                  </Link>
                </Button>
              </div>
              {["settings", "account", "integrations"].includes(section) && (
                <SettingsPage
                  data={data}
                  section={section}
                  act={act}
                  busy={busy}
                  liveEnabled={liveEnabled}
                />
              )}
            </div>
          ) : (
            <>
              {section === "overview" && (
                <div className="overview-widgets">
                  {widgets.map((widget) => (
                    <div key={widget} className={`widget-${widget}`}>
                      {widget === "metrics" ? (
                        metrics
                      ) : widget === "flow" ? (
                        <Panel
                          title="Energy balance"
                          sub="Source, storage and destination"
                          action={
                            <Link
                              className="icon-link"
                              href={href("monitor")}
                              aria-label="Open fullscreen energy monitor"
                            >
                              <Maximize2 size={16} />
                            </Link>
                          }
                        >
                          {flow}
                          <div className="flow-footer">
                            <span>
                              <i className="dot" />
                              {flowActive
                                ? "Power flow updating"
                                : "Last known power flow"}
                            </span>
                            <span>
                              Tap a node to explore <ArrowUpRight size={13} />
                            </span>
                          </div>
                        </Panel>
                      ) : widget === "chart" ? (
                        <Panel
                          title="Today’s energy"
                          sub="Production and consumption today"
                          action={
                            <Link
                              className="text-link"
                              href={href("analytics")}
                            >
                              Explore analytics <ArrowUpRight size={14} />
                            </Link>
                          }
                        >
                          <div className="energy-summary">
                            <div>
                              <span>Solar generated</span>
                              <strong>
                                {formatValue(data.today?.solarWh, "Wh")}
                              </strong>
                            </div>
                            <div>
                              <span>Home consumed</span>
                              <strong>
                                {formatValue(data.today?.loadWh, "Wh")}
                              </strong>
                            </div>
                            <div>
                              <span>Grid exported</span>
                              <strong>
                                {formatValue(data.today?.exportWh, "Wh")}
                              </strong>
                            </div>
                          </div>
                          <PowerChart
                            rows={data.timeline}
                            timezone={timezone}
                            initialView="all"
                          />
                          <div className="chart-caption">
                            Energy is integrated from stored measurements.
                            Missing intervals are excluded.
                          </div>
                        </Panel>
                      ) : widget === "health" ? (
                        health
                      ) : (
                        alertsPanel
                      )}
                    </div>
                  ))}
                </div>
              )}
              {section === "monitor" && (
                <>
                  <div className="monitor-clock">
                    {formatInTimeZone(new Date(now), timezone, "HH:mm:ss")}
                    <Link href={href("overview")}>
                      Exit monitor <X size={16} />
                    </Link>
                  </div>
                  {metrics}
                  <Panel title="Live energy flow" sub={device.plant}>
                    {flow}
                  </Panel>
                  {alertsPanel}
                </>
              )}
              {["live", "energy", "battery", "grid", "inverter"].includes(
                section,
              ) && (
                <MonitoringPage
                  section={section}
                  data={data}
                  timezone={timezone}
                  metrics={metrics}
                  now={now}
                />
              )}
              {["analytics", "history"].includes(section) && (
                <AnalyticsPage
                  deviceId={device.id}
                  timezone={timezone}
                  history={section === "history"}
                  serverNow={initial.serverNow}
                />
              )}
              {section === "alerts" && (
                <AlertsPage
                  data={data}
                  act={act}
                  busy={busy}
                  timezone={timezone}
                />
              )}
              {section === "controls" && (
                <ControlsPage
                  data={data}
                  act={act}
                  busy={busy}
                  timezone={timezone}
                />
              )}
              {section === "devices" && (
                <div className="device-grid">
                  {data.devices.map((d) => (
                    <Panel key={d.id} title={d.alias} sub={d.plant}>
                      <div className="device-illustration">
                        <Cpu size={64} />
                        <span className="status-badge healthy">
                          {d.mode === "mock" ? "DEMO INVERTER" : "DESSMONITOR"}
                        </span>
                      </div>
                      <dl className="detail-list">
                        {[
                          ["Model", d.model ?? "Not supplied"],
                          ["Serial", d.sn],
                          ["Collector", d.pn],
                          ["Protocol", String(d.devcode)],
                          ["Timezone", d.timezone],
                          ["PV capacity", formatValue(d.capacityW)],
                          ["Battery capacity", formatValue(d.batteryWh, "Wh")],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <Button variant="outline" asChild>
                        <Link href={`/dashboard/inverter?device=${d.id}`}>
                          Open inverter <ArrowUpRight size={15} />
                        </Link>
                      </Button>
                    </Panel>
                  ))}
                </div>
              )}
              {["settings", "account", "integrations"].includes(section) && (
                <SettingsPage
                  data={data}
                  section={section}
                  act={act}
                  busy={busy}
                  liveEnabled={liveEnabled}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Sun size={14} /> Solara · Energy monitoring
            </span>
            <span>
              {device?.mode === "mock"
                ? "SIMULATED SYSTEM"
                : "SECURE MONITORING"}
              <span>·</span>All times in {timezone}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={14} />;
}
function MonitoringPage({
  section,
  data,
  timezone,
  metrics,
  now,
}: {
  section: string;
  data: DashboardData;
  timezone: string;
  metrics: React.ReactNode;
  now: number;
}) {
  const [windowHours, setWindowHours] = useState(24);
  const r = data.latest;
  const device = data.devices.find((d) => d.id === data.selectedId)!;
  const categories: Record<string, string[]> = {
    energy: ["Solar", "Energy"],
    battery: ["Battery"],
    grid: ["Grid"],
    inverter: ["System", "Other", "Temperature"],
    live: ["Solar", "Battery", "Grid", "AC Output", "System", "Other"],
  };
  const fields = (r?.fields ?? []).filter((f) =>
    categories[section]?.includes(f.category),
  );
  return (
    <>
      {metrics}
      <Panel
        title={
          section === "battery"
            ? "Battery state of charge"
            : section === "grid"
              ? "Grid exchange"
              : section === "energy"
                ? "Solar production timeline"
                : "Power timeline"
        }
        sub={
          section === "grid"
            ? "Import above zero · export below zero"
            : "Stored device measurements"
        }
        action={
          <select
            aria-label="Timeline window"
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
          >
            {[0.5, 1, 3, 6, 12, 24].map((h) => (
              <option value={h} key={h}>
                {h === 0.5 ? "30 minutes" : `${h} hours`}
              </option>
            ))}
          </select>
        }
      >
        <PowerChart
          rows={data.liveTimeline.filter(
            (p) => +new Date(p.deviceTimestamp) >= now - windowHours * 3600000,
          )}
          timezone={timezone}
          soc={section === "battery"}
          grid={section === "grid"}
        />
      </Panel>
      <div className="two-col">
        <Panel
          title={
            section === "inverter"
              ? "Device information"
              : "Detailed measurements"
          }
          sub="Available fields reported by this provider"
        >
          {section === "inverter" && (
            <dl className="detail-list">
              {[
                ["Model", device.model ?? "Not supplied"],
                ["Serial number", device.sn],
                ["Collector PN", device.pn],
                ["Protocol code", String(device.devcode)],
                ["Device address", String(device.devaddr)],
                ["Firmware", device.firmware ?? "Not supplied"],
                [
                  "History import",
                  device.historyStatus.replaceAll("_", " ").toLowerCase(),
                ],
                ["Device timezone", device.timezone],
                ["Operating mode", r?.operatingMode ?? "Unavailable"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="parameter-grid">
            {fields.map((f) => (
              <div key={f.id}>
                <span>{f.title}</span>
                <strong>
                  {typeof f.value === "number"
                    ? f.unit === "°C"
                      ? formatTemperature(
                          f.value,
                          data.preference?.temperatureUnit,
                        )
                      : formatValue(f.value, f.unit)
                    : f.value === null
                      ? "Unavailable"
                      : String(f.value)}
                </strong>
              </div>
            ))}
            {!fields.length && (
              <p className="muted">Telemetry unavailable for this inverter.</p>
            )}
          </div>
        </Panel>
        <Panel title="Energy & reporting" sub="Today’s stored observations">
          <dl className="detail-list">
            {[
              ["Solar generation", formatValue(data.today?.solarWh, "Wh")],
              ["Grid imported", formatValue(data.today?.importWh, "Wh")],
              ["Grid exported", formatValue(data.today?.exportWh, "Wh")],
              ["Battery charged", formatValue(data.today?.chargeWh, "Wh")],
              [
                "Battery discharged",
                formatValue(data.today?.dischargeWh, "Wh"),
              ],
              ["Grid voltage", formatValue(r?.gridVoltage, "V")],
              ["Grid frequency", formatValue(r?.gridFrequency, "Hz")],
              [
                "Device timestamp",
                r?.deviceTimestamp
                  ? formatInTimeZone(
                      r.deviceTimestamp,
                      timezone,
                      "MMM d, HH:mm:ss",
                    )
                  : "Unavailable",
              ],
              [
                "Received at",
                r?.receivedAt
                  ? formatInTimeZone(r.receivedAt, timezone, "HH:mm:ss")
                  : "Unavailable",
              ],
              [
                "Processed at",
                r?.processedAt
                  ? formatInTimeZone(r.processedAt, timezone, "HH:mm:ss")
                  : "Unavailable",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <Panel
        title="Advanced · Raw parameters"
        sub="Unknown protocol fields remain available for inspection"
      >
        <details>
          <summary>Inspect normalized parameter data</summary>
          <pre className="raw-data">
            {JSON.stringify(r?.fields ?? [], null, 2)}
          </pre>
          <Button
            variant="outline"
            onClick={() =>
              void navigator.clipboard.writeText(
                JSON.stringify(r?.fields ?? [], null, 2),
              )
            }
          >
            Copy parameter JSON
          </Button>
        </details>
      </Panel>
    </>
  );
}
function AlertsPage({
  data,
  act,
  busy,
  timezone,
}: {
  data: DashboardData;
  act: Action;
  busy: boolean;
  timezone: string;
}) {
  const [filter, setFilter] = useState("active"),
    [severity, setSeverity] = useState("all"),
    [query, setQuery] = useState("");
  const alerts = data.alerts.filter(
    (a) =>
      (filter === "all" ||
        (filter === "active" ? !a.resolvedAt : !!a.resolvedAt)) &&
      (severity === "all" || a.severity === severity) &&
      `${a.title} ${a.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="filter-bar">
        <div className="segmented">
          {["active", "resolved", "all"].map((v) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <input
          aria-label="Search alerts"
          placeholder="Search alerts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Alert severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">All severities</option>
          {["CRITICAL", "WARNING", "INFO"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <Panel
        title="System alerts"
        sub="Acknowledgement records that you have seen an alert; it does not resolve the condition."
      >
        <div className="alert-list">
          {alerts.map((a) => (
            <article key={a.id}>
              <span
                className={`alert-symbol ${a.resolvedAt ? "resolved" : a.severity.toLowerCase()}`}
              >
                <AlertTriangle size={20} />
              </span>
              <div>
                <div className="alert-title">
                  <h3>{a.title}</h3>
                  <span
                    className={`small-badge ${a.resolvedAt ? "healthy" : a.severity.toLowerCase()}`}
                  >
                    {a.resolvedAt ? "RESOLVED" : a.severity}
                  </span>
                  <span className="small-badge">{a.source}</span>
                </div>
                <p>{a.description}</p>
                <small>
                  First detected{" "}
                  {formatInTimeZone(a.firstSeen, timezone, "MMM d, HH:mm")} ·
                  Last seen{" "}
                  {formatInTimeZone(a.lastSeen, timezone, "MMM d, HH:mm")}
                </small>
                {a.acknowledgedAt && (
                  <small>
                    Acknowledged by {a.acknowledgedBy} ·{" "}
                    {formatInTimeZone(
                      a.acknowledgedAt,
                      timezone,
                      "MMM d, HH:mm",
                    )}
                  </small>
                )}
                {a.resolvedAt && (
                  <small>
                    Resolved{" "}
                    {formatInTimeZone(a.resolvedAt, timezone, "MMM d, HH:mm")}
                  </small>
                )}
              </div>
              {!a.acknowledgedAt && !a.resolvedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || data.user.role === "VIEWER"}
                  onClick={() =>
                    void act(
                      "alerts/acknowledge",
                      { id: a.id },
                      "Alert acknowledged. Equipment condition remains active.",
                    )
                  }
                >
                  Acknowledge
                </Button>
              )}
            </article>
          ))}
          {!alerts.length && (
            <div className="chart-empty">
              <ShieldCheck size={30} />
              <p>No alerts match these filters.</p>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
