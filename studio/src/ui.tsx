import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { Clipboard, Collapsible, createListCollection, Dialog, Field as ArkField, Portal, SegmentGroup, Select, Tooltip } from "@ark-ui/react";
import { IconCheck, IconCopy, IconSelector } from "@tabler/icons-react";
import { bytes } from "./format";

// Studio's controls are Ark UI components (unstyled, accessible) wearing Studio's styles from App.css.

/** Runs `fn` now and then every `ms`, skipping ticks while the tab is hidden and catching up when it returns. */
export function usePoll(fn: () => void | Promise<void>, ms: number, deps: unknown[]) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void latest.current();
    };
    tick();
    const timer = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}

/** The current time, refreshed every second while `active`. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export type Tone = "running" | "waiting" | "ok" | "error" | "muted";

const TONES: Record<string, Tone> = {
  running: "running",
  waiting: "waiting",
  paused: "waiting",
  completed: "ok",
  done: "ok",
  halted: "muted",
  failed: "error",
  error: "error",
  unfinished: "muted",
};

export const toneOf = (status: string): Tone => TONES[status] ?? "muted";

export function StatusDot({ status }: { status: string }) {
  return <span className={`dot ${toneOf(status)}`} aria-hidden="true" />;
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`pill ${toneOf(status)}`}>
      <StatusDot status={status} />
      {label ?? status}
    </span>
  );
}

/** A short label that appears when its child is hovered or focused. */
export function Tip({ label, children }: { label: ReactNode; children: ReactElement }) {
  return (
    <Tooltip.Root openDelay={350} closeDelay={0} positioning={{ placement: "top", gutter: 6 }} lazyMount unmountOnExit>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content className="tip">{label}</Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}

/** Copies text and says so on the button for a moment. */
export function CopyButton({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const trigger = (
    <Clipboard.Trigger className={`btn ghost small ${className}`} aria-label={label ? undefined : "Copy"}>
      <Clipboard.Indicator copied={<IconCheck size={14} stroke={2} />}>
        <IconCopy size={14} stroke={1.75} />
      </Clipboard.Indicator>
      {label && (
        <Clipboard.Indicator copied="Copied" asChild>
          <span>{label}</span>
        </Clipboard.Indicator>
      )}
    </Clipboard.Trigger>
  );
  return (
    <Clipboard.Root value={text} timeout={1400} className="clip">
      {label ? trigger : <Tip label="Copy">{trigger}</Tip>}
    </Clipboard.Root>
  );
}

export const asText = (value: unknown) => (typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? String(value)));

const FOLD_CHARS = 1400;
const FOLD_LINES = 18;

/** A prompt, an answer, or any other value: text as text, everything else as JSON. Long ones start folded. */
export function Value({ value, empty = "Nothing recorded" }: { value: unknown; empty?: string }) {
  const [open, setOpen] = useState(false);
  if (value === null || value === undefined || value === "") return <p className="value-empty">{empty}</p>;
  const text = asText(value);
  const long = text.length > FOLD_CHARS || text.split("\n", FOLD_LINES + 1).length > FOLD_LINES;
  if (!long) {
    return (
      <div className="value">
        <pre>{text}</pre>
      </div>
    );
  }
  return (
    <Collapsible.Root className="value" open={open} onOpenChange={(d) => setOpen(d.open)} collapsedHeight="232px">
      <Collapsible.Content className="value-fold">
        {/* A folded value only needs enough text to fill the box. */}
        <pre>{open ? text : text.slice(0, FOLD_CHARS * 2)}</pre>
      </Collapsible.Content>
      <Collapsible.Trigger className="value-more">{open ? "Show less" : `Show all (${bytes(text.length)})`}</Collapsible.Trigger>
    </Collapsible.Root>
  );
}

/** A titled value with a copy button. */
export function Field({ title, value, note, empty }: { title: string; value: unknown; note?: ReactNode; empty?: string }) {
  const has = value !== null && value !== undefined && value !== "";
  return (
    <section className="field">
      <header>
        <h4>{title}</h4>
        {note && <span className="field-note">{note}</span>}
        {has && <CopyButton text={asText(value)} />}
      </header>
      <Value value={value} empty={empty} />
    </section>
  );
}

/** A labelled text input, with a note beside the label and the reason it is wrong, when it is. */
export function TextField({
  label,
  note,
  problem,
  value,
  onChange,
  multiline,
  ...input
}: {
  label: ReactNode;
  note?: ReactNode;
  problem?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text";
  autoFocus?: boolean;
}) {
  return (
    <ArkField.Root className="form-field" invalid={!!problem}>
      <span className="label">
        <ArkField.Label>{label}</ArkField.Label>
        {note && <span className="type">{note}</span>}
        <ArkField.ErrorText className="problem">{problem}</ArkField.ErrorText>
      </span>
      {multiline ? (
        <ArkField.Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...input} />
      ) : (
        <ArkField.Input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoComplete="off" {...input} />
      )}
    </ArkField.Root>
  );
}

export interface Option {
  value: string;
  label: string;
}

/** A dropdown to pick one of a few options. */
export function Picker({ label, hideLabel, options, value, onChange, placeholder, disabled, small }: { label: string; hideLabel?: boolean; options: Option[]; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; small?: boolean }) {
  const collection = useMemo(() => createListCollection({ items: options }), [options]);
  return (
    <Select.Root className={`picker ${small ? "small" : ""}`} collection={collection} value={value ? [value] : []} onValueChange={(d) => onChange(d.value[0] ?? "")} positioning={{ sameWidth: true, gutter: 4 }} disabled={disabled} lazyMount unmountOnExit>
      <Select.Label className={hideLabel ? "sr-only" : "label"}>{label}</Select.Label>
      <Select.Control>
        <Select.Trigger className="picker-trigger">
          <Select.ValueText placeholder={placeholder ?? label} />
          <Select.Indicator>
            <IconSelector size={14} stroke={1.75} />
          </Select.Indicator>
        </Select.Trigger>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content className="menu">
            {collection.items.map((item) => (
              <Select.Item key={item.value} item={item} className="menu-item">
                <Select.ItemText>{item.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <IconCheck size={14} stroke={2} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
      <Select.HiddenSelect />
    </Select.Root>
  );
}

/** A row of choices where one is on. */
export function Segments({ label, options, value, onChange, small }: { label: string; options: Array<Option & { count?: number }>; value: string; onChange: (value: string) => void; small?: boolean }) {
  return (
    <SegmentGroup.Root className={`seg ${small ? "small" : ""}`} value={value} onValueChange={(d) => d.value && onChange(d.value)} aria-label={label}>
      <SegmentGroup.Indicator className="seg-thumb" />
      {options.map((o) => (
        <SegmentGroup.Item key={o.value} value={o.value} className="seg-item">
          <SegmentGroup.ItemText>
            {o.label}
            {o.count ? <span className="n">{o.count}</span> : null}
          </SegmentGroup.ItemText>
          <SegmentGroup.ItemControl />
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}

/** A dialog that asks before something that can't be taken back. */
export function ConfirmDialog({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions: ReactNode }) {
  // The title often names the thing being confirmed, which is cleared on close; keep it while the dialog fades out.
  const shown = useRef(title);
  if (open) shown.current = title;
  return (
    <Dialog.Root open={open} onOpenChange={(d) => !d.open && onClose()} role="alertdialog" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop className="backdrop" />
        <Dialog.Positioner className="dialog-place">
          <Dialog.Content className="dialog">
            <div className="dialog-body">
              <Dialog.Title>{shown.current}</Dialog.Title>
              <Dialog.Description asChild>
                <div className="dialog-text">{children}</div>
              </Dialog.Description>
            </div>
            <div className="dialog-actions">{actions}</div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/** Up and Down move through a list's rows (anything marked data-row) and open the one landed on. */
export function rowKeys(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-row]")];
  const i = rows.indexOf(document.activeElement as HTMLElement);
  if (i === -1) return;
  const next = rows[i + (e.key === "ArrowDown" ? 1 : -1)];
  e.preventDefault();
  if (!next) return;
  next.focus();
  next.click();
}

export function HaloMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="11" rx="11" ry="4.2" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="16" cy="21.5" r="5.5" fill="var(--brand)" />
    </svg>
  );
}
