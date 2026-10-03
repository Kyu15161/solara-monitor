import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { readingSchema } from "../domain";
export const rawFieldSchema = z.object({
  title: z.string(),
  unit: z.string().optional(),
  val: z.union([z.string(), z.number().finite(), z.null()]),
});
export function numeric(
  value: unknown,
  unit: string,
  target: string,
): number | null {
  if (value === null || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor: Record<string, number> = {
    "W:W": 1,
    "kW:W": 1000,
    "Wh:Wh": 1,
    "kWh:Wh": 1000,
    "V:V": 1,
    "A:A": 1,
    "Hz:Hz": 1,
    "°C:°C": 1,
    "%:%": 1,
  };
  const scale = factor[`${unit}:${target}`];
  return scale === undefined ? null : n * scale;
}
export function normalizeLatest(
  raw: unknown,
  timezone: string,
  receivedAt = new Date(),
) {
  const fields = z.array(rawFieldSchema).min(2).parse(raw);
  const stamp = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .parse(fields[1].val);
  const date = fromZonedTime(stamp, timezone);
  if (!Number.isFinite(+date)) throw new Error("Invalid device timestamp.");
  const timestamp = date.toISOString();
  const pick = (title: string, unit: string) => {
    const item = fields.find((f) => f.title.toLowerCase() === title);
    return item ? numeric(item.val, item.unit ?? "", unit) : null;
  };
  const channels = fields.filter((f) => /^pv\d+ input power$/i.test(f.title));
  const powers = channels.map((f) => numeric(f.val, f.unit ?? "", "W"));
  const pv =
    powers.length && powers.every((v) => v !== null)
      ? powers.reduce<number>((sum, v) => sum + (v ?? 0), 0)
      : null;
  const soc = pick("battery soc", "%");
  const temperature = pick("heat sink temperature", "°C");
  const suspect =
    +date > +receivedAt + 60000 ||
    (soc !== null && (soc < 0 || soc > 100)) ||
    (pv !== null && pv < 0);
  return readingSchema.parse({
    deviceTimestamp: timestamp,
    receivedAt: receivedAt.toISOString(),
    processedAt: new Date().toISOString(),
    pvPowerW: pv !== null && pv >= 0 ? pv : null,
    loadPowerW: pick("load active power", "W"),
    batteryPowerW: null,
    batterySoc: soc !== null && soc >= 0 && soc <= 100 ? soc : null,
    gridPowerW: null,
    gridVoltage: pick("r-phase grid voltage", "V"),
    gridFrequency: pick("grid frequency", "Hz"),
    temperatureC: temperature,
    operatingMode:
      fields
        .find((f) => /^inverter working mode$/i.test(f.title))
        ?.val?.toString() ?? null,
    suspect,
    fields: fields.slice(2).map((f, i) => ({
      id: `raw-${i + 2}`,
      title: f.title,
      value: f.val,
      unit: f.unit ?? "",
      category: /^pv/i.test(f.title)
        ? "Solar"
        : /battery/i.test(f.title)
          ? "Battery"
          : /grid/i.test(f.title)
            ? "Grid"
            : /temperature/i.test(f.title)
              ? "Temperature"
              : "Other",
      timestamp,
    })),
  });
}
