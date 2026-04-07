import { useEffect, useState } from "react";

const N8N_GLPI_LOGIN_URL = "https://roadster.wheaton.com.br/webhook/glpi/initSession";

export default function SettingsModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState("glpi");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const savedAuth = localStorage.getItem("glpi_auth");

    if (!savedAuth) return;

    try {
      const parsed = JSON.parse(savedAuth);
      setLogin(parsed.login || "");
      setSessionToken(parsed.sessionToken || "");
    } catch (error) {
      console.error("Erro ao ler credenciais salvas do GLPI:", error);
    }
  }, []);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!login.trim() || !password.trim()) {
      setStatusMessage("Preencha login e senha.");
      return;
    }

    setLoading(true);
    setStatusMessage("");

    try {
      const response = await fetch(N8N_GLPI_LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "login_glpi",
          login: login.trim(),
          password: password.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.session_token) {
        throw new Error("A resposta do n8n não trouxe session_token.");
      }

      setSessionToken(data.session_token);
      setPassword("");

      localStorage.setItem(
        "glpi_auth",
        JSON.stringify({
          login: login.trim(),
          sessionToken: data.session_token,
        })
      );

      setStatusMessage("Login GLPI realizado com sucesso.");
    } catch (error) {
      console.error("Erro ao autenticar no GLPI via n8n:", error);
      setStatusMessage("Não foi possível autenticar no GLPI.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSession = () => {
    localStorage.removeItem("glpi_auth");
    setSessionToken("");
    setPassword("");
    setStatusMessage("Sessão removida.");
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
            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="glpi-login">Login</label>
                <input
                  id="glpi-login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Digite seu login"
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="glpi-password">Senha</label>
                <input
                  id="glpi-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Conectando..." : "Salvar"}
              </button>

              {sessionToken && (
                <div className="glpi-session-box">
                  <p>
                    <strong>Conectado ao GLPI</strong>
                  </p>
                  <small>Session token:</small>
                  <code>{sessionToken}</code>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRemoveSession}
                  >
                    Remover sessão
                  </button>
                </div>
              )}

              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </form>
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