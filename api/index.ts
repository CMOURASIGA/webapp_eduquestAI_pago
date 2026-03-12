import type { VercelRequest, VercelResponse } from '@vercel/node';

let cachedApp: any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!cachedApp) {
      const mod = await import('./_app');
      cachedApp = mod.app;
      // In dev local (node server.ts) startServer já roda; na Vercel não precisa escutar porta
    }
    return cachedApp(req, res);
  } catch (err: any) {
    console.error("Erro ao inicializar o Express/Vercel handler:", err);
    res.status(500).json({
      error: "Falha ao iniciar a API",
      details: err?.message || String(err),
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}
