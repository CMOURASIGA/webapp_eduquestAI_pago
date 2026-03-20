// Extração resiliente de JSON retornado pela IA, mesmo que venha com texto antes/depois.
export function extractJSON(text: string) {
  if (!text || typeof text !== "string") {
    throw new Error("Resposta da IA vazia ou inválida.");
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("JSON não encontrado na resposta da IA.");
  }

  return JSON.parse(match[0]);
}
