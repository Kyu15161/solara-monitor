"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cable,
  Database,
  Download,
  LogOut,
  ShieldCheck,
  Sun,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { DashboardData } from "@/lib/data";
import { Panel, type Action } from "./dashboard";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
export function SettingsPage({
  data,
  section,
  act,
  busy,
  liveEnabled,
}: {
  data: DashboardData;
  section: string;
  act: Action;
  busy: boolean;
  liveEnabled: boolean;
}) {
  const router = useRouter();
  const [disconnect, setDisconnect] = useState<string | null>(null),
    [deleting, setDeleting] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(""),
    [deletePassword, setDeletePassword] = useState("");
  const device = data.devices.find((d) => d.id === data.selectedId);
  const preference = data.preference;
  const widgets = Array.isArray(preference?.widgets)
    ? preference.widgets.filter((w): w is string => typeof w === "string")
    : ["metrics", "flow", "health", "chart", "alerts"];
  async function formSubmit(
    event: React.FormEvent<HTMLFormElement>,
    path: string,
    transform?: (form: FormData) => unknown,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act(
      path,
      transform ? transform(form) : Object.fromEntries(form.entries()),
    );
  }
  return (
    <>
      <div className="settings-grid">
        {section !== "integrations" && (
          <>
            <Panel
              title="Your profile"
              sub="A personal workspace for your energy"
            >
              <form
                onSubmit={(e) => void formSubmit(e, "account/profile")}
                className="settings-form"
              >
                <label>
                  Display name
                  <input
                    name="name"
                    defaultValue={data.user.name}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  Email address
                  <input value={data.user.email} readOnly />
                </label>
                <p className="muted">
                  Role: {data.user.role.toLowerCase()} ·{" "}
                  {data.user.isDemo
                    ? "Private demo session"
                    : "Registered account"}
                </p>
                <Button disabled={busy}>Save profile</Button>
              </form>
            </Panel>
            <Panel
              title="Regional preferences"
              sub="Make your dashboard feel familiar"
            >
              <form
                className="settings-form"
                onSubmit={(e) => void formSubmit(e, "preferences")}
              >
                <label>
                  Timezone
                  <select
                    name="timezone"
                    defaultValue={preference?.timezone ?? "Asia/Baghdad"}
                  >
                    {[
                      "Asia/Baghdad",
                      "UTC",
                      "Asia/Dubai",
                      "Europe/London",
                      "Europe/Berlin",
                      "America/New_York",
                      "America/Los_Angeles",
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <p className="chart-caption">
                  Day boundaries and energy history use this timezone. The first
                  historical query in a new timezone may take a moment to
                  prepare.
                </p>
                <label>
                  Temperature unit
                  <select
                    name="temperatureUnit"
                    defaultValue={preference?.temperatureUnit ?? "C"}
                  >
                    <option value="C">Celsius (°C)</option>
                    <option value="F">Fahrenheit (°F)</option>
                  </select>
                </label>
                <Button disabled={busy}>Save preferences</Button>
              </form>
            </Panel>
            <Panel
              title="Energy tariffs"
              sub="Optional estimates based on your own rates"
            >
              <form
                className="settings-form"
                onSubmit={(e) =>
                  void formSubmit(e, "preferences", (f) => ({
                    currency: f.get("currency"),
                    importTariff:
                      f.get("importTariff") === ""
                        ? null
                        : Number(f.get("importTariff")),
                    exportTariff:
                      f.get("exportTariff") === ""
                        ? null
                        : Number(f.get("exportTariff")),
                  }))
                }
              >
                <label>
                  Currency
                  <select
                    name="currency"
                    defaultValue={preference?.currency ?? "IQD"}
                  >
                    {["IQD", "USD", "EUR", "GBP"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div className="form-row">
                  <label>
                    Import price / kWh
                    <input
                      name="importTariff"
                      type="number"
                      min="0"
                      max="100000"
                      step="any"
                      defaultValue={preference?.importTariff ?? ""}
                      placeholder="Not configured"
                    />
                  </label>
                  <label>
                    Export credit / kWh
                    <input
                      name="exportTariff"
                      type="number"
                      min="0"
                      max="100000"
                      step="any"
                      defaultValue={preference?.exportTariff ?? ""}
                      placeholder="Not configured"
                    />
                  </label>
                </div>
                <Button disabled={busy}>Save tariffs</Button>
                {preference?.importTariff != null &&
                  data.today?.importWh != null && (
                    <p className="notice">
                      Today’s estimated grid cost:{" "}
                      {(
                        (data.today.importWh / 1000) *
                        preference.importTariff
                      ).toFixed(2)}{" "}
                      {preference.currency}. Not a utility bill.
                    </p>
                  )}
              </form>
            </Panel>
            <Panel
              title="Overview layout"
              sub="Choose and arrange your dashboard widgets"
            >
              <div className="widget-editor">
                {["metrics", "flow", "health", "chart", "alerts"].map((w) => (
                  <label key={w} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={widgets.includes(w)}
                      disabled={busy}
                      onChange={(e) =>
                        void act(
                          "preferences",
                          {
                            widgets: e.target.checked
                              ? [...widgets, w]
                              : widgets.filter((v) => v !== w),
                          },
                          "Layout saved",
                        )
                      }
                    />
                    {w.charAt(0).toUpperCase() + w.slice(1)}
                  </label>
                ))}
              </div>
              <div className="widget-order">
                {widgets.map((w, i) => (
                  <div key={w}>
                    <span>
                      {i + 1}. {w}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${w} up`}
                      disabled={i === 0 || busy}
                      onClick={() => {
                        const updated = [...widgets];
                        [updated[i - 1], updated[i]] = [
                          updated[i],
                          updated[i - 1],
                        ];
                        void act("preferences", { widgets: updated }, "");
                      }}
                    >
                      <ChevronUp size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${w} down`}
                      disabled={i === widgets.length - 1 || busy}
                      onClick={() => {
                        const updated = [...widgets];
                        [updated[i + 1], updated[i]] = [
                          updated[i],
                          updated[i + 1],
                        ];
                        void act("preferences", { widgets: updated }, "");
                      }}
                    >
                      <ChevronDown size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(
                    "preferences",
                    {
                      widgets: ["metrics", "flow", "health", "chart", "alerts"],
                    },
                    "Layout reset",
                  )
                }
              >
                Reset layout
              </Button>
            </Panel>
            <Panel
              title="Control safety"
              sub="Changes require an explicit review and confirmation"
            >
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={preference?.safeMode !== false}
                  disabled={busy || data.user.role !== "OWNER"}
                  onChange={(e) =>
                    void act(
                      "preferences",
                      { safeMode: e.target.checked },
                      "Safe Control Mode updated",
                    )
                  }
                />
                Safe Control Mode
              </label>
              <p className="muted">
                High-impact settings stay disabled while Safe Control Mode is
                on. Only the owner can change this preference.
              </p>
              {device && (
                <form
                  className="settings-form"
                  onSubmit={(e) =>
                    void formSubmit(e, `devices/${device.id}/alias`)
                  }
                >
                  <label>
                    Local inverter name
                    <input
                      name="alias"
                      defaultValue={device.alias}
                      required
                      maxLength={80}
                    />
                  </label>
                  <Button variant="outline" disabled={busy}>
                    Save local name
                  </Button>
                  <small>This changes the display name in Solara only.</small>
                </form>
              )}
            </Panel>
            <Panel title="Data & security" sub="Your records remain portable">
              <div className="settings-actions">
                <Button variant="outline" asChild>
                  <a href="/api/backup" download>
                    <Download size={16} />
                    Export account records
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`/dashboard/history${device ? "?device=" + device.id : ""}`}
                  >
                    <Database size={16} />
                    Export telemetry
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (await act("auth/logout", {}, ""))
                      router.replace("/login");
                  }}
                >
                  <LogOut size={16} />
                  Sign out
                </Button>
                <Button variant="destructive" onClick={() => setDeleting(true)}>
                  Delete application account
                </Button>
              </div>
              <p className="chart-caption">
                Account export includes preferences, devices, recent alerts,
                commands and audits. Use History for telemetry exports.
                Credentials are never included.
              </p>
            </Panel>
          </>
        )}
        <Panel
          title="DESSMonitor connection"
          sub="Secure, server-side integration"
        >
          <div className="integration-mark">
            <Cable size={25} />
            <div>
              <strong>DESSMonitor</strong>
              <small>
                {liveEnabled
                  ? "Live connections enabled"
                  : "This installation is in mock mode"}
              </small>
            </div>
            <ShieldCheck size={20} />
          </div>
          {data.integrations.map((i) => (
            <div className="integration-card" key={i.id}>
              <div>
                <strong>{i.label}</strong>
                <span className={`small-badge ${i.connected ? "healthy" : ""}`}>
                  {i.connected ? "CONNECTED" : "DISCONNECTED"} ·{" "}
                  {i.mode.toUpperCase()}
                </span>
              </div>
              <p>
                {data.devices.filter((d) => d.integrationId === i.id).length}{" "}
                inverter(s) · Last sync{" "}
                {i.lastSync ? new Date(i.lastSync).toLocaleString() : "Not yet"}
              </p>
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !i.connected}
                  onClick={() =>
                    void act("sync", { integrationId: i.id }, "Sync queued")
                  }
                >
                  Sync now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || data.user.role !== "OWNER"}
                  onClick={() =>
                    i.connected
                      ? setDisconnect(i.id)
                      : void act(
                          "integrations/reconnect",
                          { integrationId: i.id, confirmed: true },
                          "Synchronization resumed",
                        )
                  }
                >
                  {i.connected ? "Disconnect" : "Reconnect"}
                </Button>
              </div>
            </div>
          ))}
          {!liveEnabled ? (
            <p className="notice">
              Real credentials are not accepted while mock mode is active. The
              operator must configure the official HTTPS endpoint, application
              identity and encryption key, then enable live mode.
            </p>
          ) : (
            <form
              className="settings-form"
              autoComplete="off"
              onSubmit={async (e) => {
                const form = e.currentTarget;
                await formSubmit(e, "integrations/connect");
                form.reset();
              }}
            >
              <label>
                DESSMonitor username
                <input name="username" required maxLength={100} />
              </label>
              <label>
                DESSMonitor password
                <input
                  type="password"
                  name="password"
                  required
                  maxLength={200}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Company key
                <input
                  type="password"
                  name="companyKey"
                  required
                  maxLength={200}
                  autoComplete="off"
                />
              </label>
              <Button disabled={busy || data.user.role !== "OWNER"}>
                Connect & discover devices
              </Button>
              <small>
                Credentials are encrypted at rest and are never returned to this
                browser.
              </small>
            </form>
          )}
          {!data.integrations.some((i) => i.mode === "mock") && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void act("demo", {}, "Demo connected")}
            >
              <Sun size={17} />
              Try demo system
            </Button>
          )}
        </Panel>
        {data.development && device?.mode === "mock" && (
          <Panel
            title="Demo simulator"
            sub="Development only · no physical equipment is controlled"
          >
            <label>
              Simulation scenario
              <select
                value={
                  data.integrations.find((i) => i.id === device.integrationId)
                    ?.scenario ?? "sunny"
                }
                disabled={busy}
                onChange={(e) =>
                  void act(
                    "simulation",
                    {
                      integrationId: device.integrationId,
                      scenario: e.target.value,
                    },
                    "Simulation updated",
                  )
                }
              >
                {[
                  ["sunny", "Normal sunny day"],
                  ["cloudy", "Cloudy day"],
                  ["night", "Night"],
                  ["battery-low", "Battery low"],
                  ["grid-failure", "Grid failure"],
                  ["offline", "Inverter offline"],
                  ["hot", "High temperature"],
                  ["communication-failure", "Communication failure"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Offline scenarios stop new readings. Their age progresses through
              delayed and offline. High temperature and low battery generate
              alerts; returning to normal resolves them.
            </p>
          </Panel>
        )}
        <Panel
          title="Synchronization activity"
          sub="A dedicated worker collects data; dashboards read the database"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Records</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{new Date(j.startedAt).toLocaleTimeString()}</td>
                    <td>
                      {j.finishedAt
                        ? `${((+new Date(j.finishedAt) - +new Date(j.startedAt)) / 1000).toFixed(1)}s`
                        : "Running"}
                    </td>
                    <td>{j.records}</td>
                    <td>{j.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.jobs.length && (
            <p className="muted">
              No sync attempts yet. Start the background worker to enable
              automatic synchronization.
            </p>
          )}
        </Panel>
      </div>
      <Dialog
        open={!!disconnect}
        onOpenChange={(open) => {
          if (!open) setDisconnect(null);
        }}
        title="Disconnect integration?"
        description="Live synchronization will stop. Historical data stays in your dashboard, and your DESSMonitor account is not deleted."
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDisconnect(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (
                await act(
                  "integrations/disconnect",
                  { integrationId: disconnect, confirmed: true },
                  "Integration disconnected",
                )
              )
                setDisconnect(null);
            }}
          >
            Disconnect
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete your application account?"
        description="This permanently deletes your Solara profile, sessions, integrations, telemetry, alerts and command history. It does not delete your DESSMonitor account."
      >
        <label>
          Type DELETE MY ACCOUNT
          <input
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
          />
        </label>
        {!data.user.isDemo && (
          <label>
            Current password
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </label>
        )}
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || confirmDelete !== "DELETE MY ACCOUNT"}
            onClick={async () => {
              if (
                await act(
                  "account/delete",
                  { confirmation: confirmDelete, password: deletePassword },
                  "",
                )
              )
                router.replace("/login");
            }}
          >
            Delete permanently
          </Button>
        </div>
      </Dialog>
    </>
  );
}
