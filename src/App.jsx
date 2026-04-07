import "./App.css";
import Sidebar from "./components/Side-bar/Sidebar";
import Topbar from "./components/Topbar";
import ChatInput from "./components/ChatInput";
import EmptyState from "./components/EmptyState";
import ChatMessages from "./components/ChatMessages";
import { suggestions } from "./data/mockData";
import useChat from "./hooks/useChat";

function buildTicketIntroMessage(chat) {
  if (!chat?.ticketId) return null;

  const ticket = chat.rawTicket;
  if (!ticket) return null;

  return {
    id: `ticket-intro-${chat.ticketId}`,
    role: "assistant",
    type: "ticket_intro",
    content: {
      ticketId: ticket.id,
      title: ticket.name,
      status: ticket.status,
      date: ticket.date,
      updatedAt: ticket.date_mod,
      content: ticket.content,
    },
  };
}

export default function App() {
  const {
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
    messagesLoading,
  } = useChat();

  const ticketIntroMessage = buildTicketIntroMessage(activeConversation);
  const chatMessages = activeConversation?.messages || [];

  const messages = ticketIntroMessage
    ? [ticketIntroMessage, ...chatMessages]
    : chatMessages;

  const showEmptyState =
    !activeConversation ||
    (messages.length === 0 &&
      !messagesLoading &&
      !activeConversation?.conversationId);

  return (
    <div className="app-shell">
      <Sidebar
        sidebarOpen={sidebarOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        setActiveConversationId={setActiveConversationId}
        createNewChat={createNewChat}
      />

      <div className="main-area">
        <Topbar setSidebarOpen={setSidebarOpen} />

        <main className="chat-main">
          {showEmptyState ? (
            <EmptyState suggestions={suggestions} setInput={setInput} />
          ) : (
            <ChatMessages
              messages={messages}
              isTyping={isTyping}
              messagesLoading={messagesLoading}
            />
          )}
        </main>

        <ChatInput
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          handleKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          autoResize={autoResize}
        />
      </div>
    </div>
  );
}