export async function extractTextFromImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("/api/extract-text-image", {
    method: "POST",
    body: formData,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = isJson ? data?.error || data?.details : data;
    throw new Error(msg || "Falha ao extrair texto da imagem.");
  }

  if (isJson && data?.text) {
    return data.text as string;
  }

  throw new Error("Resposta inesperada ao extrair texto da imagem.");
}
