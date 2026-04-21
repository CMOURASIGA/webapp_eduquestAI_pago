import crypto from "crypto";
import fs from "fs";
import path from "path";
import type express from "express";

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

const LOGS_DIR = path.resolve(process.cwd(), "logs");
const AUTH_PATH = path.join(LOGS_DIR, "authStore.json");
const SHEET_PATH = path.join(LOGS_DIR, "sheetStore.json");
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const CREDITS_PER_QUESTION = Number(process.env.CREDITS_PER_QUESTION || 1);

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

function defaultSheetData(): SheetData {
  return {
    clientes: [],
    planos: [
      {
        plano_id: "PRE100",
        nome_plano: "Pacote 100 questoes",
        tipo_plano: "prepago",
        valor: 29.9,
        creditos_inclusos: 100,
        validade_dias: 365,
        serie: "geral",
        franquia_mensal: 0,
        ativo: "sim",
        descricao: "Pacote pre-pago com validade de 12 meses"
      },
      {
        plano_id: "PRE300",
        nome_plano: "Pacote 300 questoes",
        tipo_plano: "prepago",
        valor: 69.9,
        creditos_inclusos: 300,
        validade_dias: 365,
        serie: "geral",
        franquia_mensal: 0,
        ativo: "sim",
        descricao: "Pacote pre-pago com validade de 12 meses"
      },
      {
        plano_id: "ANUAL_5ANO",
        nome_plano: "Plano anual 5o ano",
        tipo_plano: "anual",
        valor: 297,
        creditos_inclusos: 0,
        validade_dias: 365,
        serie: "5o ano",
        franquia_mensal: 200,
        ativo: "sim",
        descricao: "Plano anual com franquia mensal"
      },
      {
        plano_id: "FREE20",
        nome_plano: "Voucher Free 20",
        tipo_plano: "voucher",
        valor: 0,
        creditos_inclusos: 20,
        validade_dias: 30,
        serie: "geral",
        franquia_mensal: 0,
        ativo: "sim",
        descricao: "Voucher promocional"
      }
    ],
    pagamentos: [],
    consumo: [],
    vouchers: [
      {
        voucher_id: "VC-0001",
        codigo: "FREE20",
        tipo: "gratuidade",
        valor_desconto: 0,
        percentual_desconto: 0,
        creditos_bonus: 20,
        gratuidade_total: "sim",
        limite_uso: 100,
        usos_realizados: 0,
        validade_ate: "2026-12-31",
        ativo: "sim",
        observacao: "Voucher de lancamento"
      }
    ]
  };
}

function readAuthStore(): AuthStore {
  const data = readJson<AuthStore>(AUTH_PATH, { users: [], sessions: [] });
  data.sessions = data.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
  writeJson(AUTH_PATH, data);
  return data;
}

function writeAuthStore(data: AuthStore) {
  writeJson(AUTH_PATH, data);
}

function readSheetStore(): SheetData {
  const data = readJson<SheetData>(SHEET_PATH, defaultSheetData());
  if (!data.planos || data.planos.length === 0) data.planos = defaultSheetData().planos;
  if (!data.clientes) data.clientes = [];
  if (!data.pagamentos) data.pagamentos = [];
  if (!data.consumo) data.consumo = [];
  if (!data.vouchers) data.vouchers = [];
  writeJson(SHEET_PATH, data);
  return data;
}

function writeSheetStore(data: SheetData) {
  writeJson(SHEET_PATH, data);
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

function ensureClienteForUser(user: AuthUser) {
  const sheet = readSheetStore();
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
      observacao: "Criado via cadastro local"
    };
    sheet.clientes.push(cliente);
    writeSheetStore(sheet);
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
    reasons.push("Pagamento pendente.");
  }

  return { canGenerate, reasons };
}

export interface AuthenticatedRequest extends express.Request {
  authUser?: AuthUser;
  authCliente?: ClienteRow;
}

export function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Token ausente." });
  const auth = readAuthStore();
  const session = auth.sessions.find((s) => s.token === token);
  if (!session) return res.status(401).json({ error: "Sessao invalida ou expirada." });
  const user = auth.users.find((u) => u.id === session.userId);
  if (!user) return res.status(401).json({ error: "Usuario da sessao nao encontrado." });
  req.authUser = user;
  req.authCliente = ensureClienteForUser(user);
  return next();
}

export function requireCanGenerate(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
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
  app.post("/api/auth/register", (req, res) => {
    try {
      const { name, email, password, role } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Campos obrigatorios: name, email, password." });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      const auth = readAuthStore();
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
      writeAuthStore(auth);

      const cliente = ensureClienteForUser(user);
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

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Campos obrigatorios: email, password." });
      }
      const auth = readAuthStore();
      const user = auth.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!user) return res.status(401).json({ error: "Credenciais invalidas." });
      const currentHash = hashPassword(String(password), user.passwordSalt);
      if (currentHash !== user.passwordHash) return res.status(401).json({ error: "Credenciais invalidas." });

      const session = createSession(user.id);
      auth.sessions.push(session);
      writeAuthStore(auth);
      const cliente = ensureClienteForUser(user);
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

  app.post("/api/auth/logout", requireAuth, (req: AuthenticatedRequest, res) => {
    const token = getToken(req);
    const auth = readAuthStore();
    auth.sessions = auth.sessions.filter((s) => s.token !== token);
    writeAuthStore(auth);
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

  app.get("/api/plans", (_req, res) => {
    const sheet = readSheetStore();
    return res.json({
      plans: sheet.planos.filter((p) => (p.ativo || "").toLowerCase() === "sim")
    });
  });

  app.post("/api/billing/create-checkout", requireAuth, (req: AuthenticatedRequest, res) => {
    const { planoId } = req.body || {};
    if (!planoId) return res.status(400).json({ error: "Campo obrigatorio: planoId." });

    const sheet = readSheetStore();
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
      origem: "local_checkout",
      descricao: `Checkout local para plano ${plano.plano_id}`
    };
    sheet.pagamentos.push(payment);

    cliente.plano_id = plano.plano_id;
    cliente.pagamento_status = "pendente";
    cliente.status_conta = "aguardando_pagamento";
    cliente.observacao = "Checkout criado, aguardando webhook";
    writeSheetStore(sheet);

    return res.json({
      success: true,
      checkout: {
        planoId: plano.plano_id,
        pagamentoId: payment.pagamento_id,
        asaasPaymentId: payment.asaas_payment_id,
        valor: payment.valor,
        // URL de simulacao local
        checkoutUrl: `/billing/mock-checkout?pagamento_id=${payment.pagamento_id}`
      }
    });
  });

  app.post("/api/billing/webhook/asaas", (req, res) => {
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

      const sheet = readSheetStore();
      const payment = sheet.pagamentos.find((p) => p.asaas_payment_id === asaasPaymentId || p.pagamento_id === asaasPaymentId);
      if (!payment) return res.status(404).json({ error: "Pagamento nao encontrado." });

      const status = normalizePaymentStatus(String(rawStatus));
      payment.status = status;
      if (status === "confirmado") payment.data_confirmacao = nowIso();

      const cliente = sheet.clientes.find((c) => c.cliente_id === payment.cliente_id);
      const plano = sheet.planos.find((p) => p.plano_id === payment.plano_id);
      if (!cliente || !plano) {
        writeSheetStore(sheet);
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

      writeSheetStore(sheet);
      return res.json({ success: true, pagamentoStatus: status, account: buildAccountStatus(cliente) });
    } catch (e: any) {
      return res.status(500).json({ error: "Falha ao processar webhook.", details: e?.message });
    }
  });
}

export function applyConsumption(params: {
  userEmail: string;
  modelName: string;
  questionCount: number;
  statusExecucao: "sucesso" | "falha";
  referencia?: string;
}) {
  const sheet = readSheetStore();
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
  writeSheetStore(sheet);
  return { consumo, account: buildAccountStatus(cliente) };
}

export function getAuthFromRequest(req: AuthenticatedRequest) {
  return {
    user: req.authUser ? sanitizeUser(req.authUser) : null,
    cliente: req.authCliente || null
  };
}

