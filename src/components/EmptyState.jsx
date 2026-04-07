import { Bot } from "lucide-react";

export default function EmptyState({ suggestions, setInput }) {
  return (
    <div className="empty-state">
      <div className="empty-content">
        <div className="hero-icon">
          <Bot size={28} />
        </div>

        <h1>Como posso ajudar hoje?</h1>

        <div className="suggestions-grid">
          {suggestions.map((item) => (
            <button
              key={item}
              className="suggestion-card"
              onClick={() => setInput(item)}
            >
              <p>{item}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}