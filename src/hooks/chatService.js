import { getStoredGlpiAuth } from "./chatHelpers";

const CREATE_CONVERSATION_WEBHOOK_URL =
  "https://roadster.wheaton.com.br/webhook/glpi/api/chat";
const MESSAGE_API_URL =
  "https://roadster.wheaton.com.br/webhook/glpi/api/message";
const CHATBOT_WEBHOOK_URL =
  "https://roadster.wheaton.com.br/webhook/glpi/chatbot";

function parseResultadoToArray(data) {
  const firstItem = Array.isArray(data) ? data[0] : data;
  const raw = firstItem?.RESULTADO;
  if (raw == null) return [];

  try {
    const parsed =
      typeof raw === "string" ? JSON.parse(raw) : raw;

    if (Array.isArray(parsed)) return parsed;

    if (parsed?.data != null) {
      const inner = parsed.data;
      if (Array.isArray(inner)) return inner;
      if (Array.isArray(inner?.mensagens)) return inner.mensagens;
      if (Array.isArray(inner?.messages)) return inner.messages;
    }

    if (Array.isArray(parsed?.mensagens)) return parsed.mensagens;
    if (Array.isArray(parsed?.messages)) return parsed.messages;

    return [];
  } catch (error) {
    console.error("Não foi possível interpretar RESULTADO (lista):", error);
    return [];
  }
}

function looksLikeMessageRow(item) {
  if (!item || typeof item !== "object") return false;
  return (
    item.mensagem != null ||
    item.message != null ||
    item.conteudo != null ||
    String(item.remetente ?? item.sender ?? "").trim() !== ""
  );
}

/** Metadados de conversa (lista de chats), não linha de mensagem de chat */
function looksLikeConversationMetadataRow(item) {
  if (!item || typeof item !== "object") return false;
  if (looksLikeMessageRow(item)) return false;
  return (
    item.id_conversa != null &&
    item.status != null &&
    item.dt_criacao != null
  );
}

export function normalizeApiMessageItem(item, index) {
  const remetente = String(item?.remetente ?? item?.sender ?? "").toUpperCase();
  const role = remetente === "USER" ? "user" : "assistant";

  return {
    id:
      item?.id != null
        ? String(item.id)
        : `msg-${index}-${item?.dt_criacao ?? index}`,
    role,
    content: String(
      item?.mensagem ?? item?.message ?? item?.conteudo ?? ""
    ),
    createdAt:
      item?.dt_criacao ??
      item?.dt_atualizacao ??
      item?.created_at ??
      new Date().toISOString(),
  };
}

export async function getConversationsByUser({ user }) {
  const url = new URL(CREATE_CONVERSATION_WEBHOOK_URL);
  url.searchParams.set("user", user);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar conversas. Status ${response.status}`);
  }

  const data = await response.json();
  const firstItem = Array.isArray(data) ? data[0] : data;
  const rawResult = firstItem?.RESULTADO;

  if (!rawResult) return [];

  let parsedResult = [];
  try {
    parsedResult = JSON.parse(rawResult);
  } catch (error) {
    console.error("Não foi possível converter RESULTADO em JSON:", error);
    return [];
  }

  if (!Array.isArray(parsedResult)) return [];

  return parsedResult;
}

function isSaveAcknowledgementOnly(text) {
  if (text == null || String(text).trim() === "") return false;
  return /mensagem\s+salva\s+com\s+sucesso/i.test(String(text));
}

function parseSendMessageResponse(data) {
  const firstItem = Array.isArray(data) ? data[0] : data;
  const rawResultado = firstItem?.RESULTADO;

  let candidate = null;

  if (rawResultado != null) {
    try {
      const inner =
        typeof rawResultado === "string"
          ? JSON.parse(rawResultado)
          : rawResultado;

      candidate =
        inner?.data?.message ??
        inner?.data?.mensagem ??
        inner?.message ??
        null;

      if (candidate != null) {
        candidate = String(candidate);
      }
    } catch (error) {
      console.error("Não foi possível interpretar RESULTADO do envio:", error);
    }
  }

  if (candidate == null) {
    candidate =
      firstItem?.data?.message ??
      firstItem?.message ??
      firstItem?.mensagem ??
      null;
    if (candidate != null) candidate = String(candidate);
  }

  if (candidate != null && isSaveAcknowledgementOnly(candidate)) {
    return { assistantMessage: null, raw: data };
  }

  return {
    assistantMessage:
      candidate != null
        ? candidate
        : "Recebi sua mensagem, mas a resposta veio vazia.",
    raw: data,
  };
}

export async function getMessagesByConversationId({ conversationId }) {
  const url = new URL(MESSAGE_API_URL);
  url.searchParams.set("id_conversa", conversationId);
  url.searchParams.set("id", conversationId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar mensagens. Status ${response.status}`);
  }

  const data = await response.json();
  let items = parseResultadoToArray(data);

  if (
    items.length === 0 &&
    Array.isArray(data) &&
    data.length > 0 &&
    data[0]?.RESULTADO == null
  ) {
    items = data;
  }

  if (
    items.length > 0 &&
    items.every(looksLikeConversationMetadataRow)
  ) {
    console.warn(
      "[chat] GET /message retornou lista de conversas (metadados), não mensagens. " +
        "Confira no backend o parâmetro do id da conversa ou o contrato desse endpoint."
    );
    return [];
  }

  const messageRows = items.filter(looksLikeMessageRow);

  return messageRows.map((item, index) =>
    normalizeApiMessageItem(item, index)
  );
}

export async function sendConversationMessage({
  conversationId,
  message,
  remetente = "USER",
}) {
  const response = await fetch(MESSAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id_conversa: conversationId,
      remetente,
      mensagem: message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar mensagem. Status ${response.status}`);
  }

  const data = await response.json();
  return parseSendMessageResponse(data);
}

function parseAgentChatResponse(data) {
  const firstItem = Array.isArray(data) ? data[0] : data;
  const rawResultado = firstItem?.RESULTADO;

  if (rawResultado != null) {
    try {
      const inner =
        typeof rawResultado === "string"
          ? JSON.parse(rawResultado)
          : rawResultado;

      const text =
        inner?.data?.reply ??
        inner?.data?.message ??
        inner?.data?.mensagem ??
        inner?.reply ??
        inner?.message ??
        inner?.output ??
        null;

      if (text != null) return String(text);
    } catch (error) {
      console.error("Não foi possível interpretar RESULTADO do agente:", error);
    }
  }

  const text =
    firstItem?.reply ??
    firstItem?.response ??
    firstItem?.message ??
    firstItem?.output ??
    null;

  return text != null ? String(text) : null;
}

/**
 * Resposta do agente (GLPI chatbot). Rode após persistir a mensagem do usuário.
 */
export async function sendChatAgentMessage({
  message,
  chatId,
  ticketId,
  conversationId,
  messages,
}) {
  const storedAuth = getStoredGlpiAuth();
  const sessionToken = storedAuth.sessionToken || null;

  const response = await fetch(CHATBOT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { "Session-Token": sessionToken } : {}),
    },
    body: JSON.stringify({
      message,
      chatId,
      ticketId,
      conversationId,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro no chatbot. Status ${response.status}`);
  }

  const data = await response.json();
  const assistantMessage =
    parseAgentChatResponse(data) ??
    "Recebi sua mensagem, mas a resposta veio vazia.";

  return { assistantMessage, raw: data };
}

function extractConversationIdFromApiPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const direct =
    payload.id_conversa ??
    payload.conversationId ??
    payload.conversation_id;
  if (direct != null && direct !== "") return String(direct);

  const rawResultado = payload.RESULTADO;
  if (rawResultado == null) return null;

  try {
    const inner =
      typeof rawResultado === "string"
        ? JSON.parse(rawResultado)
        : rawResultado;

    const nested =
      inner?.data?.id_conversa ??
      inner?.data?.idConversa ??
      inner?.id_conversa ??
      inner?.conversationId ??
      inner?.conversation_id ??
      null;

    if (nested != null && nested !== "") return String(nested);
  } catch (error) {
    console.error(
      "Não foi possível interpretar RESULTADO (criar conversa):",
      error
    );
  }

  return null;
}

export async function createConversation({ user }) {
  const response = await fetch(CREATE_CONVERSATION_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Erro ao criar conversa. Status ${response.status}`
    );
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : [data];

  let conversationId = null;
  for (const item of items) {
    conversationId = extractConversationIdFromApiPayload(item);
    if (conversationId) break;
  }

  if (!conversationId) {
    throw new Error("Resposta sem id_conversa.");
  }

  return {
    conversationId,
    raw: data,
  };
}