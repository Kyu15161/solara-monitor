import {
  readingSchema,
  type Control,
  type DessMonitorProvider,
  type DeviceRef,
  type ProviderAlert,
  type Reading,
  type Scenario,
} from "../domain";

export function simulateReading(
  at: Date,
  scenario: Scenario = "sunny",
  state: Record<string, unknown> = {},
  historical = false,
): Reading {
  const t = at.getTime();
  // Demo scenario uses a labeled daytime simulation; history follows the actual Baghdad solar day.
  const hour = historical
    ? ((at.getUTCHours() + 3) % 24) + at.getUTCMinutes() / 60
    : scenario === "night"
      ? 23
      : 11.7 + Math.sin(t / 600000) * 0.8;
  const sun = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const weather = historical
    ? 0.67 + 0.22 * Math.sin(Math.floor(t / 86400000) * 1.7) ** 2
    : scenario === "cloudy"
      ? 0.28
      : 0.79;
  const pv = Math.round(
    7800 * sun * weather * (0.94 + 0.06 * Math.sin(t / 180000)),
  );
  let load = Math.round(
    1100 +
      500 * Math.sin(t / 390000) ** 2 +
      (hour > 17 && hour < 22 ? 1500 : 400),
  );
  const soc =
    scenario === "battery-low"
      ? 16
      : Math.round(
          48 +
            32 * Math.sin(((hour - 7) / 24) * Math.PI) +
            2 * Math.sin(t / 600000),
        );
  const volts = 49.5 + soc * 0.032;
  const maxCharge =
    (typeof state.chargeCurrent === "number" ? state.chargeCurrent : 40) *
    volts;
  let battery =
    pv > load
      ? Math.min(maxCharge, (pv - load) * 0.7)
      : soc > 20
        ? -Math.min(1000, load - pv)
        : 0;
  if (state.gridCharge === true && soc < 80) battery = maxCharge;
  if (state.mode === "battery-first" && soc > 25 && pv < load)
    battery = -(load - pv);
  battery = Math.round(battery);
  let grid = load + battery - pv; // Positive import, negative export. Battery positive charge.
  if (scenario === "grid-failure") {
    grid = 0;
    if (pv > load) battery = Math.min(maxCharge, pv - load);
    else {
      load = Math.min(load, pv + 1500);
      battery = pv - load;
    }
  }
  const actualPv = scenario === "grid-failure" ? load + battery : pv;
  const temperature = scenario === "hot" ? 72.4 : 31 + actualPv / 450;
  const timestamp = at.toISOString();
  const field = (
    id: string,
    title: string,
    value: number | string | boolean,
    unit: string,
    category: string,
  ) => ({ id, title, value, unit, category, timestamp });
  return readingSchema.parse({
    deviceTimestamp: timestamp,
    receivedAt: new Date(t + 200).toISOString(),
    processedAt: new Date(t + 350).toISOString(),
    pvPowerW: actualPv,
    loadPowerW: load,
    batteryPowerW: battery,
    batterySoc: soc,
    gridPowerW: grid,
    gridVoltage:
      scenario === "grid-failure" ? 0 : 229.5 + 2 * Math.sin(t / 90000),
    gridFrequency:
      scenario === "grid-failure" ? 0 : 50 + 0.03 * Math.sin(t / 45000),
    temperatureC: temperature,
    operatingMode: String(state.mode ?? "self-use"),
    fields: [
      field("pv1", "PV1 input power", actualPv * 0.52, "W", "Solar"),
      field("pv2", "PV2 input power", actualPv * 0.48, "W", "Solar"),
      field("pv1-voltage", "PV1 voltage", sun ? 348 : 0, "V", "Solar"),
      field(
        "pv1-current",
        "PV1 current",
        sun ? (actualPv * 0.52) / 348 : 0,
        "A",
        "Solar",
      ),
      field("battery-voltage", "Battery voltage", volts, "V", "Battery"),
      field(
        "battery-current",
        "Battery current",
        battery / volts,
        "A",
        "Battery",
      ),
      field("battery-temp", "Battery temperature", 29.4, "°C", "Battery"),
      field("ac-output", "AC output power", load, "W", "AC Output"),
      field(
        "chargeCurrent",
        "Charge current limit",
        Number(state.chargeCurrent ?? 40),
        "A",
        "System",
      ),
      field(
        "gridCharge",
        "Grid charging enabled",
        state.gridCharge === true,
        "",
        "System",
      ),
      field("protocol", "Protocol", "DEMO-HYBRID-V1", "", "Other"),
    ],
  });
}
export class MockDessMonitorProvider implements DessMonitorProvider {
  readonly mode = "mock" as const;
  constructor(
    private scenario: Scenario = "sunny",
    private now: () => Date = () => new Date(),
  ) {}
  async authenticate() {}
  async getProjects() {
    return [
      {
        id: "demo-home",
        name: "Sulaimani Solar Home",
        timezone: "Asia/Baghdad",
      },
    ];
  }
  async getCollectors() {
    return [{ pn: "DEMO-COLLECTOR-001" }];
  }
  async getDevices() {
    return [
      {
        sn: "DEMO-INVERTER-001",
        alias: "Hybrid Inverter 01",
        devcode: 8000,
        devaddr: 1,
        timezone: "Asia/Baghdad",
        model: "Demo Hybrid 8K",
      },
    ];
  }
  async getLatestData(device: DeviceRef) {
    if (this.scenario === "communication-failure")
      throw new Error(
        "Simulated communication failure. Cached readings remain available.",
      );
    if (this.scenario === "offline") return null;
    return simulateReading(this.now(), this.scenario, device.state);
  }
  async getHistoricalData(device: DeviceRef, start: Date, end: Date) {
    const result: Reading[] = [];
    for (
      let t = start.getTime();
      t <= Math.min(end.getTime(), this.now().getTime());
      t += 900000
    )
      result.push(simulateReading(new Date(t), "sunny", device.state, true));
    return result;
  }
  async getEnergyFlow(device: DeviceRef) {
    return this.getLatestData(device);
  }
  async getControlFields(device: DeviceRef): Promise<Control[]> {
    return [
      {
        key: "chargeCurrent",
        title: "Maximum charge current",
        description: "Limits the simulated battery charging current.",
        kind: "number",
        value: Number(device.state.chargeCurrent ?? 40),
        min: 10,
        max: 80,
        step: 5,
        unit: "A",
        highImpact: false,
        writable: true,
      },
      {
        key: "mode",
        title: "Operating mode",
        description: "Choose how the simulated inverter uses available energy.",
        kind: "select",
        value: String(device.state.mode ?? "self-use"),
        options: [
          { label: "Self consumption", value: "self-use" },
          { label: "Battery priority", value: "battery-first" },
        ],
        unit: "",
        highImpact: false,
        writable: true,
      },
      {
        key: "gridCharge",
        title: "Allow grid charging",
        description:
          "Can increase grid imports. Requires Safe Control Mode to be off.",
        kind: "toggle",
        value: device.state.gridCharge === true,
        unit: "",
        highImpact: true,
        writable: true,
      },
    ];
  }
  async setControlValue(
    device: DeviceRef,
    field: Control,
    value: string | number | boolean,
  ) {
    if (
      this.scenario === "offline" ||
      this.scenario === "communication-failure"
    ) {
      throw new Error(
        "Simulated device is unreachable. The setting was not changed.",
      );
    }
    return {
      accepted: true,
      verified: false,
      state: { [field.key]: value },
      detail:
        "Mock inverter accepted the command. Awaiting a separate settings read-back.",
    };
  }
  async getAlerts(): Promise<ProviderAlert[]> {
    const alerts: ProviderAlert[] = [
      {
        key: "demo-inspection",
        title: "Scheduled system inspection",
        description:
          "Simulated maintenance reminder. Inspect panel connections at the next service.",
        severity: "INFO",
      },
      {
        key: "demo-battery-service",
        title: "Battery service reminder",
        description:
          "Simulated BMS service notice. Monitoring and charging remain available.",
        severity: "WARNING",
      },
    ];
    if (this.scenario === "hot")
      alerts.push({
        key: "temperature",
        title: "Inverter temperature high",
        description: "Simulated heatsink temperature exceeds 65 °C.",
        severity: "CRITICAL",
      });
    if (this.scenario === "battery-low")
      alerts.push({
        key: "battery-low",
        title: "Battery reserve low",
        description: "Simulated state of charge is below 20%.",
        severity: "WARNING",
      });
    if (this.scenario === "grid-failure")
      alerts.push({
        key: "grid-lost",
        title: "Grid connection lost",
        description: "Simulated inverter is supplying the load in island mode.",
        severity: "CRITICAL",
      });
    return alerts;
  }
}
