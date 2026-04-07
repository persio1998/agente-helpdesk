export function fakeReply(text) {
  const normalized = text.toLowerCase();

  if (normalized.includes("oi") || normalized.includes("olá")) {
    return "Oi! Como posso te ajudar hoje?";
  }

  if (normalized.includes("react")) {
    return "Posso te ajudar com React, componentes, estado, rotas, integração com API e interface também.";
  }

  if (normalized.includes("sql") || normalized.includes("banco")) {
    return "Se quiser, eu posso montar a query, revisar a modelagem ou transformar a lógica em função no banco.";
  }

  return "Entendi. Posso te ajudar a estruturar isso melhor, criar um passo a passo ou até transformar sua ideia em código.";
}

export function createChatTitle(text) {
  return text.slice(0, 28);
}