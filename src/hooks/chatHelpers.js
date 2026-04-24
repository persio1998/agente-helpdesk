export function generateId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateConversationId() {
  return generateId("conv");
}

export function buildChatId(ticketId, conversationId) {
  const ticketPart = ticketId ? `ticket-${ticketId}` : "ticket-none";
  const convPart = conversationId ? `conv-${conversationId}` : "conv-none";
  return `${ticketPart}__${convPart}`;
}

function parseDateTime(value) {
  if (value == null || value === "") return 0;
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? 0 : t;
}

/** Maior = mais recente (para ordenar com o mais novo no topo). */
export function getConversationSortTimestamp(conversation) {
  if (conversation.lastActivityAt != null && conversation.lastActivityAt > 0) {
    return conversation.lastActivityAt;
  }

  const raw = conversation.rawConversation;
  const fromServer = Math.max(
    parseDateTime(raw?.dt_atualizacao),
    parseDateTime(raw?.dt_criacao)
  );
  if (fromServer > 0) return fromServer;

  if (conversation.localCreatedAt != null) {
    return conversation.localCreatedAt;
  }

  return 0;
}

export function sortConversationsByNewestFirst(conversations) {
  return [...conversations].sort((a, b) => {
    const aPending = !a.conversationId;
    const bPending = !b.conversationId;
    if (aPending !== bPending) {
      return aPending ? -1 : 1;
    }
    return getConversationSortTimestamp(b) - getConversationSortTimestamp(a);
  });
}

export function getStoredGlpiAuth() {
  try {
    return JSON.parse(localStorage.getItem("glpi_auth") || "{}");
  } catch (error) {
    console.error("Erro ao ler glpi_auth do localStorage:", error);
    return {};
  }
}

export function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function normalizeTicketToChat(ticket) {
  const ticketId = ticket?.id ? String(ticket.id) : null;
  const title = ticket?.name?.trim()
    ? ticket.name.trim()
    : ticketId
    ? `Chamado #${ticketId}`
    : "Chamado GLPI";

  return {
    id: buildChatId(ticketId, null),
    ticketId,
    conversationId: null,
    title,
    source: "glpi",
    status: ticket?.status ?? null,
    messages: [],
    rawTicket: ticket,
    preview:
      stripHtml(ticket?.content) ||
      `Chamado #${ticketId || "sem id"}`,
  };
}