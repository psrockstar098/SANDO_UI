"use client";

import { useEffect, useState } from "react";
import {
  listConversations,
  subscribeConversations,
  type Conversation,
} from "@/lib/chat/store";

/**
 * Live list of saved conversations, newest first.
 * Starts empty on the server and fills in after mount.
 */
export function useConversations(): Conversation[] {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const sync = () => setConversations(listConversations());
    sync();
    return subscribeConversations(sync);
  }, []);

  return conversations;
}
