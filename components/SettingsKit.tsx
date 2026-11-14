"use client";

import Link from "next/link";
import React, { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

const pad = "px-4 py-3.5 sm:px-5";
const pill = "rounded-full";

/* --------------------------------- layout ---------------------------------- */

/** A heading + a rounded card whose children are separated by hairlines. */
export function Group({
  title,
  description,
  id,
  children,
}: {
  title?: string;
  description?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      {(title || description) && (
        <div className="mb-3 px-1">
          {title && <h3 className="text-base font-medium">{title}</h3>}
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

/** Label + hint on the left, control on the right. `stack` puts the control underneath. */
export function Row({
  label,
  hint,
  stack,
  children,
}: {
  label: string;
  hint?: string;
  stack?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        pad,
        stack
          ? "flex flex-col gap-3"
          : "flex items-center justify-between gap-4",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children && (
        <div className={stack ? "w-full" : "shrink-0"}>{children}</div>
      )}
    </div>
  );
}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </Row>
  );
}

/** A whole row that navigates. No `href` and no `onClick` renders it disabled. */
export function LinkRow({
  label,
  hint,
  value,
  href,
  external,
  onClick,
}: {
  label: string;
  hint?: string;
  value?: React.ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const cls = cn(
    "flex w-full items-center gap-4 text-left transition-colors hover:bg-muted",
    pad,
  );
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      {value != null && (
        <span className="text-sm text-muted-foreground">{value}</span>
      )}
      <Icon
        name={external ? "external" : "chevron"}
        size={16}
        className="shrink-0 text-muted-foreground"
      />
    </>
  );

  if (href && external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        cls,
        !onClick && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      {body}
    </button>
  );
}

/* --------------------------------- controls -------------------------------- */

export function Textarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        props.className,
      )}
    />
  );
}

function useFlash(ms = 1800) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = () => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  };
  return [on, flash] as const;
}

/** Pill button that briefly says "Done" after it runs. */
export function ActionButton({
  label,
  doneLabel = "Done",
  onClick,
}: {
  label: string;
  doneLabel?: string;
  onClick?: () => void;
}) {
  const [done, flash] = useFlash();
  return (
    <Button
      variant="secondary"
      size="sm"
      className={pill}
      disabled={done}
      onClick={() => {
        onClick?.();
        flash();
      }}
    >
      {done ? doneLabel : label}
    </Button>
  );
}

/** Two-step button for destructive actions: Delete → Cancel / Confirm. */
export function ConfirmButton({
  label,
  confirmLabel = "Yes, continue",
  doneLabel = "Done",
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  doneLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [done, flash] = useFlash();

  if (confirming) {
    return (
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className={pill}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className={pill}
          onClick={() => {
            onConfirm();
            setConfirming(false);
            flash();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className={pill}
      disabled={disabled || done}
      onClick={() => setConfirming(true)}
    >
      {done ? doneLabel : label}
    </Button>
  );
}

/** Shows a value with a pencil; click to edit in place. Enter saves, Escape cancels. */
export function EditRow({
  label,
  value,
  onSave,
  hint,
  type = "text",
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  hint?: string;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <Row label={label} hint={hint}>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="max-w-[14rem] truncate sm:max-w-[18rem]">
            {value || "Not set"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Edit ${label}`}
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <Icon name="pencil" size={14} />
          </Button>
        </div>
      </Row>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-3", pad)}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim());
        setEditing(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
    >
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <Textarea
          id={id}
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          autoFocus
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={pill}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" className={pill}>
          Save
        </Button>
      </div>
    </form>
  );
}
