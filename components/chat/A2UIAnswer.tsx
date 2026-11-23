"use client";

import { useEffect, useRef, useState } from "react";
import {
  A2uiSurface,
  createComponentImplementation,
  type ReactA2uiComponentProps,
  type ReactComponentImplementation,
} from "@a2ui/react";
import { Catalog, MessageProcessor } from "@a2ui/web_core";
import type {
  ActionPayload,
  FunctionImplementation,
  SurfaceModel,
} from "@a2ui/web_core";
import { BASIC_FUNCTIONS } from "@a2ui/web_core/catalogs/basic/v1";
import { cn } from "@/lib/utils";
import {
  createSandoOpenUrl,
  loadSandoCatalog,
  parseA2UIMessage,
  SANDO_CATALOG_ID,
} from "@/lib/chat/a2ui";

/* ------------------------------------------------------------------ */
/* Monochrome components                                               */
/*                                                                     */
/* Sando implements its own components: no basic-catalog styling, no   */
/* injected theme, only black, white, neutral-*, and currentColor.     */
/* Text renders as plain text (the basic Text supports simple Markdown; */
/* Sando's chat bubbles are plain text too, so nothing is lost here).  */
/*                                                                     */
/* The binder hands each view resolved props: dynamic values are their */
/* concrete values, `action` props are ready-to-call closures, child   */
/* lists are ids (or { id, basePath } for templates), and dynamic      */
/* props also get `setX` setters that write back to the data model.    */
/* ------------------------------------------------------------------ */

interface TextProps {
  text: string;
  variant?: "caption" | "body";
}

function TextView({ props }: ReactA2uiComponentProps<TextProps>) {
  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words leading-relaxed",
        props.variant === "caption"
          ? "text-xs text-neutral-400"
          : "text-sm text-neutral-100",
      )}
    >
      {props.text}
    </p>
  );
}

interface ButtonProps {
  child: string;
  variant?: "default" | "primary" | "borderless";
  action?: (options?: { metadata?: unknown }) => Promise<void>;
}

function ButtonView({
  props,
  buildChild,
}: ReactA2uiComponentProps<ButtonProps>) {
  return (
    <button
      type="button"
      onClick={() => void props.action?.()}
      className={cn(
        "inline-flex min-w-0 items-center justify-center rounded-xl px-3.5 py-2 text-sm transition-colors",
        props.variant === "primary" &&
          "bg-white font-medium text-black hover:bg-neutral-200",
        props.variant === "borderless" &&
          "px-1 py-1 text-neutral-200 underline decoration-white/30 underline-offset-4 hover:text-white",
        (props.variant === "default" || !props.variant) &&
          "border border-white/15 bg-white/[0.06] text-neutral-100 hover:bg-white/[0.12]",
      )}
    >
      {buildChild(props.child)}
    </button>
  );
}

interface CardProps {
  child: string;
}

function CardView({ props, buildChild }: ReactA2uiComponentProps<CardProps>) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
      {buildChild(props.child)}
    </div>
  );
}

type ChildRef = string | { id: string; basePath: string };

function renderChildren(
  children: ChildRef[] | undefined,
  buildChild: (id: string, basePath?: string) => React.ReactNode,
) {
  return (children ?? []).map((child) =>
    typeof child === "string" ? (
      <span key={child} className="contents">
        {buildChild(child)}
      </span>
    ) : (
      <span key={`${child.id}:${child.basePath}`} className="contents">
        {buildChild(child.id, child.basePath)}
      </span>
    ),
  );
}

const JUSTIFY: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  spaceBetween: "justify-between",
  spaceAround: "justify-around",
  spaceEvenly: "justify-evenly",
  stretch: "justify-stretch",
};

const ALIGN: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

interface LayoutProps {
  children?: ChildRef[];
  justify?: string;
  align?: string;
  weight?: number;
}

function ColumnView({
  props,
  buildChild,
}: ReactA2uiComponentProps<LayoutProps>) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        JUSTIFY[props.justify ?? "start"],
        ALIGN[props.align ?? "stretch"],
      )}
      style={props.weight ? { flexGrow: props.weight } : undefined}
    >
      {renderChildren(props.children, buildChild)}
    </div>
  );
}

function RowView({ props, buildChild }: ReactA2uiComponentProps<LayoutProps>) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-row flex-wrap gap-2",
        JUSTIFY[props.justify ?? "start"],
        ALIGN[props.align ?? "stretch"],
      )}
      style={props.weight ? { flexGrow: props.weight } : undefined}
    >
      {renderChildren(props.children, buildChild)}
    </div>
  );
}

interface ListProps {
  children?: ChildRef[];
  direction?: "vertical" | "horizontal";
  align?: string;
}

function ListView({ props, buildChild }: ReactA2uiComponentProps<ListProps>) {
  return (
    <div
      className={cn(
        "flex min-w-0 gap-2",
        props.direction === "horizontal" ? "flex-row flex-wrap" : "flex-col",
        ALIGN[props.align ?? "stretch"],
      )}
    >
      {renderChildren(props.children, buildChild)}
    </div>
  );
}

interface DividerProps {
  axis?: "horizontal" | "vertical";
}

function DividerView({ props }: ReactA2uiComponentProps<DividerProps>) {
  return props.axis === "vertical" ? (
    <div aria-hidden className="w-px self-stretch bg-white/10" />
  ) : (
    <hr aria-hidden className="border-t border-white/10" />
  );
}

interface TextFieldProps {
  label: string;
  value?: string;
  setValue?: (value: string) => void;
  placeholder?: string;
  variant?: "longText" | "number" | "shortText" | "obscured";
  validationErrors?: string[];
}

function TextFieldView({ props }: ReactA2uiComponentProps<TextFieldProps>) {
  const value = typeof props.value === "string" ? props.value : "";
  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => props.setValue?.(e.target.value);
  const inputClass =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white/40 focus:outline-none";
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-neutral-400">
        {props.label}
      </span>
      {props.variant === "longText" ? (
        <textarea
          value={value}
          placeholder={props.placeholder}
          onChange={onChange}
          rows={3}
          className={cn(inputClass, "resize-y")}
        />
      ) : (
        <input
          type={
            props.variant === "number"
              ? "number"
              : props.variant === "obscured"
                ? "password"
                : "text"
          }
          value={value}
          placeholder={props.placeholder}
          onChange={onChange}
          className={inputClass}
        />
      )}
      {props.validationErrors?.length ? (
        <span role="alert" className="mt-1 block text-xs text-neutral-300">
          {props.validationErrors[0]}
        </span>
      ) : null}
    </label>
  );
}

interface ChoicePickerProps {
  label?: string;
  variant?: "multipleSelection" | "mutuallyExclusive";
  options: { label: string; value: string }[];
  /** Always an array, even in mutuallyExclusive mode. */
  value?: string[];
  setValue?: (value: string[]) => void;
  displayStyle?: "checkbox" | "chips";
}

function ChoicePickerView({
  props,
}: ReactA2uiComponentProps<ChoicePickerProps>) {
  const selected = Array.isArray(props.value) ? props.value : [];
  const toggle = (value: string) => {
    const next =
      props.variant === "multipleSelection"
        ? selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value]
        : selected.includes(value)
          ? []
          : [value];
    props.setValue?.(next);
  };
  return (
    <fieldset className="min-w-0">
      {props.label ? (
        <legend className="mb-1.5 text-xs text-neutral-400">
          {props.label}
        </legend>
      ) : null}
      <div
        className={cn(
          "flex gap-2",
          props.displayStyle === "chips"
            ? "flex-row flex-wrap"
            : "flex-col items-start",
        )}
      >
        {props.options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role={
                props.variant === "multipleSelection" ? "checkbox" : "radio"
              }
              aria-checked={active}
              onClick={() => toggle(option.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-white bg-white font-medium text-black"
                  : "border-white/15 text-neutral-200 hover:bg-white/[0.07] hover:text-white",
              )}
            >
              {props.displayStyle !== "chips" && (
                <span
                  aria-hidden
                  className={cn(
                    "grid size-3.5 place-items-center rounded-full border",
                    active ? "border-black" : "border-neutral-400",
                  )}
                >
                  {active && <span className="size-1.5 rounded-full bg-black" />}
                </span>
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Processor                                                           */
/*                                                                     */
/* The processor gets ONLY the Sando catalog: the nine components from */
/* `catalog.json`, each rendered by the monochrome views above, and    */
/* the standard functions with Sando's own openUrl (http/https only).  */
/*                                                                     */
/* Actions: an event with a `userMessage` is a follow-up prompt in the */
/* user's own words. Any other event is sent back as a JSON action     */
/* envelope the backend answers in the next turn; its `context` values */
/* pass through unchanged, so a ChoicePicker selection arrives as the  */
/* array it is. `openUrl` never reaches here — it runs locally.        */
/* ------------------------------------------------------------------ */

// The A2UI processor types component views with `any` props; the `any`
// here is the library's own type, not ours.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponentView = React.FC<ReactA2uiComponentProps<any>>;

function buildProcessor(
  onFollowUp: (prompt: string) => void,
): MessageProcessor<ReactComponentImplementation> {
  const schemaCatalog = loadSandoCatalog();
  const views: Record<string, AnyComponentView> = {
    Text: TextView as AnyComponentView,
    Button: ButtonView as AnyComponentView,
    Card: CardView as AnyComponentView,
    Column: ColumnView as AnyComponentView,
    Row: RowView as AnyComponentView,
    List: ListView as AnyComponentView,
    Divider: DividerView as AnyComponentView,
    TextField: TextFieldView as AnyComponentView,
    ChoicePicker: ChoicePickerView as AnyComponentView,
  };
  const components = [...schemaCatalog.components.values()].map((api) => {
    const view = views[api.name];
    if (!view) throw new Error(`No Sando view for catalog component ${api.name}`);
    return createComponentImplementation(api, view);
  });
  const functions: FunctionImplementation[] = [
    ...BASIC_FUNCTIONS.filter((fn) => fn.name !== "openUrl"),
    createSandoOpenUrl(),
  ];
  const catalog = new Catalog<
    ReactComponentImplementation,
    FunctionImplementation
  >(SANDO_CATALOG_ID, "1.0", components, functions);
  return new MessageProcessor<ReactComponentImplementation>(
    [catalog],
    (action: ActionPayload) => {
      if (action.userMessage?.trim()) {
        onFollowUp(action.userMessage.trim());
        return;
      }
      onFollowUp(
        JSON.stringify({
          a2ui_action: {
            name: action.name,
            context: action.context,
            surfaceId: action.surfaceId,
            sourceComponentId: action.sourceComponentId,
          },
        }),
      );
    },
    { version: "1.0" },
  );
}

/* ------------------------------------------------------------------ */
/* Answer                                                              */
/* ------------------------------------------------------------------ */

interface A2UIAnswerProps {
  /** A2UI wire messages, one JSON object per line. */
  messages: string;
  isStreaming?: boolean;
  /** Data-model snapshot saved with the message (form state). */
  state?: Record<string, unknown>;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onFollowUp: (prompt: string) => void;
}

/**
 * Renders one assistant answer as A2UI.
 *
 * The only module that imports the A2UI renderer. Prose never reaches here:
 * ChatView stores non-A2UI replies as `kind: "text"`. When the messages
 * cannot render, the raw log is shown as plain text instead of an empty box.
 */
export default function A2UIAnswer({
  messages,
  isStreaming = false,
  state,
  onStateUpdate,
  onFollowUp,
}: A2UIAnswerProps) {
  const followUpRef = useRef(onFollowUp);
  const stateUpdateRef = useRef(onStateUpdate);
  // Keep the refs current after render; callbacks read them at event time.
  useEffect(() => {
    followUpRef.current = onFollowUp;
    stateUpdateRef.current = onStateUpdate;
  });

  // Created once in the subscribe effect below (effects, not render, may
  // write refs). Its action callback reads followUpRef at event time, so a
  // changing onFollowUp never rebuilds the processor.
  const processorRef = useRef<MessageProcessor<ReactComponentImplementation> | null>(
    null,
  );

  const [surface, setSurface] =
    useState<SurfaceModel<ReactComponentImplementation> | null>(null);
  /** Raw log to show as plain text when the answer cannot render. */
  const [failedContent, setFailedContent] = useState<string | null>(null);
  /** Lines already fed to the processor, so a re-render never replays them. */
  const fedLinesRef = useRef(0);
  /** True once feeding a line failed (invalid message or validation). */
  const failedRef = useRef(false);
  /** True once the saved form state has been applied to this surface. */
  const appliedStateRef = useRef(false);

  // Build the processor once, then subscribe to the surface, and to surface
  // creation for later answers. The processor is fresh on mount, so no
  // surface exists yet; surfaces only arrive through onSurfaceCreated once
  // messages are fed.
  useEffect(() => {
    if (processorRef.current === null) {
      processorRef.current = buildProcessor((prompt) =>
        followUpRef.current(prompt),
      );
    }
    const processor = processorRef.current;
    const sub = processor.onSurfaceCreated((created) => setSurface(created));
    const deleted = processor.onSurfaceDeleted((id) => {
      setSurface((current) => (current?.id === id ? null : current));
    });
    return () => {
      sub.unsubscribe();
      deleted.unsubscribe();
    };
  }, []);

  // Feed new wire messages in order, as they arrive.
  useEffect(() => {
    const processor = processorRef.current;
    if (!processor) return;
    const lines = messages.split("\n");
    for (let i = fedLinesRef.current; i < lines.length; i++) {
      const line = lines[i];
      fedLinesRef.current = i + 1;
      if (!line.trim()) continue;
      let parsed;
      try {
        parsed = parseA2UIMessage(line);
      } catch {
        failedRef.current = true;
        break;
      }
      if (!parsed) continue;
      const errors = processor.processMessagesWithErrors([parsed]);
      if (errors.length > 0) {
        failedRef.current = true;
        break;
      }
    }
    if (failedRef.current && !isStreaming) {
      setFailedContent(messages);
    }
  }, [messages, isStreaming]);

  // Restore saved form state once, on the first surface.
  useEffect(() => {
    if (!surface || appliedStateRef.current) return;
    appliedStateRef.current = true;
    if (state && Object.keys(state).length > 0) {
      try {
        processorRef.current?.processMessages([
          {
            version: "1.0",
            updateDataModel: {
              surfaceId: surface.id,
              path: "/",
              value: state,
            },
          },
        ]);
      } catch {
        // The wire log rebuilds the model anyway; a bad snapshot is ignored.
      }
    }
  }, [surface, state]);

  // Persist form edits on the stored message.
  useEffect(() => {
    if (!surface) return;
    const sub = surface.dataModel.subscribe("/", (value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        stateUpdateRef.current?.(value as Record<string, unknown>);
      }
    });
    return () => sub.unsubscribe();
  }, [surface]);

  if (failedContent !== null) {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
        {failedContent}
      </pre>
    );
  }

  if (!surface) {
    // The stream ended with no surface: show the raw log, never a blank box.
    // While still streaming, the typing indicator covers the wait.
    if (!isStreaming && messages.trim()) {
      return (
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
          {messages}
        </pre>
      );
    }
    return null;
  }

  return (
    <div className="a2ui-answer min-w-0 text-sm">
      <A2uiSurface surface={surface} />
    </div>
  );
}
