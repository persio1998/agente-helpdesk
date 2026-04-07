import { Plus, MessageSquareText, Ticket, Link2 } from "lucide-react";
import SidebarFooter from "./SidebarFooter";
import SettingsModal from "../Settings/SettingsModal";
import { useState } from "react";

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

              return (
                <button
                  key={conversation.id}
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`chat-item ${activeConversationId === conversation.id ? "active" : ""}`}
                >
                  <div className="chat-item-content">
                    <p className="chat-title">{conversation.title}</p>

                    <div className={`chat-meta chat-meta-${meta.type}`}>
                      <ChatMetaIcon type={meta.type} />
                      <span>{meta.label}</span>
                    </div>
                  </div>
                </button>
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