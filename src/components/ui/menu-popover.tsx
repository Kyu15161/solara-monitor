"use client";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./menu-popover.module.css";

/** A disclosure with ordinary links: Tab navigation, outside dismissal and Escape. */
export function MenuPopover({
  label,
  regionLabel,
  className,
  placement = "below",
  children,
  trigger,
}: {
  label: string;
  regionLabel: string;
  className: string;
  placement?: "above" | "below" | "right";
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className={styles.root}
      data-placement={placement}
      onBlur={(event) => {
        // Some pointer interactions blur a button before the link gains focus.
        // Outside pointer dismissal handles null targets without cancelling clicks.
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className={className}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          className={styles.panel}
          role="region"
          aria-label={regionLabel}
          onClick={(event) => {
            // A Next Link must stay mounted until its navigation is dispatched.
            // Route/device keys reset disclosures once the destination arrives.
            if ((event.target as HTMLElement).closest("button")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
