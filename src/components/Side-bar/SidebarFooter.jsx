import { Sparkles, Settings } from "lucide-react";

export default function SidebarFooter({ onOpenSettings }) {
  return (
    <div className="sidebar-footer">
      <button className="agent-card" onClick={onOpenSettings}>
        <div className="agent-icon">
          <Sparkles size={16} />
        </div>

        <div className="agent-info">
          <p className="agent-title">Seu agente</p>
        </div>

        <Settings size={16} />
      </button>
    </div>
  );
}