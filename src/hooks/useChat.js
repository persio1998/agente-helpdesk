import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateId,
  getStoredGlpiAuth,
  sortConversationsByNewestFirst,
} from "./chatHelpers";
import {
  ChatServiceError,
  createConversation,
  getFileUploadMaxBytes,
  getConversationsByUser,
  getMessagesByConversationId,
  getTicketById,
  sendChatAgentMessage,
  sendConversationMessage,
} from "./chatService";

const FILE_UPLOAD_MAX_BYTES = getFileUploadMaxBytes();

function formatBytesToMB(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  return (bytes / (1024 * 1024)).toFixed(1);
}

function getFriendlySendErrorMessage(error) {
  if (error instanceof ChatServiceError) {
    return error.message;
  }

  return "Não consegui enviar o arquivo no momento.";
}

export default function useChat() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const textareaRef = useRef(null);
  const conversationsRef = useRef(conversations);

  conversationsRef.current = conversations;

  const activeConversation = useMemo(() => {
    return (
      conversations.find(
        (conversation) => conversation.id === activeConversationId
      ) ?? null
    );
  }, [conversations, activeConversationId]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  const resetTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
  };

  const appendMessageToConversation = (conversationId, message) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, messages: [...conversation.messages, message] }
          : conversation
      )
    );
  };

  const updateConversationById = (conversationId, updater) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? updater(conversation) : conversation
      )
    );
  };

  const buildTicketFallbackFromConversation = (conversation) => {
    const raw = conversation?.rawConversation || {};
    const ticketId = conversation?.ticketId;
    if (!ticketId) return null;

    return {
      id: String(raw.id_glpi ?? ticketId),
      name: String(raw.nome_chamado ?? raw.titulo ?? raw.title ?? "").trim(),
      status: raw.status ?? conversation?.status ?? null,
      date: raw.dt_criacao ?? raw.date ?? null,
      date_mod: raw.dt_atualizacao ?? raw.date_mod ?? null,
      content: String(raw.content ?? raw.descricao ?? raw.mensagem ?? ""),
    };
  };

  const fetchConversations = async (signal) => {
    setConversationsLoading(true);

    try {
      const storedAuth = getStoredGlpiAuth();
      const user = storedAuth.login?.trim();
      if (!user) return;

      const conversations = await getConversationsByUser({ user, signal });
      const fetchedConversations = conversations
        .map((item) => {
          const conversationId = item?.id_conversa
            ? String(item.id_conversa)
            : null;
          if (!conversationId) return null;

          return {
            id: conversationId,
            ticketId: item?.id_glpi ? String(item.id_glpi) : null,
            conversationId,
            title: `Conversa ${conversationId.slice(0, 8)}`,
            source: "remote",
            status: item?.status ?? null,
            messages: [],
            preview: "",
            rawConversation: item,
          };
        })
        .filter(Boolean);

      setConversations((prev) => {
        const localPendingConversations = prev.filter(
          (conversation) => !conversation.conversationId
        );

        const mergedFetched = fetchedConversations.map((fetchedConversation) => {
          const existing = prev.find(
            (conversation) => conversation.id === fetchedConversation.id
          );
          if (!existing) return fetchedConversation;

          return {
            ...fetchedConversation,
            messages: existing.messages || [],
            preview: existing.preview || fetchedConversation.preview,
            lastActivityAt: existing.lastActivityAt,
            localCreatedAt: existing.localCreatedAt,
          };
        });

        return sortConversationsByNewestFirst([
          ...localPendingConversations,
          ...mergedFetched,
        ]);
      });

      setActiveConversationId((prev) => {
        if (prev) return prev;
        const sorted = sortConversationsByNewestFirst(
          fetchedConversations.map((c) => ({ ...c }))
        );
        return sorted[0]?.id ?? null;
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Erro ao carregar chamados:", error);
    } finally {
      setConversationsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchConversations(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;

    let cancelled = false;

    (async () => {
      const conv = conversationsRef.current.find(
        (c) => c.id === activeConversationId
      );
      if (!conv?.conversationId) return;

      setMessagesLoading(true);
      try {
        const msgs = await getMessagesByConversationId({
          conversationId: conv.conversationId,
        });
        if (cancelled) return;

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeConversationId) return c;
            const existing = c.messages || [];
            if (msgs.length > 0) {
              return { ...c, messages: msgs };
            }
            if (existing.length === 0) {
              return { ...c, messages: msgs };
            }
            return c;
          })
        );

        const stillActiveConversation = conversationsRef.current.find(
          (c) => c.id === activeConversationId
        );
        const shouldLoadTicketData =
          msgs.length === 0 &&
          !!stillActiveConversation?.ticketId &&
          !stillActiveConversation?.rawTicket;

        if (shouldLoadTicketData) {
          try {
            const ticket = await getTicketById({
              ticketId: stillActiveConversation.ticketId,
            });
            if (cancelled) return;

            updateConversationById(activeConversationId, (conversation) => ({
              ...conversation,
              rawTicket: ticket,
              status: ticket.status ?? conversation.status,
              title: ticket.name?.trim()
                ? ticket.name.trim()
                : conversation.title,
            }));
          } catch (ticketError) {
            if (cancelled) return;

            const fallbackTicket =
              buildTicketFallbackFromConversation(stillActiveConversation);
            if (fallbackTicket) {
              updateConversationById(activeConversationId, (conversation) => ({
                ...conversation,
                rawTicket: fallbackTicket,
              }));
            }

            console.error("Erro ao carregar dados do ticket:", ticketError);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  const createNewChat = () => {
    const newConversation = {
      id: generateId("local-chat"),
      ticketId: null,
      conversationId: null,
      title: "Nova conversa",
      source: "local",
      status: null,
      messages: [],
      preview: "",
      localCreatedAt: Date.now(),
    };

    setConversations((prev) =>
      sortConversationsByNewestFirst([newConversation, ...prev])
    );
    setActiveConversationId(newConversation.id);
    setInput("");
    setIsTyping(false);
    resetTextareaHeight();
  };

  const ensureConversationReady = async () => {
    if (!activeConversation) return null;

    let currentConversation = activeConversation;
    let currentConversationId = activeConversation.id;

    if (!activeConversation.conversationId) {
      const storedAuth = getStoredGlpiAuth();
      const user = storedAuth.login?.trim();
      if (!user) {
        throw new Error("Usuário não encontrado em glpi_auth.login.");
      }

      const { conversationId } = await createConversation({ user });
      const nextConversationId = conversationId;
      const nextSource = activeConversation.ticketId ? "hybrid" : "local";

      updateConversationById(activeConversation.id, (conversation) => ({
        ...conversation,
        id: nextConversationId,
        conversationId,
        source: nextSource,
      }));

      currentConversation = {
        ...activeConversation,
        id: nextConversationId,
        conversationId,
        source: nextSource,
      };
      currentConversationId = nextConversationId;
      setActiveConversationId(nextConversationId);
    }

    return { currentConversation, currentConversationId };
  };

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        if (!base64) {
          reject(new Error("Não foi possível converter arquivo para base64."));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () =>
        reject(reader.error || new Error("Erro ao ler arquivo."));
      reader.readAsDataURL(file);
    });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeConversation || isTyping) return;

    let currentConversation;
    let currentConversationId;

    try {
      const ensured = await ensureConversationReady();
      if (!ensured) return;
      currentConversation = ensured.currentConversation;
      currentConversationId = ensured.currentConversationId;
    } catch (error) {
      console.error("Erro ao criar id_conversa:", error);
      appendMessageToConversation(activeConversation.id, {
        id: generateId("msg"),
        role: "assistant",
        content: "Não consegui iniciar a conversa agora.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const userMessage = {
      id: generateId("msg"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    appendMessageToConversation(currentConversationId, userMessage);
    setInput("");
    setIsTyping(true);
    resetTextareaHeight();

    try {
      const storedAuth = getStoredGlpiAuth();
      const sessionToken = storedAuth.sessionToken || null;

      await sendConversationMessage({
        conversationId: currentConversation.conversationId,
        message: text,
        messageType: "TEXTO",
        ticketId: currentConversation.ticketId || null,
        sessionToken,
      });

      const historyForAgent = [
        ...(currentConversation.messages || []),
        userMessage,
      ];

      const { assistantMessage: assistantContent } =
        await sendChatAgentMessage({
          message: text,
          chatId: currentConversationId,
          ticketId: currentConversation.ticketId || null,
          conversationId: currentConversation.conversationId || null,
          messages: historyForAgent,
        });

      if (assistantContent != null && String(assistantContent).trim() !== "") {
        try {
          await sendConversationMessage({
            conversationId: currentConversation.conversationId,
            message: assistantContent,
            remetente: "AGENT",
            messageType: "TEXTO",
            ticketId: currentConversation.ticketId || null,
            sessionToken,
          });
        } catch (persistError) {
          console.error("Erro ao gravar resposta do agente:", persistError);
        }

        appendMessageToConversation(currentConversationId, {
          id: generateId("msg"),
          role: "assistant",
          content: assistantContent,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);

      appendMessageToConversation(currentConversationId, {
        id: generateId("msg"),
        role: "assistant",
        content: "Não consegui me conectar ao servidor no momento.",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsTyping(false);
      setConversations((prev) =>
        sortConversationsByNewestFirst(
          prev.map((c) =>
            c.id === currentConversationId
              ? { ...c, lastActivityAt: Date.now() }
              : c
          )
        )
      );
    }
  };

  const sendFileMessage = async (file) => {
    if (!file || !activeConversation || isTyping) return;

    let currentConversation;
    let currentConversationId;

    try {
      const ensured = await ensureConversationReady();
      if (!ensured) return;
      currentConversation = ensured.currentConversation;
      currentConversationId = ensured.currentConversationId;
    } catch (error) {
      console.error("Erro ao criar id_conversa para arquivo:", error);
      appendMessageToConversation(activeConversation.id, {
        id: generateId("msg"),
        role: "assistant",
        content: "Não consegui iniciar a conversa para enviar o arquivo.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    appendMessageToConversation(currentConversationId, {
      id: generateId("msg"),
      role: "user",
      content: `Arquivo enviado: ${file.name}`,
      createdAt: new Date().toISOString(),
    });

    if (
      Number.isFinite(file.size) &&
      FILE_UPLOAD_MAX_BYTES > 0 &&
      file.size > FILE_UPLOAD_MAX_BYTES
    ) {
      appendMessageToConversation(currentConversationId, {
        id: generateId("msg"),
        role: "assistant",
        content: `Arquivo muito grande (${formatBytesToMB(
          file.size
        )} MB). Limite atual: ${formatBytesToMB(FILE_UPLOAD_MAX_BYTES)} MB.`,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const fileBase64 = await readFileAsBase64(file);
      const storedAuth = getStoredGlpiAuth();
      const sessionToken = storedAuth.sessionToken || null;

      await sendConversationMessage({
        conversationId: currentConversation.conversationId,
        message: file.name,
        messageType: "FILE",
        ticketId: currentConversation.ticketId || null,
        sessionToken,
        fileName: file.name,
        fileBase64,
        fileMimeType: file.type || "application/octet-stream",
        fileSize: Number.isFinite(file.size) ? file.size : null,
      });
    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      appendMessageToConversation(currentConversationId, {
        id: generateId("msg"),
        role: "assistant",
        content: getFriendlySendErrorMessage(error),
        createdAt: new Date().toISOString(),
      });
      return;
    }

    setConversations((prev) =>
      sortConversationsByNewestFirst(
        prev.map((c) =>
          c.id === currentConversationId ? { ...c, lastActivityAt: Date.now() } : c
        )
      )
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return {
    sidebarOpen,
    setSidebarOpen,
    input,
    setInput,
    isTyping,
    conversations,
    activeConversationId,
    setActiveConversationId,
    activeConversation,
    textareaRef,
    autoResize,
    createNewChat,
    sendMessage,
    sendFileMessage,
    handleKeyDown,
    fetchConversations,
    conversationsLoading,
    messagesLoading,
  };
}