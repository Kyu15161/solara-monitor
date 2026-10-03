"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { DashboardData } from "@/lib/data";
import type { Control } from "@/lib/domain";
import { Panel, type Action } from "./dashboard";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
export function ControlsPage({
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
  const [pending, setPending] = useState<{
      field: Control;
      value: string | number | boolean;
      id: string;
      at: string;
    } | null>(null),
    [second, setSecond] = useState(false),
    [detail, setDetail] = useState<DashboardData["commands"][number] | null>(
      null,
    );
  const device = data.devices.find((d) => d.id === data.selectedId)!;
  return (
    <>
      <div className="notice safety-notice">
        <ShieldCheck size={22} />
        <div>
          <strong>
            Safe Control Mode is{" "}
            {data.preference?.safeMode !== false ? "on" : "off"}
          </strong>
          <p>
            {device.mode === "mock"
              ? "These controls affect only your simulated inverter."
              : "Live device changes may affect electrical operation."}{" "}
            Every request is recorded and verified where possible.
          </p>
        </div>
      </div>
      <div className="control-grid">
        {data.controls.map((field) => (
          <ControlCard
            key={field.key + JSON.stringify(field.value)}
            field={field}
            disabled={
              busy ||
              data.user.role === "VIEWER" ||
              !device.connected ||
              !field.writable ||
              (field.highImpact &&
                (data.preference?.safeMode !== false ||
                  data.user.role !== "OWNER"))
            }
            onApply={(value) => {
              setSecond(false);
              setPending({
                field,
                value,
                id: crypto.randomUUID(),
                at: new Date().toISOString(),
              });
            }}
          />
        ))}
        {!data.controls.length && (
          <Panel title="No supported controls" sub="Read-only inverter">
            <p>
              Control fields are unavailable through the connected DESSMonitor
              account or inverter protocol.
            </p>
          </Panel>
        )}
      </div>
      <Panel
        title="Command activity"
        sub="Queued → sending → sent → confirming → applied, failed or unknown"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Setting</th>
                <th>Change</th>
                <th>State</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.commands.map((c) => (
                <tr key={c.id}>
                  <td>
                    {formatInTimeZone(
                      c.requestedAt,
                      timezone,
                      "MMM d, HH:mm:ss",
                    )}
                  </td>
                  <td>{c.fieldTitle}</td>
                  <td>
                    {String(c.oldValue)} → {String(c.requestedValue)}
                  </td>
                  <td>
                    <span
                      className={`small-badge ${c.status === "APPLIED" ? "healthy" : c.status === "FAILED" ? "critical" : ""}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetail(c)}
                    >
                      View log
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.commands.length && (
            <p className="chart-empty">No commands have been requested.</p>
          )}
        </div>
      </Panel>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Apply inverter setting?"
        description="Review the device and requested change before submitting."
      >
        {pending && (
          <>
            <dl className="detail-list">
              <div>
                <dt>Device</dt>
                <dd>
                  {device.alias} · {device.sn}
                </dd>
              </div>
              <div>
                <dt>Setting</dt>
                <dd>{pending.field.title}</dd>
              </div>
              <div>
                <dt>Current value</dt>
                <dd>
                  {String(pending.field.value)} {pending.field.unit}
                </dd>
              </div>
              <div>
                <dt>Requested value</dt>
                <dd>
                  {String(pending.value)} {pending.field.unit}
                </dd>
              </div>
              <div>
                <dt>Reviewed at</dt>
                <dd>
                  {formatInTimeZone(pending.at, timezone, "MMM d, HH:mm:ss")}
                </dd>
              </div>
            </dl>
            {pending.field.highImpact && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={second}
                  onChange={(e) => setSecond(e.target.checked)}
                />{" "}
                I understand this setting can affect grid use and system
                operation.
              </label>
            )}
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy || (pending.field.highImpact && !second)}
                onClick={async () => {
                  if (
                    await act(
                      `devices/${device.id}/controls`,
                      {
                        key: pending.field.key,
                        value: pending.value,
                        oldValue: pending.field.value,
                        confirmed: true,
                        highImpactConfirmed: second,
                        idempotencyKey: pending.id,
                      },
                      "Command queued. Waiting for device verification.",
                    )
                  )
                    setPending(null);
                }}
              >
                Confirm & apply
              </Button>
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title="Command verification log"
        description="Acceptance and physical application are distinct states."
      >
        {detail && (
          <>
            <p className="notice">{detail.detail ?? "Waiting for worker."}</p>
            <pre className="raw-data">
              {JSON.stringify(detail.transitions, null, 2)}
            </pre>
            <small>Command ID: {detail.id}</small>
          </>
        )}
      </Dialog>
    </>
  );
}
function ControlCard({
  field,
  disabled,
  onApply,
}: {
  field: Control;
  disabled: boolean;
  onApply: (value: string | number | boolean) => void;
}) {
  const [value, setValue] = useState(field.value);
  return (
    <Panel
      className={`hardware-setting ${field.highImpact ? "high-impact" : ""}`}
      title={field.title}
      sub={
        field.highImpact
          ? "Owner · high-impact setting"
          : "Supported inverter setting"
      }
    >
      <p className="control-description">{field.description}</p>
      <label className="control-input">
        Requested value
        {field.kind === "select" ? (
          <select
            disabled={disabled}
            value={String(value)}
            onChange={(e) => setValue(e.target.value)}
          >
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : field.kind === "toggle" ? (
          <select
            disabled={disabled}
            value={String(value)}
            onChange={(e) => setValue(e.target.value === "true")}
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        ) : (
          <input
            disabled={disabled}
            type={field.kind === "time" ? "time" : "number"}
            min={field.min}
            max={field.max}
            step={field.step}
            value={String(value)}
            onChange={(e) =>
              setValue(
                field.kind === "number"
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}
      </label>
      <div className="control-footer">
        <small>
          Current:{" "}
          <b>
            {String(field.value)} {field.unit}
          </b>
          {field.min !== undefined && (
            <>
              {" "}
              · {field.min}–{field.max} {field.unit}
            </>
          )}
        </small>
        <Button
          size="sm"
          disabled={disabled || value === field.value}
          onClick={() => onApply(value)}
        >
          Review change
        </Button>
      </div>
      {disabled && (
        <p className="chart-caption">
          {!field.writable
            ? "Unavailable: unsupported or not authorized for this account."
            : field.highImpact
              ? "Disabled by Safe Control Mode or account permissions."
              : "Read-only, disconnected, or processing another request."}
        </p>
      )}
    </Panel>
  );
}
