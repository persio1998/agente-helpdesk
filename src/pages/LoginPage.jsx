import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const N8N_GLPI_LOGIN_URL =
  "https://roadster.wheaton.com.br/webhook/glpi/api/initSession";

export default function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    try {
      const savedAuth = JSON.parse(localStorage.getItem("glpi_auth") || "{}");
      if (savedAuth.sessionToken) {
        navigate("/", { replace: true });
      } else if (savedAuth.login) {
        setLogin(savedAuth.login);
      }
    } catch (error) {
      console.error("Erro ao ler glpi_auth do localStorage:", error);
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();

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
        throw new Error("A resposta do endpoint não trouxe session_token.");
      }

      localStorage.setItem(
        "glpi_auth",
        JSON.stringify({
          login: login.trim(),
          sessionToken: data.session_token,
        })
      );

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Erro ao autenticar no GLPI:", error);
      setStatusMessage("Não foi possível autenticar no GLPI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Login GLPI</h2>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label htmlFor="login">Login</label>
              <input
                id="login"
                type="text"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="Digite seu login"
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Conectando..." : "Entrar"}
            </button>

            {statusMessage && <p className="status-message">{statusMessage}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
