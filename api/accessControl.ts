import crypto from "crypto";
import fs from "fs";
import path from "path";
import type express from "express";
import { google } from "googleapis";

type Role = "professor" | "aluno";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface ClienteRow {
  cliente_id: string;
  nome: string;
  email: string;
  telefone: string;
  status_conta: string;
  tipo_acesso: string;
  plano_id: string;
  serie_contratada: string;
  creditos_disponiveis: number;
  creditos_utilizados: number;
  validade_ate: string;
  pagamento_status: string;
  voucher_codigo: string;
  data_cadastro: string;
  data_ultimo_pagamento: string;
  observacao: string;
}

interface PlanoRow {
  plano_id: string;
  nome_plano: string;
  tipo_plano: string;
  valor: number;
  creditos_inclusos: number;
  validade_dias: number;
  serie: string;
  franquia_mensal: number;
  ativo: string;
  descricao: string;
}

interface PagamentoRow {
  pagamento_id: string;
  cliente_id: string;
  email: string;
  asaas_customer_id: string;
  asaas_payment_id: string;
  asaas_subscription_id: string;
  plano_id: string;
  valor: number;
  status: string;
  data_criacao: string;
  data_confirmacao: string;
  origem: string;
  descricao: string;
}

interface ConsumoRow {
  consumo_id: string;
  cliente_id: string;
  email: string;
  data_hora: string;
  tipo_geracao: string;
  quantidade_questoes: number;
  creditos_consumidos: number;
  modelo_ia: string;
  tokens_input: number;
  tokens_output: number;
  custo_estimado: number;
  status_execucao: string;
  referencia: string;
}

interface VoucherRow {
  voucher_id: string;
  codigo: string;
  tipo: string;
  valor_desconto: number;
  percentual_desconto: number;
  creditos_bonus: number;
  gratuidade_total: string;
  limite_uso: number;
  usos_realizados: number;
  validade_ate: string;
  ativo: string;
  observacao: string;
}

interface SheetData {
  clientes: ClienteRow[];
  planos: PlanoRow[];
  pagamentos: PagamentoRow[];
  consumo: ConsumoRow[];
  vouchers: VoucherRow[];
}

interface AuthStore {
  users: AuthUser[];
  sessions: Session[];
}

const WRITABLE_ROOT = process.env.VERCEL ? "/tmp" : process.cwd();
const LOGS_DIR = path.resolve(WRITABLE_ROOT, "logs");
const AUTH_PATH = path.join(LOGS_DIR, "authStore.json");
const SHEET_PATH = path.join(LOGS_DIR, "sheetStore.json");
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const CREDITS_PER_QUESTION = Number(process.env.CREDITS_PER_QUESTION || 1);
const MIN_MANUAL_RELEASE_HOURS = Number(process.env.MIN_MANUAL_RELEASE_HOURS || 1);
const PIX_PAYMENT_KEY = (process.env.PIX_PAYMENT_KEY || "").trim();
const PIX_PAYMENT_RECIPIENT = (process.env.PIX_PAYMENT_RECIPIENT || "EduQuest IA").trim();
const BILLING_MODE = PIX_PAYMENT_KEY ? "pix_manual" : "teste";

const GOOGLE_SHEET_ID = (process.env.GOOGLE_SHEET_ID || "").trim();
const GOOGLE_SERVICE_ACCOUNT_JSON = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();

const CLIENTES_HEADERS = [
  "cliente_id", "nome", "email", "telefone", "status_conta", "tipo_acesso", "plano_id", "serie_contratada",
  "creditos_disponiveis", "creditos_utilizados", "validade_ate", "pagamento_status", "voucher_codigo",
  "data_cadastro", "data_ultimo_pagamento", "observacao"
];
const PLANOS_HEADERS = [
  "plano_id", "nome_plano", "tipo_plano", "valor", "creditos_inclusos", "validade_dias", "serie", "franquia_mensal", "ativo", "descricao"
];
const PAGAMENTOS_HEADERS = [
  "pagamento_id", "cliente_id", "email", "asaas_customer_id", "asaas_payment_id", "asaas_subscription_id", "plano_id",
  "valor", "status", "data_criacao", "data_confirmacao", "origem", "descricao"
];
const AUTH_USERS_HEADERS = [
  "id", "name", "email", "role", "password_hash", "password_salt", "created_at"
];
const AUTH_SESSIONS_HEADERS = [
  "token", "user_id", "created_at", "expires_at"
];
const CONSUMO_HEADERS = [
  "consumo_id", "cliente_id", "email", "data_hora", "tipo_geracao", "quantidade_questoes", "creditos_consumidos", "modelo_ia",
  "tokens_input", "tokens_output", "custo_estimado", "status_execucao", "referencia"
];
const VOUCHERS_HEADERS = [
  "voucher_id", "codigo", "tipo", "valor_desconto", "percentual_desconto", "creditos_bonus", "gratuidade_total",
  "limite_uso", "usos_realizados", "validade_ate", "ativo", "observacao"
];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function ensureDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(dateIso: string, days: number) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureDir();
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: any) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function toNumber(v: any, fallback = 0) {
  if (typeof v === "string") {
    const raw = v.trim();
    if (!raw) return fallback;
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function defaultSheetData(): SheetData {
  return {
    clientes: [],
    planos: [
      { plano_id: "PRE100", nome_plano: "Pacote 100 questoes", tipo_plano: "prepago", valor: 29.9, creditos_inclusos: 100, validade_dias: 365, serie: "geral", franquia_mensal: 0, ativo: "sim", descricao: "Pacote pre-pago com validade de 12 meses" },
      { plano_id: "PRE300", nome_plano: "Pacote 300 questoes", tipo_plano: "prepago", valor: 69.9, creditos_inclusos: 300, validade_dias: 365, serie: "geral", franquia_mensal: 0, ativo: "sim", descricao: "Pacote pre-pago com validade de 12 meses" },
      { plano_id: "ANUAL_5ANO", nome_plano: "Plano anual 5o ano", tipo_plano: "anual", valor: 297, creditos_inclusos: 0, validade_dias: 365, serie: "5o ano", franquia_mensal: 200, ativo: "sim", descricao: "Plano anual com franquia mensal" },
      { plano_id: "FREE20", nome_plano: "Voucher Free 20", tipo_plano: "voucher", valor: 0, creditos_inclusos: 20, validade_dias: 30, serie: "geral", franquia_mensal: 0, ativo: "sim", descricao: "Voucher promocional" }
    ],
    pagamentos: [],
    consumo: [],
    vouchers: [
      { voucher_id: "VC-0001", codigo: "FREE20", tipo: "gratuidade", valor_desconto: 0, percentual_desconto: 0, creditos_bonus: 20, gratuidade_total: "sim", limite_uso: 100, usos_realizados: 0, validade_ate: "2026-12-31", ativo: "sim", observacao: "Voucher de lancamento" }
    ]
  };
}

function readAuthStoreLocal(): AuthStore {
  const data = readJson<AuthStore>(AUTH_PATH, { users: [], sessions: [] });
  return data;
}

function writeAuthStoreLocal(data: AuthStore) {
  writeJson(AUTH_PATH, data);
}

function canUseGoogleSheets() {
  return Boolean(GOOGLE_SHEET_ID && GOOGLE_SERVICE_ACCOUNT_JSON);
}

function parseServiceAccount() {
  let raw = GOOGLE_SERVICE_ACCOUNT_JSON;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.private_key) parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
    return parsed;
  } catch {
    try {
      raw = Buffer.from(raw, "base64").toString("utf8");
      const parsed = JSON.parse(raw);
      if (parsed.private_key) parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
      return parsed;
    } catch {
      return null;
    }
  }
}

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const sa = parseServiceAccount();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON invalido.");

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

async function ensureTabsExist(tabNames: string[]) {
  const client = getSheetsClient();
  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    fields: "sheets.properties.title",
  });
  const existing = new Set(
    (spreadsheet.data.sheets || [])
      .map((s: any) => String(s?.properties?.title || ""))
      .filter(Boolean)
  );

  const missing = tabNames.filter((t) => !existing.has(t));
  if (missing.length === 0) return;

  await client.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });
}

function rowToObj(headers: string[], row: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  headers.forEach((h, i) => {
    obj[h] = row?.[i] ?? "";
  });
  return obj;
}

function objToRow(headers: string[], obj: Record<string, any>) {
  return headers.map((h) => obj[h] ?? "");
}

async function readTab(tabName: string, headers: string[]) {
  await ensureTabsExist([tabName]);
  const client = getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tabName}!A1:ZZ`,
  });
  const values = response.data.values || [];
  if (values.length === 0) return [] as Record<string, any>[];

  const sourceHeaders = (values[0] || []).map((v) => String(v).trim());
  const effectiveHeaders = sourceHeaders.length > 0 ? sourceHeaders : headers;

  return values.slice(1)
    .filter((r) => r.some((c) => String(c || "").trim() !== ""))
    .map((r) => rowToObj(effectiveHeaders, r));
}

async function writeTab(tabName: string, headers: string[], rows: Record<string, any>[]) {
  await ensureTabsExist([tabName]);
  const client = getSheetsClient();

  await client.spreadsheets.values.clear({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tabName}!A:ZZ`,
  });

  const values = [headers, ...rows.map((r) => objToRow(headers, r))];
  await client.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

async function readSheetStoreGoogle(): Promise<SheetData> {
  const clientesRaw = await readTab("clientes", CLIENTES_HEADERS);
  const planosRaw = await readTab("planos", PLANOS_HEADERS);
  const pagamentosRaw = await readTab("pagamentos", PAGAMENTOS_HEADERS);
  const consumoRaw = await readTab("consumo", CONSUMO_HEADERS);
  const vouchersRaw = await readTab("vouchers", VOUCHERS_HEADERS);

  const data: SheetData = {
    clientes: clientesRaw.map((r) => ({
      cliente_id: String(r.cliente_id || ""),
      nome: String(r.nome || ""),
      email: String(r.email || ""),
      telefone: String(r.telefone || ""),
      status_conta: String(r.status_conta || ""),
      tipo_acesso: String(r.tipo_acesso || ""),
      plano_id: String(r.plano_id || ""),
      serie_contratada: String(r.serie_contratada || ""),
      creditos_disponiveis: toNumber(r.creditos_disponiveis),
      creditos_utilizados: toNumber(r.creditos_utilizados),
      validade_ate: String(r.validade_ate || ""),
      pagamento_status: String(r.pagamento_status || ""),
      voucher_codigo: String(r.voucher_codigo || ""),
      data_cadastro: String(r.data_cadastro || ""),
      data_ultimo_pagamento: String(r.data_ultimo_pagamento || ""),
      observacao: String(r.observacao || ""),
    })),
    planos: planosRaw.map((r) => ({
      plano_id: String(r.plano_id || ""),
      nome_plano: String(r.nome_plano || ""),
      tipo_plano: String(r.tipo_plano || ""),
      valor: toNumber(r.valor),
      creditos_inclusos: toNumber(r.creditos_inclusos),
      validade_dias: toNumber(r.validade_dias),
      serie: String(r.serie || ""),
      franquia_mensal: toNumber(r.franquia_mensal),
      ativo: String(r.ativo || ""),
      descricao: String(r.descricao || ""),
    })),
    pagamentos: pagamentosRaw.map((r) => ({
      pagamento_id: String(r.pagamento_id || ""),
      cliente_id: String(r.cliente_id || ""),
      email: String(r.email || ""),
      asaas_customer_id: String(r.asaas_customer_id || ""),
      asaas_payment_id: String(r.asaas_payment_id || ""),
      asaas_subscription_id: String(r.asaas_subscription_id || ""),
      plano_id: String(r.plano_id || ""),
      valor: toNumber(r.valor),
      status: String(r.status || ""),
      data_criacao: String(r.data_criacao || ""),
      data_confirmacao: String(r.data_confirmacao || ""),
      origem: String(r.origem || ""),
      descricao: String(r.descricao || ""),
    })),
    consumo: consumoRaw.map((r) => ({
      consumo_id: String(r.consumo_id || ""),
      cliente_id: String(r.cliente_id || ""),
      email: String(r.email || ""),
      data_hora: String(r.data_hora || ""),
      tipo_geracao: String(r.tipo_geracao || ""),
      quantidade_questoes: toNumber(r.quantidade_questoes),
      creditos_consumidos: toNumber(r.creditos_consumidos),
      modelo_ia: String(r.modelo_ia || ""),
      tokens_input: toNumber(r.tokens_input),
      tokens_output: toNumber(r.tokens_output),
      custo_estimado: toNumber(r.custo_estimado),
      status_execucao: String(r.status_execucao || ""),
      referencia: String(r.referencia || ""),
    })),
    vouchers: vouchersRaw.map((r) => ({
      voucher_id: String(r.voucher_id || ""),
      codigo: String(r.codigo || ""),
      tipo: String(r.tipo || ""),
      valor_desconto: toNumber(r.valor_desconto),
      percentual_desconto: toNumber(r.percentual_desconto),
      creditos_bonus: toNumber(r.creditos_bonus),
      gratuidade_total: String(r.gratuidade_total || ""),
      limite_uso: toNumber(r.limite_uso),
      usos_realizados: toNumber(r.usos_realizados),
      validade_ate: String(r.validade_ate || ""),
      ativo: String(r.ativo || ""),
      observacao: String(r.observacao || ""),
    })),
  };

  if (data.planos.length === 0) data.planos = defaultSheetData().planos;
  return data;
}

async function writeSheetStoreGoogle(data: SheetData) {
  await writeTab("clientes", CLIENTES_HEADERS, data.clientes as any[]);
  await writeTab("planos", PLANOS_HEADERS, data.planos as any[]);
  await writeTab("pagamentos", PAGAMENTOS_HEADERS, data.pagamentos as any[]);
  await writeTab("consumo", CONSUMO_HEADERS, data.consumo as any[]);
  await writeTab("vouchers", VOUCHERS_HEADERS, data.vouchers as any[]);
}

async function readAuthStoreGoogle(): Promise<AuthStore> {
  const usersRaw = await readTab("auth_users", AUTH_USERS_HEADERS);
  const sessionsRaw = await readTab("auth_sessions", AUTH_SESSIONS_HEADERS);

  return {
    users: usersRaw.map((r) => ({
      id: String(r.id || ""),
      name: String(r.name || ""),
      email: String(r.email || "").toLowerCase(),
      role: String(r.role || "").toLowerCase() === "aluno" ? "aluno" : "professor",
      passwordHash: String(r.password_hash || ""),
      passwordSalt: String(r.password_salt || ""),
      createdAt: String(r.created_at || ""),
    })),
    sessions: sessionsRaw.map((r) => ({
      token: String(r.token || ""),
      userId: String(r.user_id || ""),
      createdAt: String(r.created_at || ""),
      expiresAt: String(r.expires_at || ""),
    })),
  };
}

async function writeAuthStoreGoogle(data: AuthStore) {
  await writeTab("auth_users", AUTH_USERS_HEADERS, data.users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    password_hash: u.passwordHash,
    password_salt: u.passwordSalt,
    created_at: u.createdAt,
  })));

  await writeTab("auth_sessions", AUTH_SESSIONS_HEADERS, data.sessions.map((s) => ({
    token: s.token,
    user_id: s.userId,
    created_at: s.createdAt,
    expires_at: s.expiresAt,
  })));
}

function readSheetStoreLocal(): SheetData {
  const data = readJson<SheetData>(SHEET_PATH, defaultSheetData());
  if (!data.planos || data.planos.length === 0) data.planos = defaultSheetData().planos;
  if (!data.clientes) data.clientes = [];
  if (!data.pagamentos) data.pagamentos = [];
  if (!data.consumo) data.consumo = [];
  if (!data.vouchers) data.vouchers = [];
  writeJson(SHEET_PATH, data);
  return data;
}

function writeSheetStoreLocal(data: SheetData) {
  writeJson(SHEET_PATH, data);
}

async function readSheetStore(): Promise<SheetData> {
  if (!canUseGoogleSheets()) return readSheetStoreLocal();
  try {
    return await readSheetStoreGoogle();
  } catch (e) {
    console.error("Falha ao ler Google Sheets. Usando fallback local:", e);
    return readSheetStoreLocal();
  }
}

async function writeSheetStore(data: SheetData) {
  if (!canUseGoogleSheets()) {
    writeSheetStoreLocal(data);
    return;
  }
  try {
    await writeSheetStoreGoogle(data);
  } catch (e) {
    console.error("Falha ao gravar Google Sheets. Gravando fallback local:", e);
    writeSheetStoreLocal(data);
  }
}

async function readAuthStore(): Promise<AuthStore> {
  let data: AuthStore;
  if (!canUseGoogleSheets()) {
    data = readAuthStoreLocal();
  } else {
    try {
      data = await readAuthStoreGoogle();
    } catch (e) {
      console.error("Falha ao ler auth no Google Sheets. Usando fallback local:", e);
      data = readAuthStoreLocal();
    }
  }

  const filtered = data.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
  if (filtered.length !== data.sessions.length) {
    data.sessions = filtered;
    await writeAuthStore(data);
  }
  return data;
}

async function writeAuthStore(data: AuthStore) {
  if (!canUseGoogleSheets()) {
    writeAuthStoreLocal(data);
    return;
  }
  try {
    await writeAuthStoreGoogle(data);
  } catch (e) {
    console.error("Falha ao gravar auth no Google Sheets. Gravando fallback local:", e);
    writeAuthStoreLocal(data);
  }
}

function hashPassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function createSession(userId: string): Session {
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return {
    token: crypto.randomBytes(24).toString("hex"),
    userId,
    createdAt,
    expiresAt
  };
}

function getToken(req: express.Request) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

function sanitizeUser(user: AuthUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function ensureClienteForUser(user: AuthUser) {
  const sheet = await readSheetStore();
  let cliente = sheet.clientes.find((c) => c.email.toLowerCase() === user.email.toLowerCase());
  if (!cliente) {
    cliente = {
      cliente_id: randomId("CL"),
      nome: user.name,
      email: user.email,
      telefone: "",
      status_conta: "aguardando_pagamento",
      tipo_acesso: "email_senha",
      plano_id: "",
      serie_contratada: "",
      creditos_disponiveis: 0,
      creditos_utilizados: 0,
      validade_ate: "",
      pagamento_status: "pendente",
      voucher_codigo: "",
      data_cadastro: today(),
      data_ultimo_pagamento: "",
      observacao: "Criado via cadastro"
    };
    sheet.clientes.push(cliente);
    await writeSheetStore(sheet);
  }
  return cliente;
}

function canGenerateFromCliente(cliente: ClienteRow) {
  const allowedStatuses = new Set(["ativo", "gratuito", "voucher"]);
  const reasons: string[] = [];
  let canGenerate = true;

  if (!allowedStatuses.has((cliente.status_conta || "").toLowerCase())) {
    canGenerate = false;
    reasons.push("Conta nao esta ativa para uso.");
  }

  if (cliente.validade_ate) {
    const isExpired = new Date(cliente.validade_ate).getTime() < new Date(today()).getTime();
    if (isExpired) {
      canGenerate = false;
      reasons.push("Conta expirada.");
    }
  }

  if ((cliente.creditos_disponiveis || 0) <= 0) {
    canGenerate = false;
    reasons.push("Sem creditos disponiveis.");
  }

  if ((cliente.pagamento_status || "").toLowerCase() === "pendente") {
    canGenerate = false;
    reasons.push(`Pagamento em analise manual. A liberacao pode levar no minimo ${MIN_MANUAL_RELEASE_HOURS} hora(s).`);
  }

  return { canGenerate, reasons };
}

export interface AuthenticatedRequest extends express.Request {
  authUser?: AuthUser;
  authCliente?: ClienteRow;
}

export async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Token ausente." });
  const auth = await readAuthStore();
  const session = auth.sessions.find((s) => s.token === token);
  if (!session) return res.status(401).json({ error: "Sessao invalida ou expirada." });
  const user = auth.users.find((u) => u.id === session.userId);
  if (!user) return res.status(401).json({ error: "Usuario da sessao nao encontrado." });
  req.authUser = user;
  req.authCliente = await ensureClienteForUser(user);
  return next();
}

export async function requireCanGenerate(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const cliente = req.authCliente;
  if (!cliente) return res.status(401).json({ error: "Cliente nao encontrado para sessao atual." });
  const check = canGenerateFromCliente(cliente);
  if (!check.canGenerate) {
    return res.status(402).json({
      error: "Conta sem permissao para gerar conteudo.",
      reasons: check.reasons,
      account: buildAccountStatus(cliente)
    });
  }
  return next();
}

function normalizePaymentStatus(status: string) {
  const normalized = (status || "").toLowerCase();
  if (["confirmado", "received", "recebido", "paid", "pago"].includes(normalized)) return "confirmado";
  if (["vencido", "overdue", "expired"].includes(normalized)) return "vencido";
  if (["cancelado", "canceled", "cancelled"].includes(normalized)) return "cancelado";
  return "pendente";
}

function buildAccountStatus(cliente: ClienteRow) {
  const check = canGenerateFromCliente(cliente);
  return {
    statusConta: cliente.status_conta,
    tipoAcesso: cliente.tipo_acesso,
    planoId: cliente.plano_id,
    creditosDisponiveis: Number(cliente.creditos_disponiveis || 0),
    creditosUtilizados: Number(cliente.creditos_utilizados || 0),
    validadeAte: cliente.validade_ate || null,
    pagamentoStatus: cliente.pagamento_status,
    canGenerate: check.canGenerate,
    blockReasons: check.reasons
  };
}

export function registerAccessControlRoutes(app: express.Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password, role } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Campos obrigatorios: name, email, password." });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      const auth = await readAuthStore();
      if (auth.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        return res.status(409).json({ error: "Email ja cadastrado." });
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const user: AuthUser = {
        id: randomId("USR"),
        name: String(name).trim(),
        email: normalizedEmail,
        role: role === "aluno" ? "aluno" : "professor",
        passwordHash: hashPassword(String(password), salt),
        passwordSalt: salt,
        createdAt: nowIso()
      };
      auth.users.push(user);
      const session = createSession(user.id);
      auth.sessions.push(session);
      await writeAuthStore(auth);

      const cliente = await ensureClienteForUser(user);
      return res.json({
        success: true,
        token: session.token,
        user: sanitizeUser(user),
        account: buildAccountStatus(cliente)
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Falha no cadastro.", details: e?.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Campos obrigatorios: email, password." });
      }
      const auth = await readAuthStore();
      const user = auth.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!user) return res.status(401).json({ error: "Credenciais invalidas." });
      const currentHash = hashPassword(String(password), user.passwordSalt);
      if (currentHash !== user.passwordHash) return res.status(401).json({ error: "Credenciais invalidas." });

      const session = createSession(user.id);
      auth.sessions.push(session);
      await writeAuthStore(auth);
      const cliente = await ensureClienteForUser(user);
      return res.json({
        success: true,
        token: session.token,
        user: sanitizeUser(user),
        account: buildAccountStatus(cliente)
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Falha no login.", details: e?.message });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: AuthenticatedRequest, res) => {
    const token = getToken(req);
    const auth = await readAuthStore();
    auth.sessions = auth.sessions.filter((s) => s.token !== token);
    await writeAuthStore(auth);
    return res.json({ success: true });
  });

  app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
    return res.json({
      user: sanitizeUser(req.authUser as AuthUser),
      account: buildAccountStatus(req.authCliente as ClienteRow)
    });
  });

  app.get("/api/account/status", requireAuth, (req: AuthenticatedRequest, res) => {
    return res.json(buildAccountStatus(req.authCliente as ClienteRow));
  });

  app.get("/api/account/credits", requireAuth, (req: AuthenticatedRequest, res) => {
    const c = req.authCliente as ClienteRow;
    return res.json({
      creditosDisponiveis: Number(c.creditos_disponiveis || 0),
      creditosUtilizados: Number(c.creditos_utilizados || 0),
      planoId: c.plano_id || null,
      validadeAte: c.validade_ate || null
    });
  });

  app.get("/api/plans", async (_req, res) => {
    const sheet = await readSheetStore();
    return res.json({ plans: sheet.planos.filter((p) => (p.ativo || "").toLowerCase() === "sim") });
  });

  app.get("/api/billing/mode", requireAuth, (_req: AuthenticatedRequest, res) => {
    return res.json({
      mode: BILLING_MODE,
      simulationEnabled: BILLING_MODE === "teste",
      minReleaseHours: MIN_MANUAL_RELEASE_HOURS
    });
  });

  app.post("/api/billing/create-checkout", requireAuth, async (req: AuthenticatedRequest, res) => {
    const { planoId } = req.body || {};
    if (!planoId) return res.status(400).json({ error: "Campo obrigatorio: planoId." });

    const sheet = await readSheetStore();
    const cliente = sheet.clientes.find((c) => c.cliente_id === req.authCliente?.cliente_id);
    if (!cliente) return res.status(404).json({ error: "Cliente nao encontrado." });
    const plano = sheet.planos.find((p) => p.plano_id === planoId && (p.ativo || "").toLowerCase() === "sim");
    if (!plano) return res.status(404).json({ error: "Plano nao encontrado ou inativo." });

    const payment: PagamentoRow = {
      pagamento_id: randomId("PG"),
      cliente_id: cliente.cliente_id,
      email: cliente.email,
      asaas_customer_id: randomId("CUS"),
      asaas_payment_id: randomId("PAY"),
      asaas_subscription_id: "",
      plano_id: plano.plano_id,
      valor: Number(plano.valor || 0),
      status: "pendente",
      data_criacao: nowIso(),
      data_confirmacao: "",
      origem: BILLING_MODE === "pix_manual" ? "pix_manual" : "local_checkout",
      descricao: BILLING_MODE === "pix_manual"
        ? `Pagamento PIX manual para plano ${plano.plano_id}`
        : `Checkout local para plano ${plano.plano_id}`
    };
    sheet.pagamentos.push(payment);

    cliente.plano_id = plano.plano_id;
    cliente.pagamento_status = "pendente";
    cliente.status_conta = "aguardando_pagamento";
    cliente.observacao = `Checkout criado. Liberacao manual em ate ${MIN_MANUAL_RELEASE_HOURS} hora(s).`;

    await writeSheetStore(sheet);

    return res.json({
      success: true,
      releaseNotice: `Pagamento recebido entra em analise manual. Prazo minimo para liberacao: ${MIN_MANUAL_RELEASE_HOURS} hora(s).`,
      billingMode: BILLING_MODE,
      checkout: {
        planoId: plano.plano_id,
        pagamentoId: payment.pagamento_id,
        asaasPaymentId: payment.asaas_payment_id,
        valor: payment.valor,
        checkoutUrl: `/billing/mock-checkout?pagamento_id=${payment.pagamento_id}`,
        simulationEnabled: BILLING_MODE === "teste",
        pix: BILLING_MODE === "pix_manual" ? {
          chave: PIX_PAYMENT_KEY,
          favorecido: PIX_PAYMENT_RECIPIENT,
          identificador: payment.pagamento_id,
          valor: payment.valor,
          instrucoes: [
            `Realize um PIX no valor de R$ ${Number(payment.valor || 0).toFixed(2)} usando a chave informada.`,
            `No comprovante, informe o identificador ${payment.pagamento_id}.`,
            `A liberacao ocorre manualmente em ate ${MIN_MANUAL_RELEASE_HOURS} hora(s) apos a confirmacao do pagamento.`
          ]
        } : null
      }
    });
  });

  app.post("/api/billing/webhook/asaas", async (req, res) => {
    try {
      const token = req.headers["x-webhook-token"];
      const expected = process.env.ASAAS_WEBHOOK_TOKEN;
      if (expected && token !== expected) {
        return res.status(401).json({ error: "Webhook token invalido." });
      }

      const payload = req.body || {};
      const asaasPaymentId = payload?.payment?.id || payload?.asaas_payment_id || payload?.asaasPaymentId || payload?.paymentId;
      const rawStatus = payload?.event || payload?.status || payload?.payment?.status || "pendente";
      if (!asaasPaymentId) return res.status(400).json({ error: "asaasPaymentId nao informado." });

      const sheet = await readSheetStore();
      const payment = sheet.pagamentos.find((p) => p.asaas_payment_id === asaasPaymentId || p.pagamento_id === asaasPaymentId);
      if (!payment) return res.status(404).json({ error: "Pagamento nao encontrado." });

      const status = normalizePaymentStatus(String(rawStatus));
      payment.status = status;
      if (status === "confirmado") payment.data_confirmacao = nowIso();

      const cliente = sheet.clientes.find((c) => c.cliente_id === payment.cliente_id);
      const plano = sheet.planos.find((p) => p.plano_id === payment.plano_id);
      if (!cliente || !plano) {
        await writeSheetStore(sheet);
        return res.status(200).json({ success: true, warning: "Pagamento atualizado sem cliente/plano correspondente." });
      }

      cliente.pagamento_status = status;
      if (status === "confirmado") {
        const creditos = Number(plano.creditos_inclusos || 0);
        const validadeDias = Number(plano.validade_dias || 0);
        cliente.creditos_disponiveis = Number(cliente.creditos_disponiveis || 0) + creditos;
        cliente.status_conta = "ativo";
        if (validadeDias > 0) cliente.validade_ate = addDays(nowIso(), validadeDias);
        cliente.data_ultimo_pagamento = today();
      } else if (status === "vencido" || status === "cancelado") {
        cliente.status_conta = "aguardando_pagamento";
      }

      await writeSheetStore(sheet);
      return res.json({ success: true, pagamentoStatus: status, account: buildAccountStatus(cliente) });
    } catch (e: any) {
      return res.status(500).json({ error: "Falha ao processar webhook.", details: e?.message });
    }
  });
}

export async function applyConsumption(params: {
  userEmail: string;
  modelName: string;
  questionCount: number;
  statusExecucao: "sucesso" | "falha";
  referencia?: string;
}) {
  const sheet = await readSheetStore();
  const cliente = sheet.clientes.find((c) => c.email.toLowerCase() === params.userEmail.toLowerCase());
  if (!cliente) return null;

  const consumed = Math.max(1, Number(params.questionCount || 1)) * CREDITS_PER_QUESTION;
  if (params.statusExecucao === "sucesso") {
    cliente.creditos_disponiveis = Math.max(0, Number(cliente.creditos_disponiveis || 0) - consumed);
    cliente.creditos_utilizados = Number(cliente.creditos_utilizados || 0) + consumed;
  }

  const consumo: ConsumoRow = {
    consumo_id: randomId("CS"),
    cliente_id: cliente.cliente_id,
    email: cliente.email,
    data_hora: nowIso(),
    tipo_geracao: "prova",
    quantidade_questoes: Number(params.questionCount || 0),
    creditos_consumidos: consumed,
    modelo_ia: params.modelName || "",
    tokens_input: 0,
    tokens_output: 0,
    custo_estimado: 0,
    status_execucao: params.statusExecucao,
    referencia: params.referencia || ""
  };
  sheet.consumo.push(consumo);
  await writeSheetStore(sheet);
  return { consumo, account: buildAccountStatus(cliente) };
}

export function getAuthFromRequest(req: AuthenticatedRequest) {
  return {
    user: req.authUser ? sanitizeUser(req.authUser) : null,
    cliente: req.authCliente || null
  };
}
