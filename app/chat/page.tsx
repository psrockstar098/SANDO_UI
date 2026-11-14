import { Suspense } from "react";
import ChatView from "./ChatView";

/**
 * The chat UI reads `?id=` / `?prompt=` on the client, so it lives behind a
 * Suspense boundary. Keeping this page a Server Component lets the shell
 * render instantly while the client view hydrates.
 */
export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="grid h-full min-h-0 flex-1 place-items-center rounded-3xl border border-white/10 bg-black text-sm text-neutral-500"
        >
          Loading chat…
        </div>
      }
    >
      <ChatView />
    </Suspense>
  );
}
