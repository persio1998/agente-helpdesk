import { Bot, User } from "lucide-react";

export default function MessageBubble({ role, content }) {
  const isUser = role === "user";

  return (
    <div className={`message-row ${isUser ? "user-row" : "assistant-row"}`}>
      <div className={`message-group ${isUser ? "reverse" : ""}`}>
        <div className={`avatar ${isUser ? "user-avatar" : "assistant-avatar"}`}>
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>

        <div className={`message-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
          <p>{content}</p>
        </div>
      </div>
    </div>
  );
}