"use client";

import { useState } from "react";
import {
  BuiltinActionType,
  Renderer,
  type LibraryActionEvent,
  type OpenUIError,
} from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { isSafeUrl } from "@/lib/chat/openui";

interface OpenUIAnswerProps {
  code: string;
  isStreaming?: boolean;
  state?: Record<string, unknown>;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onFollowUp: (prompt: string) => void;
}

/**
 * Renders one assistant answer as OpenUI Lang.
 *
 * The only module that imports the OpenUI renderer. Prose never reaches
 * here: ChatView stores non-program replies as `kind: "text"`. When the
 * program cannot render, the raw code is shown as plain text instead of an
 * empty box.
 */
export default function OpenUIAnswer({
  code,
  isStreaming = false,
  state,
  onStateUpdate,
  onFollowUp,
}: OpenUIAnswerProps) {
  /** Code that failed hard (non-streaming only); shown as plain text. */
  const [failedCode, setFailedCode] = useState<string | null>(null);
  /** True when the parser currently reports no renderable program. */
  const [parseNull, setParseNull] = useState(false);

  // A new program gets a fresh chance to render. This is the documented
  // "adjusting state during render" pattern: it runs before the Renderer
  // parses the new code, so a corrected program renders again.
  const [prevCode, setPrevCode] = useState(code);
  if (prevCode !== code) {
    setPrevCode(code);
    setFailedCode(null);
    setParseNull(false);
  }

  const onAction = (event: LibraryActionEvent<typeof openuiLibrary>) => {
    if (event.type === BuiltinActionType.ContinueConversation) {
      const prompt = event.humanFriendlyMessage.trim();
      if (prompt) onFollowUp(prompt);
      return;
    }
    if (event.type === BuiltinActionType.OpenUrl) {
      const url = event.params.url;
      if (typeof url === "string" && isSafeUrl(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    // Everything else (for example @CopyToClipboard): ignore.
  };

  const onError = (errors: OpenUIError[]) => {
    if (errors.length === 0) {
      setFailedCode(null);
      return;
    }
    if (errors.every((e) => e.severity === "warning")) {
      // The program still renders; warnings are not a reason to fall back.
      setFailedCode(null);
      return;
    }
    // A hard error: only give up once the stream has finished, because a
    // partial program mid-stream is expected to be unparseable.
    if (!isStreaming) setFailedCode(code);
  };

  const fallbackCode = failedCode ?? (parseNull && code.trim() ? code : null);
  if (fallbackCode !== null) {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
        {fallbackCode}
      </pre>
    );
  }

  return (
    <div className="openui-answer min-w-0 text-sm">
      <Renderer
        response={code}
        library={openuiLibrary}
        isStreaming={isStreaming}
        initialState={state}
        onStateUpdate={onStateUpdate}
        onAction={onAction}
        onError={onError}
        onParseResult={(result) => setParseNull(result === null)}
        queryLoader={
          <span className="size-4 animate-spin rounded-full border-2 border-t-transparent border-white/70" />
        }
      />
    </div>
  );
}
