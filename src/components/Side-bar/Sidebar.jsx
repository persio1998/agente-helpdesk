import {
  Plus,
  MessageSquareText,
  Ticket,
  Link2,
  MoreVertical,
  ExternalLink,
} from "lucide-react";
import SidebarFooter from "./SidebarFooter";
import SettingsModal from "../Settings/SettingsModal";
import { useState } from "react";

const GLPI_BASE_URL = (
  process.env.REACT_APP_GLPI_BASE_URL || "http://helpdesk-homol.wheaton.com.br"
).replace(/\/+$/, "");

function getConversationMeta(conversation) {
  const hasTicket = !!conversation.ticketId;
  const hasConversation = !!conversation.conversationId;

  if (hasTicket && hasConversation) {
    return {
      label: `GLPI #${conversation.ticketId} • Conv ${String(conversation.conversationId).slice(0, 8)}`,
      type: "hybrid",
    };
  }

  if (hasTicket) {
    return {
      label: `GLPI #${conversation.ticketId}`,
      type: "ticket",
    };
  }

  if (hasConversation) {
    return {
      label: `Conv ${String(conversation.conversationId).slice(0, 8)}`,
      type: "conversation",
    };
  }

  return {
    label: "Sem vínculo",
    type: "default",
  };
}

function ChatMetaIcon({ type }) {
  if (type === "hybrid") return <Link2 size={14} />;
  if (type === "ticket") return <Ticket size={14} />;
  return <MessageSquareText size={14} />;
}

export default function Sidebar({
  sidebarOpen,
  conversations,
  activeConversationId,
  setActiveConversationId,
  createNewChat,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openMenuConversationId, setOpenMenuConversationId] = useState(null);

  const handleOpenTicket = (ticketId) => {
    if (!ticketId) return;
    const glpiTicketUrl = `${GLPI_BASE_URL}/front/ticket.form.php?id=${encodeURIComponent(String(ticketId))}`;
    window.open(glpiTicketUrl, "_blank", "noopener,noreferrer");
    setOpenMenuConversationId(null);
  };

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-inner">
        <div className="sidebar-top">
          <button className="new-chat-btn" onClick={createNewChat}>
            <Plus size={18} />
            Novo chat
          </button>
        </div>

        <div className="sidebar-chats">
          <p className="sidebar-label">Conversas</p>

          <div className="chat-list">
            {conversations.map((conversation) => {
              const meta = getConversationMeta(conversation);
              const isActive = activeConversationId === conversation.id;
              const isMenuOpen = openMenuConversationId === conversation.id;
              const hasTicket = Boolean(conversation.ticketId);

              return (
                <div
                  key={conversation.id}
                  className={`chat-item ${isActive ? "active" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className="chat-item-main"
                  >
                  <div className="chat-item-content">
                    <p className="chat-title">{conversation.title}</p>

                    <div className={`chat-meta chat-meta-${meta.type}`}>
                      <ChatMetaIcon type={meta.type} />
                      <span>{meta.label}</span>
                    </div>
                  </div>
                  </button>

                  <div className="chat-item-actions">
                    <button
                      type="button"
                      className="chat-item-menu-btn"
                      aria-label="Abrir menu da conversa"
                      title="Mais opções"
                      onClick={() =>
                        setOpenMenuConversationId((current) =>
                          current === conversation.id ? null : conversation.id
                        )
                      }
                    >
                      <MoreVertical size={14} />
                    </button>

                    {isMenuOpen && (
                      <div className="chat-item-menu">
                        <button
                          type="button"
                          className="chat-item-menu-option"
                          onClick={() => handleOpenTicket(conversation.ticketId)}
                          disabled={!hasTicket}
                        >
                          <ExternalLink size={14} />
                          Abrir no GLPI
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <SidebarFooter onOpenSettings={() => setSettingsOpen(true)} />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </aside>
  );
}