import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateId,
  getStoredGlpiAuth,
  sortConversationsByNewestFirst,
} from "./chatHelpers";
import {
  createConversation,
  getConversationsByUser,
  getMessagesByConversationId,
  sendChatAgentMessage,
  sendConversationMessage,
} from "./chatService";

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

  const fetchConversations = async () => {
    setConversationsLoading(true);

    try {
      const storedAuth = getStoredGlpiAuth();
      const user = storedAuth.login?.trim();
      if (!user) return;

      const conversations = await getConversationsByUser({ user });
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
      console.error("Erro ao carregar chamados:", error);
    } finally {
      setConversationsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeConversation || isTyping) return;

    let currentConversation = activeConversation;
    let currentConversationId = activeConversation.id;

    if (!activeConversation.conversationId) {
      try {
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
      } catch (error) {
        console.error("Erro ao criar id_conversa:", error);
        appendMessageToConversation(currentConversationId, {
          id: generateId("msg"),
          role: "assistant",
          content: "Não consegui iniciar a conversa agora.",
          createdAt: new Date().toISOString(),
        });
        return;
      }
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
      await sendConversationMessage({
        conversationId: currentConversation.conversationId,
        message: text,
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
    handleKeyDown,
    fetchConversations,
    conversationsLoading,
    messagesLoading,
  };
}