import { useEffect, useState } from "react";

export default function SettingsModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState("glpi");
  const [sessionToken, setSessionToken] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const savedAuth = localStorage.getItem("glpi_auth");

    if (!savedAuth) return;

    try {
      const parsed = JSON.parse(savedAuth);
      setSessionToken(parsed.sessionToken || "");
    } catch (error) {
      console.error("Erro ao ler credenciais salvas do GLPI:", error);
    }
  }, []);

  if (!open) return null;

  const handleRemoveSession = () => {
    localStorage.removeItem("glpi_auth");
    setSessionToken("");
    setStatusMessage("Sessão removida.");
    window.location.reload();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configurações</h2>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={activeTab === "glpi" ? "active" : ""}
            onClick={() => setActiveTab("glpi")}
          >
            GLPI
          </button>

          <button
            type="button"
            className={activeTab === "informacoes" ? "active" : ""}
            onClick={() => setActiveTab("informacoes")}
          >
            Informações
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "glpi" && (
            <div className="form">
              <button type="button" className="btn-primary" onClick={handleRemoveSession}>
                Sair
              </button>
              {sessionToken && (
                <div className="glpi-session-box">
                  <p>
                    <strong>Conectado ao GLPI</strong>
                  </p>
                  <small>Session token:</small>
                  <code>{sessionToken}</code>
                </div>
              )}

              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </div>
          )}

          {activeTab === "informacoes" && (
            <div className="info-tab">
              <p>Área reservada para informações futuras do agente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}