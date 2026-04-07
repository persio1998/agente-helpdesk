function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, "").trim();
}

function getStatusLabel(status) {
  const statusMap = {
    1: "Novo",
    2: "Em andamento",
    3: "Pendente",
    4: "Solucionado",
    5: "Fechado",
    6: "Em aprovação",
  };

  return statusMap[status] || `Status ${status}`;
}

export default function TicketIntroBubble({ ticket }) {
  return (
    <div className="message-row assistant">
      <div className="message-bubble assistant ticket-intro-bubble">
        <p className="ticket-intro-eyebrow">Chamado GLPI</p>

        <h3 className="ticket-intro-title">
          #{ticket.ticketId} - {ticket.title || "Sem título"}
        </h3>

        <div className="ticket-intro-meta">
          <span>Status: {getStatusLabel(ticket.status)}</span>
          {ticket.date && <span>Abertura: {ticket.date}</span>}
          {ticket.updatedAt && <span>Atualizado: {ticket.updatedAt}</span>}
        </div>

        <div className="ticket-intro-description">
          <p>{stripHtml(ticket.content) || "Sem descrição do chamado."}</p>
        </div>
      </div>
    </div>
  );
}