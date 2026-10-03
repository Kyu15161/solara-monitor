import { z } from "zod";

export const scalar = z.union([z.string(), z.number().finite(), z.boolean()]);
export const parameterSchema = z.object({
  id: z.string(),
  title: z.string(),
  value: scalar.nullable(),
  unit: z.string(),
  category: z.string(),
  timestamp: z.string().datetime(),
});
export const readingSchema = z.object({
  deviceTimestamp: z.string().datetime(),
  receivedAt: z.string().datetime(),
  processedAt: z.string().datetime(),
  pvPowerW: z.number().finite().nonnegative().nullable(),
  loadPowerW: z.number().finite().nonnegative().nullable(),
  batteryPowerW: z.number().finite().nullable(),
  batterySoc: z.number().min(0).max(100).nullable(),
  gridPowerW: z.number().finite().nullable(),
  gridVoltage: z.number().nonnegative().nullable(),
  gridFrequency: z.number().nonnegative().nullable(),
  temperatureC: z.number().finite().nullable(),
  operatingMode: z.string().nullable(),
  suspect: z.boolean().default(false),
  fields: z.array(parameterSchema),
});
export type Reading = z.infer<typeof readingSchema>;
export type Parameter = z.infer<typeof parameterSchema>;
export const controlSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(["number", "select", "toggle", "time"]),
  value: scalar,
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
  highImpact: z.boolean(),
  writable: z.boolean(),
});
export type Control = z.infer<typeof controlSchema>;
export const scenarioSchema = z.enum([
  "sunny",
  "cloudy",
  "night",
  "battery-low",
  "grid-failure",
  "offline",
  "hot",
  "communication-failure",
]);
export type Scenario = z.infer<typeof scenarioSchema>;
export type DeviceRef = {
  sn: string;
  pn: string;
  devcode: number;
  devaddr: number;
  timezone: string;
  state: Record<string, unknown>;
};
export type ProviderAlert = {
  key: string;
  title: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  firstSeen?: string;
  resolvedAt?: string | null;
};
export const energyFlowSchema = z.object({
  pvPowerW: z.number().finite().nonnegative().nullable(),
  loadPowerW: z.number().finite().nonnegative().nullable(),
  batteryPowerW: z.number().finite().nullable(),
  gridPowerW: z.number().finite().nullable(),
});
export interface DessMonitorProvider {
  readonly mode: "mock" | "live";
  authenticate(): Promise<void>;
  getProjects(): Promise<Array<{ id: string; name: string; timezone: string }>>;
  getCollectors(projectId: string): Promise<Array<{ pn: string }>>;
  getDevices(pn: string): Promise<
    Array<{
      sn: string;
      alias: string;
      devcode: number;
      devaddr: number;
      timezone: string;
      model?: string;
    }>
  >;
  getLatestData(device: DeviceRef): Promise<Reading | null>;
  getHistoricalData(
    device: DeviceRef,
    start: Date,
    end: Date,
  ): Promise<Reading[]>;
  getEnergyFlow(
    device: DeviceRef,
  ): Promise<Pick<
    Reading,
    "pvPowerW" | "loadPowerW" | "batteryPowerW" | "gridPowerW"
  > | null>;
  getControlFields(device: DeviceRef): Promise<Control[]>;
  setControlValue(
    device: DeviceRef,
    field: Control,
    value: string | number | boolean,
  ): Promise<{
    accepted: boolean;
    verified: boolean;
    state?: Record<string, string | number | boolean>;
    detail: string;
  }>;
  getAlerts(device: DeviceRef): Promise<ProviderAlert[] | null>;
}
export function validateControl(
  field: Control,
  value: unknown,
  role: string,
  safeMode: boolean,
) {
  if (!["OWNER", "ADMIN"].includes(role))
    throw new Error(
      "Monitoring-only accounts cannot change inverter settings.",
    );
  if (!field.writable)
    throw new Error(
      "This setting cannot be changed with the connected DESSMonitor account.",
    );
  if (field.highImpact && (safeMode || role !== "OWNER"))
    throw new Error(
      "This setting requires the owner to disable Safe Control Mode.",
    );
  if (field.kind === "number") {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < (field.min ?? -Infinity) ||
      value > (field.max ?? Infinity)
    )
      throw new Error("Value is outside the supported range.");
    if (
      field.step &&
      Math.abs(
        (value - (field.min ?? 0)) / field.step -
          Math.round((value - (field.min ?? 0)) / field.step),
      ) > 0.00001
    )
      throw new Error("Value does not match the supported step.");
  }
  if (field.kind === "select" && !field.options?.some((o) => o.value === value))
    throw new Error("Unsupported option.");
  if (field.kind === "toggle" && typeof value !== "boolean")
    throw new Error("Expected on or off.");
  if (
    field.kind === "time" &&
    (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
  )
    throw new Error("Expected a valid time.");
  return scalar.parse(value);
}
export function freshness(
  timestamp: string | Date | null,
  now = Date.now(),
  delayed = 300,
  offline = 900,
) {
  if (!timestamp) return "unavailable";
  const age = (now - new Date(timestamp).getTime()) / 1000;
  return age < -60
    ? "suspect"
    : age < delayed
      ? "online"
      : age < offline
        ? "delayed"
        : "offline";
}
export function formatTemperature(
  value: number | null | undefined,
  unit: string = "C",
) {
  return formatValue(
    value == null ? null : unit === "F" ? (value * 9) / 5 + 32 : value,
    unit === "F" ? "°F" : "°C",
  );
}
export function formatValue(value: number | null | undefined, unit = "W") {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "W" || unit === "Wh")
    return Math.abs(value) >= 1000
      ? `${(value / 1000).toFixed(2)} k${unit}`
      : `${Math.round(value)} ${unit}`;
  return `${Number(value.toFixed(1))}${unit === "%" ? "" : " "}${unit}`;
}
