import { Send, Paperclip } from "lucide-react";

export default function ChatInput({
  input,
  setInput,
  sendMessage,
  handleKeyDown,
  textareaRef,
  autoResize,
}) {
  return (
    <footer className="chat-footer">
      <div className="input-shell">
        <button className="icon-btn" type="button">
          <Paperclip size={18} />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Envie uma mensagem..."
          className="chat-input"
        />

        <button
          type="button"
          onClick={sendMessage}
          disabled={!input.trim()}
          className={`send-btn ${input.trim() ? "enabled" : "disabled"}`}
        >
          <Send size={18} />
        </button>
      </div>

      <p className="footer-note">Desenvolvido por WHELAB.</p>
    </footer>
  );
}