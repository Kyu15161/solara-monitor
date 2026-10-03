import "server-only";
import { z } from "zod";
import { decrypt } from "../security/crypto";
import {
  scenarioSchema,
  type DeviceRef,
  type DessMonitorProvider,
} from "../domain";
import { MockDessMonitorProvider } from "./mock";
import { LiveDessMonitorProvider } from "./live";
export const credentialsSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  companyKey: z.string().min(1).max(200),
});
export function providerFor(integration: {
  mode: string;
  scenario: string;
  encryptedCredentials: string | null;
}): DessMonitorProvider {
  if (integration.mode === "mock")
    return new MockDessMonitorProvider(
      scenarioSchema.parse(integration.scenario),
    );
  if (!integration.encryptedCredentials)
    throw new Error("DESSMonitor credentials are not configured.");
  return new LiveDessMonitorProvider(
    credentialsSchema.parse(decrypt(integration.encryptedCredentials)),
  );
}
export function deviceRef(device: {
  sn: string;
  devcode: number;
  devaddr: number;
  timezone: string;
  mockState: unknown;
  collector: { pn: string };
}): DeviceRef {
  return {
    sn: device.sn,
    pn: device.collector.pn,
    devcode: device.devcode,
    devaddr: device.devaddr,
    timezone: device.timezone,
    state: z.record(z.string(), z.unknown()).parse(device.mockState),
  };
}
