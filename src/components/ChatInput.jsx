import { useRef } from "react";
import { Send, Paperclip } from "lucide-react";

export default function ChatInput({
  input,
  setInput,
  sendMessage,
  sendFileMessage,
  handleKeyDown,
  textareaRef,
  autoResize,
}) {
  const fileInputRef = useRef(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    sendFileMessage?.(selectedFile);
    event.target.value = "";
  };

  return (
    <footer className="chat-footer">
      <div className="input-shell">
        <button
          className="icon-btn"
          type="button"
          onClick={handleAttachClick}
          aria-label="Anexar arquivo"
          title="Anexar arquivo"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

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