import { PanelLeft } from "lucide-react";

export default function Topbar({ setSidebarOpen }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn" onClick={() => setSidebarOpen((prev) => !prev)}>
          <PanelLeft size={18} />
        </button>

        <p className="topbar-title">Service desk TI</p>
      </div>
    </header>
  );
}