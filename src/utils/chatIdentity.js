export function generateConversationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildChatId(ticketId, conversationId) {
  const ticketPart = ticketId ? `ticket-${ticketId}` : "ticket-none";
  const conversationPart = conversationId
    ? `conv-${conversationId}`
    : "conv-none";

  return `${ticketPart}__${conversationPart}`;
}

export function buildChatTitle({ ticketId, conversationId, title }) {
  if (title) return title;
  if (ticketId && conversationId) return `Chamado #${ticketId}`;
  if (ticketId) return `Chamado #${ticketId}`;
  if (conversationId) return "Nova conversa";
  return "Chat";
}