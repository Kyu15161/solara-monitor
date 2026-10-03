"use client";
import Link from "next/link";
import { BatteryCharging, House, Sun, UtilityPole, Zap } from "lucide-react";
import { formatValue } from "@/lib/domain";
import { Reading } from "./ui/reading";
import styles from "./energy-flow.module.css";

// Dimensional equipment is decorative; battery fill uses the existing SOC only.
function FlowGlyph({ kind, level }: { kind: string; level?: number | null }) {
  return (
    <svg
      className={styles.equipment}
      viewBox="0 0 128 96"
      fill="none"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="66" cy="82" rx="45" ry="9" className={styles.shadow} />
      <path d="M12 72 64 49 116 72 64 96Z" className={styles.platformEdge} />
      <path d="M12 67 64 44 116 67 64 90Z" className={styles.platform} />
      <path
        d="M12 67V72L64 96V90 M64 90 116 67V72"
        className={styles.platformSeam}
      />
      {kind === "flow-solar" && (
        <>
          <path
            d="M37 53V72L47 77V54 M82 42V64L91 69V45"
            className={styles.stand}
          />
          <path d="M25 38 77 15 107 41 55 64Z" className={styles.panelFrame} />
          <path
            d="M25 38V43L55 69 107 46V41L55 64Z"
            className={styles.panelSide}
          />
          <path d="M30 38 77 20 101 41 56 59Z" className={styles.solarGlass} />
          <path
            d="M40 34 66 55 M52 29 78 50 M64 25 90 45 M39 46 86 27 M48 53 94 34"
            className={styles.panelCells}
          />
          <path d="M31 38 78 20" className={styles.highlight} />
          <circle cx="107" cy="15" r="6" className={styles.sun} />
          <path
            d="M107 4V1 M107 29V26 M96 15H93 M121 15H118 M99 7 97 5 M117 25 115 23"
            className={styles.sunRays}
          />
        </>
      )}
      {kind === "flow-home" && (
        <>
          <path d="M28 43 47 17 66 61V83L28 65Z" className={styles.homeFront} />
          <path d="M66 61 101 44V66L66 83Z" className={styles.homeSide} />
          <path d="M47 17 82 0 101 44 66 61Z" className={styles.roofNear} />
          <path d="M28 43 63 26 82 0 47 17Z" className={styles.roofSide} />
          <path d="M28 43 47 17 66 61 101 44" className={styles.roofEdge} />
          <path
            d="M75 61 86 56V74L75 79Z M91 54 97 51V60L91 63Z"
            className={styles.window}
          />
          <path
            d="M36 48 44 52V62L36 58Z M50 55 59 59V70L50 66Z"
            className={styles.windowSide}
          />
          <path d="M82 8 91 12V27L82 23Z" className={styles.chimney} />
          <path d="M79 7 87 3 96 7 88 11Z" className={styles.homeFront} />
          <path d="M68 84 103 67" className={styles.highlight} />
        </>
      )}
      {kind === "flow-battery" && (
        <>
          <path d="M40 24 59 15 87 27 68 36Z" className={styles.caseTop} />
          <path d="M40 24 68 36V83L40 71Z" className={styles.caseFront} />
          <path d="M68 36 87 27V73L68 83Z" className={styles.caseSide} />
          <path d="M51 17V12L65 6 77 11V21L65 27Z" className={styles.caseTop} />
          <path d="M48 36 61 42V70L48 64Z" className={styles.batteryWindow} />
          {level != null && (
            <path
              d="M48 36 61 42V70L48 64Z"
              className={styles.batteryFill}
              style={{ clipPath: `inset(${100 - level}% 0 0)` }}
            />
          )}
          <path
            d="M48 43 61 49 M48 50 61 56 M48 57 61 63"
            className={styles.batteryDividers}
          />
          <path
            d="M73 43 82 39 M73 48 82 44 M73 53 82 49"
            className={styles.caseVent}
          />
          <circle cx="53" cy="31" r="1.8" className={styles.indicator} />
        </>
      )}
      {kind === "flow-grid" && (
        <>
          <path
            d="M65 9 44 74 65 84 84 74 65 9 M44 74 75 58 53 45 70 31 M84 74 54 58 76 45 59 31 M65 84V9 M53 45 76 45 M54 58 75 58"
            className={styles.pylon}
          />
          <path
            d="M36 23 65 9 93 23 65 36Z M25 39 65 21 104 39 65 57Z"
            className={styles.crossarm}
          />
          <path
            d="M36 23V30 M93 23V30 M25 39V46 M104 39V46"
            className={styles.insulator}
          />
          <path
            d="M35 24 13 16 M93 24 118 17 M25 40 8 32 M104 40 124 31"
            className={styles.powerWire}
          />
          <path d="M41 76 47 79 M80 76 86 79" className={styles.caseVent} />
        </>
      )}
      {kind === "flow-inverter" && (
        <>
          <path d="M40 16 59 7 89 20 70 29Z" className={styles.caseTop} />
          <path d="M40 16 70 29V81L40 68Z" className={styles.caseFront} />
          <path d="M70 29 89 20V73L70 81Z" className={styles.caseSide} />
          <path d="M46 27 64 35V54L46 46Z" className={styles.display} />
          <path
            d="M49 39 52 40 55 34 58 46 61 42"
            className={styles.waveform}
          />
          <path
            d="M47 55 63 62 M47 60 63 67 M47 65 63 72 M76 57 84 53 M76 62 84 58 M76 67 84 63"
            className={styles.caseVent}
          />
          <circle cx="55" cy="53" r="1.6" className={styles.indicator} />
          <path d="M48 72V78 M62 78V84" className={styles.stand} />
        </>
      )}
    </svg>
  );
}
export function EnergyFlow({
  pv,
  load,
  battery,
  grid,
  soc,
  active,
  device,
}: {
  pv: number | null;
  load: number | null;
  battery: number | null;
  grid: number | null;
  soc: number | null;
  active: boolean;
  device: string;
}) {
  const node = (
    name: string,
    value: string,
    sub: string,
    Icon: typeof Sun,
    where: string,
    cls: string,
  ) => (
    <Link
      href={`/dashboard/${where}?device=${device}`}
      className={`${styles.node} ${styles[cls]}`}
    >
      <span className={styles.illustration}>
        <FlowGlyph
          kind={cls}
          level={cls === "flow-battery" ? soc : undefined}
        />
      </span>
      <span className={styles.label}>
        <Icon size={10} aria-hidden="true" />
        {name}
      </span>
      <strong>
        <Reading value={value} />
      </strong>
      <small>{sub}</small>
    </Link>
  );
  const line = (d: string, color: string, moving: boolean, reverse = false) => (
    <g>
      <path
        d={d}
        stroke="var(--border)"
        strokeWidth="7"
        fill="none"
        className={styles.track}
      />
      <path
        d={d}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeDasharray="3 13"
        className={active && moving ? `flow-dash ${styles.moving}` : ""}
        style={{
          animationDirection: reverse ? "reverse" : "normal",
          opacity: moving ? 1 : 0.2,
        }}
      />
    </g>
  );
  return (
    <div className={`flow-wrap ${styles.scene}`}>
      <svg
        className={styles.connections}
        viewBox="0 0 600 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {line("M 148 46 H 264", "var(--chart-solar)", pv !== null && pv > 10)}
        {line(
          "M 300 132 V 162 Q 300 174 288 174 H 204 Q 192 174 192 186 V 190",
          "var(--chart-battery)",
          battery !== null && Math.abs(battery) > 10,
          (battery ?? 0) < 0,
        )}
        {line(
          "M 336 46 H 452",
          "var(--chart-load)",
          load !== null && load > 10,
        )}
        {line(
          "M 300 132 V 154 Q 300 166 312 166 H 396 Q 408 166 408 178 V 190",
          "var(--chart-grid)",
          grid !== null && Math.abs(grid) > 10,
          (grid ?? 0) > 0,
        )}
      </svg>
      {node(
        "SOLAR",
        formatValue(pv),
        pv === null ? "Unavailable" : pv > 0 ? "Generating" : "No production",
        Sun,
        "energy",
        "flow-solar",
      )}
      <Link
        href={`/dashboard/inverter?device=${device}`}
        className={styles.inverter}
      >
        <span className={styles.illustration}>
          <FlowGlyph kind="flow-inverter" />
        </span>
        <span className={styles.label}>
          <Zap size={10} aria-hidden="true" />
          INVERTER
        </span>
        <small>Hybrid system</small>
      </Link>
      {node(
        "BATTERY",
        soc === null
          ? formatValue(battery === null ? null : Math.abs(battery))
          : formatValue(soc, "%"),
        battery === null
          ? "Unavailable"
          : battery === 0
            ? "Idle"
            : `${battery > 0 ? "Charging" : "Discharging"}${soc === null ? "" : ` · ${formatValue(Math.abs(battery))}`}`,
        BatteryCharging,
        "battery",
        "flow-battery",
      )}
      {node(
        "HOME",
        formatValue(load),
        "Consumption",
        House,
        "live",
        "flow-home",
      )}
      {node(
        "GRID",
        formatValue(grid === null ? null : Math.abs(grid)),
        grid === null
          ? "Unavailable"
          : grid > 0
            ? "Importing"
            : grid < 0
              ? "Exporting"
              : "Idle",
        UtilityPole,
        "grid",
        "flow-grid",
      )}
    </div>
  );
}
