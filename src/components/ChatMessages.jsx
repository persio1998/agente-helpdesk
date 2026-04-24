import TicketIntroBubble from "./TicketIntroBubble";
import MessageMarkdown from "./MessageMarkdown";

export default function ChatMessages({
  messages,
  isTyping,
  messagesLoading = false,
}) {
  return (
    <div className="chat-messages">
      {messagesLoading && messages.length === 0 && (
        <div className="message-row assistant">
          <div className="message-bubble assistant typing">
            <p>Carregando mensagens...</p>
          </div>
        </div>
      )}

      {messages.map((message) => {
        if (message.type === "ticket_intro") {
          return (
            <TicketIntroBubble
              key={message.id}
              ticket={message.content}
            />
          );
        }

        return (
          <div
            key={message.id}
            className={`message-row ${message.role === "user" ? "user" : "assistant"}`}
          >
            <div className={`message-bubble ${message.role}`}>
              {message.role === "assistant" ? (
                <MessageMarkdown content={message.content} />
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="message-row assistant">
          <div className="message-bubble assistant typing">
            <p>Digitando...</p>
          </div>
        </div>
      )}
    </div>
  );
}