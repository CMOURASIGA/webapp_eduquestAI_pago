import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from './_app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error("Erro ao inicializar o Express/Vercel handler:", err);
    res.status(500).json({
      error: "Falha ao iniciar a API",
      details: err?.message || String(err),
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}
