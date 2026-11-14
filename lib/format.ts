const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when a string looks like an email address (never shown as a name). */
export function isEmailLike(value?: string | null): boolean {
  return Boolean(value && EMAIL_LIKE.test(value.trim()));
}

/**
 * A person's name for display. Prefers the Keycloak `name` claim, falls back
 * to a username only when it is not an email, and otherwise uses a friendly
 * generic. The realm uses email-as-username, so the username must be filtered.
 */
export function getDisplayName(
  user?: { name?: string | null; username?: string | null } | null,
  fallback = "Friend",
): string {
  const name = user?.name?.trim();
  if (name && !isEmailLike(name)) return name;

  const username = user?.username?.trim();
  if (username && !isEmailLike(username)) return username;

  return fallback;
}

/**
 * Chat replies are rendered as plain text inside a bubble — there is no
 * markdown renderer, so `**bold**` would otherwise show up literally. The
 * system prompt asks the model for plain text; this is the safety net that
 * also cleans up older replies already stored in the browser.
 */
export function toPlainText(input: string): string {
  if (!input) return "";

  return (
    input
      .replace(/\r\n?/g, "\n")
      // Fenced code blocks: keep the code, drop the fence.
      .replace(/```[a-zA-Z0-9_+-]*\n?/g, "")
      // Inline code: keep the text.
      .replace(/`([^`\n]+)`/g, "$1")
      // Images and links.
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) =>
        url && url !== label ? `${label} (${url})` : label,
      )
      // Bold and underline markers.
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/__([^_\n]+)__/g, "$1")
      // Italic markers, only when they wrap a word rather than a number.
      .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?=$|[^\w*])/g, "$1$2")
      .replace(/(^|[^\w_])_(?!\s)([^_\n]+?)_(?=$|[^\w_])/g, "$1$2")
      // Headings, quotes, and horizontal rules.
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, "")
      // Bullets keep their shape, just without the asterisk.
      .replace(/^(\s*)[-*+]\s+/gm, "$1• ")
      .trim()
  );
}
