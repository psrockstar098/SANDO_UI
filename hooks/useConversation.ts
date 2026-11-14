"use client";

import { useSyncExternalStore } from "react";
import {
  getMessages,
  NO_MESSAGES,
  subscribeConversations,
  type StoredMessage,
} from "@/lib/chat/store";

/**
 * Live transcript for one conversation.
 *
 * The browser owns the history, so the server snapshot is empty and the real
 * transcript arrives after hydration — no hydration mismatch, and switching
 * chats (or another tab writing) updates the view on its own.
 */
export function useConversationMessages(
  id: string | null,
): readonly StoredMessage[] {
  return useSyncExternalStore(
    subscribeConversations,
    () => getMessages(id),
    () => NO_MESSAGES,
  );
}
