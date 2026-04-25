import { getStoredGlpiAuth } from "./chatHelpers";

const CREATE_CONVERSATION_WEBHOOK_URL =
  "https://roadster.wheaton.com.br/webhook/glpi/api/chat";
const MESSAGE_API_URL =
  "https://roadster.wheaton.com.br/webhook/glpi/api/message";
const CHATBOT_WEBHOOK_URL =
  "https://roadster.wheaton.com.br/webhook/glpi/chatbot";
const TICKET_DETAILS_WEBHOOK_URL =
  process.env.REACT_APP_GLPI_TICKET_DETAILS_URL || "";
const FILE_UPLOAD_MAX_BYTES = Number(
  process.env.REACT_APP_FILE_UPLOAD_MAX_BYTES || 2 * 1024 * 1024
);

export class ChatServiceError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = "ChatServiceError";
    this.status = status;
    this.code = code;
  }
}

export function getFileUploadMaxBytes() {
  return FILE_UPLOAD_MAX_BYTES;
}

function bytesToMB(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  return (bytes / (1024 * 1024)).toFixed(1);
}

function buildHttpErrorMessage(status) {
  if (status === 413) {
    return `Arquivo maior que o limite permitido (${bytesToMB(
      FILE_UPLOAD_MAX_BYTES
    )} MB).`;
  }
  if (status >= 500) return "Servidor indisponível no momento.";
  if (status === 401 || status === 403) return "Sessão inválida ou expirada.";
  return `Erro ao enviar mensagem. Status ${status}`;
}

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text || String(text).trim() === "") return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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

export async function getConversationsByUser({ user, signal }) {
  const storedAuth = getStoredGlpiAuth();
  const sessionToken = storedAuth.sessionToken || null;
  const login = String(user ?? storedAuth.login ?? "").trim();

  const url = new URL(CREATE_CONVERSATION_WEBHOOK_URL);
  url.searchParams.set("user", login);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(login ? { Login: login } : {}),
      ...(sessionToken ? { "Session-Token": sessionToken } : {}),
    },
    ...(signal ? { signal } : {}),
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

function parseTicketResponseToObject(data) {
  const items = parseResultadoToArray(data);
  const first = Array.isArray(items) && items.length > 0 ? items[0] : null;
  if (first && typeof first === "object") return first;

  const direct = Array.isArray(data) ? data[0] : data;
  if (direct && typeof direct === "object" && !direct.RESULTADO) return direct;
  return null;
}

export async function getTicketById({ ticketId, signal }) {
  if (!ticketId) {
    throw new Error("ticketId é obrigatório para buscar chamado.");
  }

  if (!TICKET_DETAILS_WEBHOOK_URL) {
    throw new Error("REACT_APP_GLPI_TICKET_DETAILS_URL não configurada.");
  }

  const storedAuth = getStoredGlpiAuth();
  const sessionToken = storedAuth.sessionToken || null;
  const login = String(storedAuth.login ?? "").trim();

  const url = new URL(TICKET_DETAILS_WEBHOOK_URL);
  url.searchParams.set("id_glpi", String(ticketId));
  url.searchParams.set("id", String(ticketId));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(login ? { Login: login } : {}),
      ...(sessionToken ? { "Session-Token": sessionToken } : {}),
    },
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar ticket. Status ${response.status}`);
  }

  const data = await response.json();
  const ticket = parseTicketResponseToObject(data);

  if (!ticket || typeof ticket !== "object") {
    throw new Error("Resposta sem dados do ticket.");
  }

  return {
    id: String(ticket.id ?? ticketId),
    name: String(ticket.name ?? ticket.titulo ?? ticket.title ?? "").trim(),
    status: ticket.status ?? null,
    date: ticket.date ?? ticket.dt_criacao ?? null,
    date_mod: ticket.date_mod ?? ticket.dt_atualizacao ?? null,
    content: String(ticket.content ?? ticket.descricao ?? ticket.message ?? ""),
    raw: ticket,
  };
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
  messageType = "TEXTO",
  ticketId = null,
  sessionToken = null,
  fileName = null,
  fileBase64 = null,
  fileMimeType = null,
  fileSize = null,
}) {
  const normalizedMessageType =
    String(messageType || "")
      .trim()
      .toUpperCase() === "FILE"
      ? "FILE"
      : "TEXTO";

  let response;
  try {
    response = await fetch(MESSAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { "Session-Token": sessionToken } : {}),
      },
      body: JSON.stringify({
        id_conversa: conversationId,
        ...(ticketId
          ? { id_glpi: String(ticketId), ticketId: String(ticketId) }
          : {}),
        ...(sessionToken ? { session_token: sessionToken } : {}),
        remetente,
        mensagem: message,
        tipo_mensagem: normalizedMessageType,
        ...(fileName ? { nome_arquivo: fileName } : {}),
        ...(fileBase64 ? { arquivo_base64: fileBase64 } : {}),
        ...(fileMimeType ? { mime_type: fileMimeType } : {}),
        ...(fileSize != null ? { tamanho_bytes: fileSize } : {}),
      }),
    });
  } catch (error) {
    throw new ChatServiceError(
      "Falha de rede ao enviar mensagem. Verifique CORS/servidor.",
      { code: "NETWORK_ERROR" }
    );
  }

  if (!response.ok) {
    throw new ChatServiceError(buildHttpErrorMessage(response.status), {
      status: response.status,
      code: response.status === 413 ? "PAYLOAD_TOO_LARGE" : "HTTP_ERROR",
    });
  }

  const data = await parseJsonSafely(response);
  if (data == null) {
    return { assistantMessage: null, raw: null };
  }

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