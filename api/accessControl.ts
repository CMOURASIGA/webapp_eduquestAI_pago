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
  username: string;
  phone: string;
  role: Role;
  parentUserId: string;
  accountOwnerUserId: string;
  status: "ativo" | "cancelado";
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
  eventos_conta: EventoContaRow[];
}

interface EventoContaRow {
  evento_id: string;
  cliente_id: string;
  email: string;
  telefone: string;
  evento_tipo: string;
  status_anterior: string;
  status_novo: string;
  pagamento_status_anterior: string;
  pagamento_status_novo: string;
  plano_id: string;
  pagamento_id: string;
  detalhe: string;
  data_hora: string;
  actor_user_id: string;
}

interface AuthStore {
  users: AuthUser[];
  sessions: Session[];
}

const WRITABLE_ROOT = process.env.VERCEL ? "/tmp" : process.cwd();
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL);
const LOGS_DIR = path.resolve(WRITABLE_ROOT, "logs");
const AUTH_PATH = path.join(LOGS_DIR, "authStore.json");
const SHEET_PATH = path.join(LOGS_DIR, "sheetStore.json");
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const CREDITS_PER_QUESTION = Number(process.env.CREDITS_PER_QUESTION || 1);
const MIN_MANUAL_RELEASE_HOURS = Number(process.env.MIN_MANUAL_RELEASE_HOURS || 1);
const FREE_ONCE_PLAN_ID = process.env.FREE_ONCE_PLAN_ID || "FREE_ONCE";
const FREE_ONCE_VOUCHER_MARK = "FREE_ONCE_USED";
const FREE_ONCE_CREDITS = Number(process.env.FREE_ONCE_CREDITS || 40);
const FREE_ONCE_VALIDITY_DAYS = Number(process.env.FREE_ONCE_VALIDITY_DAYS || 7);
const DEFAULT_QUESTIONS_PER_EXAM = Number(process.env.DEFAULT_QUESTIONS_PER_EXAM || 40);
const ANNUAL_GENERAL_PLAN_ID = "ANUAL_GERAL";
const LEGACY_ANNUAL_PLAN_IDS = new Set(["ANUAL_5ANO"]);
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
  "id", "name", "email", "username", "phone", "role", "parent_user_id", "account_owner_user_id", "status", "password_hash", "password_salt", "created_at"
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
const EVENTOS_CONTA_HEADERS = [
  "evento_id", "cliente_id", "email", "telefone", "evento_tipo", "status_anterior", "status_novo",
  "pagamento_status_anterior", "pagamento_status_novo", "plano_id", "pagamento_id", "detalhe", "data_hora", "actor_user_id"
];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
let knownSheetTabs: Set<string> | null = null;
let knownSheetTabsLoadedAt = 0;
let loadingKnownSheetTabs: Promise<void> | null = null;

const SHEETS_TABS_CACHE_TTL_MS = Number(process.env.SHEETS_TABS_CACHE_TTL_MS || 5 * 60_000);
const STORE_CACHE_TTL_MS = Number(process.env.SHEETS_STORE_CACHE_TTL_MS || 60_000);
const SHEETS_METRICS_WINDOW_MS = Number(process.env.SHEETS_METRICS_WINDOW_MS || 60_000);

let sheetStoreCache: { data: SheetData; expiresAt: number } | null = null;
let sheetStoreReadInFlight: Promise<SheetData> | null = null;
let authStoreCache: { data: AuthStore; expiresAt: number } | null = null;
let authStoreReadInFlight: Promise<AuthStore> | null = null;

type SheetsCallKind = "read" | "write" | "meta";
interface SheetsOpStats {
  calls: number;
  errors: number;
  totalDurationMs: number;
}
interface SheetsMetricsBucket {
  calls: number;
  errors: number;
  readCalls: number;
  writeCalls: number;
  metaCalls: number;
  totalDurationMs: number;
  ops: Record<string, SheetsOpStats>;
}

let sheetsWindowStartedAt = Date.now();
let sheetsWindow: SheetsMetricsBucket = {
  calls: 0,
  errors: 0,
  readCalls: 0,
  writeCalls: 0,
  metaCalls: 0,
  totalDurationMs: 0,
  ops: {},
};
const sheetsLifetime: SheetsMetricsBucket = {
  calls: 0,
  errors: 0,
  readCalls: 0,
  writeCalls: 0,
  metaCalls: 0,
  totalDurationMs: 0,
  ops: {},
};
let sheetsLastErrorAt = "";
let sheetsLastErrorMessage = "";

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
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const raw = v.trim();
    if (!raw) return fallback;
    const compact = raw
      .replace(/\s+/g, "")
      .replace(/^R\$/i, "")
      .replace(/[^\d,.\-]/g, "");

    const hasComma = compact.includes(",");
    const hasDot = compact.includes(".");
    let normalized = compact;

    if (hasComma && hasDot) {
      const commaPos = compact.lastIndexOf(",");
      const dotPos = compact.lastIndexOf(".");
      normalized = commaPos > dotPos
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
    } else if (hasComma) {
      normalized = compact.replace(",", ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDateValue(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    const millis = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(millis);
    if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const raw = String(v).trim();
  if (!raw) return "";
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) {
      const millis = Math.round((asNum - 25569) * 86400 * 1000);
      const d = new Date(millis);
      if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return raw;
}

function defaultSheetData(): SheetData {
  return {
    clientes: [],
    planos: [
      { plano_id: "PRE100", nome_plano: "Pacote 100 questoes", tipo_plano: "prepago", valor: 29.9, creditos_inclusos: 100, validade_dias: 365, serie: "geral", franquia_mensal: 0, ativo: "sim", descricao: "Pacote pre-pago com validade de 12 meses" },
      { plano_id: "PRE300", nome_plano: "Pacote 300 questoes", tipo_plano: "prepago", valor: 69.9, creditos_inclusos: 300, validade_dias: 365, serie: "geral", franquia_mensal: 0, ativo: "sim", descricao: "Pacote pre-pago com validade de 12 meses" },
      { plano_id: ANNUAL_GENERAL_PLAN_ID, nome_plano: "Plano anual geral", tipo_plano: "anual", valor: 297, creditos_inclusos: 0, validade_dias: 365, serie: "geral", franquia_mensal: 200, ativo: "sim", descricao: "Plano anual com franquia mensal para qualquer serie" },
      { plano_id: FREE_ONCE_PLAN_ID, nome_plano: "Acesso gratuito inicial (1 execucao)", tipo_plano: "gratuito", valor: 0, creditos_inclusos: FREE_ONCE_CREDITS, validade_dias: FREE_ONCE_VALIDITY_DAYS, serie: "geral", franquia_mensal: 0, ativo: "sim", descricao: "Acesso unico gratuito por conta" },
      { plano_id: "FREE20", nome_plano: "Voucher Free 20", tipo_plano: "voucher", valor: 0, creditos_inclusos: 20, validade_dias: 30, serie: "geral", franquia_mensal: 0, ativo: "sim", descricao: "Voucher promocional" }
    ],
    pagamentos: [],
    consumo: [],
    vouchers: [
      { voucher_id: "VC-0001", codigo: "FREE20", tipo: "gratuidade", valor_desconto: 0, percentual_desconto: 0, creditos_bonus: 20, gratuidade_total: "sim", limite_uso: 100, usos_realizados: 0, validade_ate: "2026-12-31", ativo: "sim", observacao: "Voucher de lancamento" }
    ],
    eventos_conta: []
  };
}

function migrateLegacyAnnualPlan(data: SheetData) {
  const planIdMap: Record<string, string> = {};
  const hasGeneralAnnual = data.planos.some((p) => p.plano_id === ANNUAL_GENERAL_PLAN_ID);

  data.planos = data.planos
    .map((p) => {
      const isAnnual = String(p.tipo_plano || "").toLowerCase() === "anual";
      const isLegacyAnnualId = LEGACY_ANNUAL_PLAN_IDS.has(String(p.plano_id || "").toUpperCase());
      if (!isAnnual && !isLegacyAnnualId) return p;

      if (isLegacyAnnualId) planIdMap[p.plano_id] = ANNUAL_GENERAL_PLAN_ID;
      if (hasGeneralAnnual && isLegacyAnnualId) return null as any;

      return {
        ...p,
        plano_id: isLegacyAnnualId ? ANNUAL_GENERAL_PLAN_ID : p.plano_id,
        nome_plano: "Plano anual geral",
        serie: "geral",
        descricao: "Plano anual com franquia mensal para qualquer serie",
      };
    })
    .filter(Boolean);

  if (!hasGeneralAnnual && !data.planos.some((p) => p.plano_id === ANNUAL_GENERAL_PLAN_ID)) {
    data.planos.push({
      plano_id: ANNUAL_GENERAL_PLAN_ID,
      nome_plano: "Plano anual geral",
      tipo_plano: "anual",
      valor: 297,
      creditos_inclusos: 0,
      validade_dias: 365,
      serie: "geral",
      franquia_mensal: 200,
      ativo: "sim",
      descricao: "Plano anual com franquia mensal para qualquer serie",
    });
  }

  if (Object.keys(planIdMap).length > 0) {
    data.clientes = data.clientes.map((c) => ({
      ...c,
      plano_id: planIdMap[c.plano_id] || c.plano_id,
    }));
    data.pagamentos = data.pagamentos.map((p) => ({
      ...p,
      plano_id: planIdMap[p.plano_id] || p.plano_id,
    }));
    data.eventos_conta = (data.eventos_conta || []).map((e) => ({
      ...e,
      plano_id: planIdMap[e.plano_id] || e.plano_id,
    }));
  }
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

function nextSheetsWindowIfNeeded(nowMs: number) {
  if ((nowMs - sheetsWindowStartedAt) < SHEETS_METRICS_WINDOW_MS) return;
  sheetsWindowStartedAt = nowMs;
  sheetsWindow = {
    calls: 0,
    errors: 0,
    readCalls: 0,
    writeCalls: 0,
    metaCalls: 0,
    totalDurationMs: 0,
    ops: {},
  };
}

function incKindCounter(bucket: SheetsMetricsBucket, kind: SheetsCallKind) {
  if (kind === "read") bucket.readCalls += 1;
  else if (kind === "write") bucket.writeCalls += 1;
  else bucket.metaCalls += 1;
}

function recordSheetsCall(params: {
  op: string;
  kind: SheetsCallKind;
  durationMs: number;
  error?: any;
}) {
  const nowMs = Date.now();
  nextSheetsWindowIfNeeded(nowMs);

  const targets = [sheetsWindow, sheetsLifetime];
  targets.forEach((bucket) => {
    bucket.calls += 1;
    bucket.totalDurationMs += params.durationMs;
    incKindCounter(bucket, params.kind);
    const opStats = bucket.ops[params.op] || { calls: 0, errors: 0, totalDurationMs: 0 };
    opStats.calls += 1;
    opStats.totalDurationMs += params.durationMs;
    if (params.error) {
      bucket.errors += 1;
      opStats.errors += 1;
    }
    bucket.ops[params.op] = opStats;
  });

  if (params.error) {
    sheetsLastErrorAt = new Date(nowMs).toISOString();
    sheetsLastErrorMessage = String(params.error?.message || params.error || "erro desconhecido");
  }
}

async function runSheetsCall<T>(op: string, kind: SheetsCallKind, fn: () => Promise<T>) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    recordSheetsCall({ op, kind, durationMs: Date.now() - startedAt });
    return result;
  } catch (error: any) {
    recordSheetsCall({ op, kind, durationMs: Date.now() - startedAt, error });
    throw error;
  }
}

function cloneBucket(bucket: SheetsMetricsBucket) {
  const ops: Record<string, { calls: number; errors: number; avgDurationMs: number }> = {};
  Object.keys(bucket.ops).forEach((op) => {
    const value = bucket.ops[op];
    ops[op] = {
      calls: value.calls,
      errors: value.errors,
      avgDurationMs: value.calls > 0 ? Number((value.totalDurationMs / value.calls).toFixed(2)) : 0,
    };
  });
  return {
    calls: bucket.calls,
    errors: bucket.errors,
    readCalls: bucket.readCalls,
    writeCalls: bucket.writeCalls,
    metaCalls: bucket.metaCalls,
    avgDurationMs: bucket.calls > 0 ? Number((bucket.totalDurationMs / bucket.calls).toFixed(2)) : 0,
    ops,
  };
}

export function getGoogleSheetsMetrics() {
  nextSheetsWindowIfNeeded(Date.now());
  return {
    windowStartedAt: new Date(sheetsWindowStartedAt).toISOString(),
    windowMs: SHEETS_METRICS_WINDOW_MS,
    window: cloneBucket(sheetsWindow),
    lifetime: cloneBucket(sheetsLifetime),
    lastErrorAt: sheetsLastErrorAt || null,
    lastErrorMessage: sheetsLastErrorMessage || null,
  };
}

function cloneSheetData(data: SheetData): SheetData {
  return JSON.parse(JSON.stringify(data));
}

function cloneAuthStore(data: AuthStore): AuthStore {
  return JSON.parse(JSON.stringify(data));
}

async function refreshKnownSheetTabs(force = false) {
  const cacheFresh = knownSheetTabs && (Date.now() - knownSheetTabsLoadedAt) < SHEETS_TABS_CACHE_TTL_MS;
  if (!force && cacheFresh) return;
  if (loadingKnownSheetTabs) {
    await loadingKnownSheetTabs;
    return;
  }
  loadingKnownSheetTabs = (async () => {
    const client = getSheetsClient();
    const spreadsheet = await runSheetsCall("spreadsheets.get.tabs", "meta", () => client.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      fields: "sheets.properties.title",
    }));
    knownSheetTabs = new Set(
      (spreadsheet.data.sheets || [])
        .map((s: any) => String(s?.properties?.title || ""))
        .filter(Boolean)
    );
    knownSheetTabsLoadedAt = Date.now();
  })();
  try {
    await loadingKnownSheetTabs;
  } finally {
    loadingKnownSheetTabs = null;
  }
}

async function ensureTabsExist(tabNames: string[]) {
  await refreshKnownSheetTabs();
  const existing = knownSheetTabs || new Set<string>();

  const missing = tabNames.filter((t) => !existing.has(t));
  if (missing.length === 0) return;

  const client = getSheetsClient();
  await runSheetsCall("spreadsheets.batchUpdate.addSheet", "write", () => client.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
    },
  }));
  missing.forEach((t) => existing.add(t));
  knownSheetTabs = existing;
  knownSheetTabsLoadedAt = Date.now();
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
  const response = await runSheetsCall("spreadsheets.values.get", "read", () => client.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tabName}!A1:ZZ`,
    valueRenderOption: "UNFORMATTED_VALUE",
  }));
  const values = response.data.values || [];
  if (values.length === 0) return [] as Record<string, any>[];

  const sourceHeaders = (values[0] || []).map((v) => String(v).trim());
  const effectiveHeaders = sourceHeaders.length > 0 ? sourceHeaders : headers;

  return values.slice(1)
    .filter((r) => r.some((c) => String(c || "").trim() !== ""))
    .map((r) => rowToObj(effectiveHeaders, r));
}

async function readTabsBatch(tabConfigs: Array<{ tabName: string; headers: string[] }>) {
  if (tabConfigs.length === 0) return {} as Record<string, Record<string, any>[]>;
  await ensureTabsExist(tabConfigs.map((t) => t.tabName));
  const client = getSheetsClient();
  const response = await runSheetsCall("spreadsheets.values.batchGet", "read", () => client.spreadsheets.values.batchGet({
    spreadsheetId: GOOGLE_SHEET_ID,
    ranges: tabConfigs.map((t) => `${t.tabName}!A1:ZZ`),
    valueRenderOption: "UNFORMATTED_VALUE",
  }));
  const valueRanges = response.data.valueRanges || [];
  const result: Record<string, Record<string, any>[]> = {};

  tabConfigs.forEach((cfg, index) => {
    const values = (valueRanges[index]?.values || []) as any[][];
    if (values.length === 0) {
      result[cfg.tabName] = [];
      return;
    }
    const sourceHeaders = (values[0] || []).map((v) => String(v).trim());
    const effectiveHeaders = sourceHeaders.length > 0 ? sourceHeaders : cfg.headers;
    result[cfg.tabName] = values
      .slice(1)
      .filter((r) => r.some((c) => String(c || "").trim() !== ""))
      .map((r) => rowToObj(effectiveHeaders, r));
  });

  return result;
}

async function writeTab(tabName: string, headers: string[], rows: Record<string, any>[]) {
  await ensureTabsExist([tabName]);
  const client = getSheetsClient();

  await runSheetsCall("spreadsheets.values.clear", "write", () => client.spreadsheets.values.clear({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tabName}!A:ZZ`,
  }));

  const values = [headers, ...rows.map((r) => objToRow(headers, r))];
  await runSheetsCall("spreadsheets.values.update", "write", () => client.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  }));
}

async function readSheetStoreGoogle(): Promise<SheetData> {
  const tabs = await readTabsBatch([
    { tabName: "clientes", headers: CLIENTES_HEADERS },
    { tabName: "planos", headers: PLANOS_HEADERS },
    { tabName: "pagamentos", headers: PAGAMENTOS_HEADERS },
    { tabName: "consumo", headers: CONSUMO_HEADERS },
    { tabName: "vouchers", headers: VOUCHERS_HEADERS },
    { tabName: "eventos_conta", headers: EVENTOS_CONTA_HEADERS },
  ]);
  const clientesRaw = tabs.clientes || [];
  const planosRaw = tabs.planos || [];
  const pagamentosRaw = tabs.pagamentos || [];
  const consumoRaw = tabs.consumo || [];
  const vouchersRaw = tabs.vouchers || [];
  const eventosContaRaw = tabs.eventos_conta || [];

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
      validade_ate: normalizeDateValue(r.validade_ate),
      pagamento_status: String(r.pagamento_status || ""),
      voucher_codigo: String(r.voucher_codigo || ""),
      data_cadastro: normalizeDateValue(r.data_cadastro),
      data_ultimo_pagamento: normalizeDateValue(r.data_ultimo_pagamento),
      observacao: String(r.observacao || ""),
    })),
    planos: planosRaw.map((r) => {
      const tipoPlano = String(r.tipo_plano || "");
      const annualAsGeneral = tipoPlano.toLowerCase() === "anual";
      return {
        plano_id: String(r.plano_id || ""),
        nome_plano: String(r.nome_plano || ""),
        tipo_plano: tipoPlano,
        valor: toNumber(r.valor),
        creditos_inclusos: toNumber(r.creditos_inclusos),
        validade_dias: toNumber(r.validade_dias),
        serie: annualAsGeneral ? "geral" : String(r.serie || ""),
        franquia_mensal: toNumber(r.franquia_mensal),
        ativo: String(r.ativo || ""),
        descricao: String(r.descricao || ""),
      };
    }),
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
      data_criacao: normalizeDateValue(r.data_criacao),
      data_confirmacao: normalizeDateValue(r.data_confirmacao),
      origem: String(r.origem || ""),
      descricao: String(r.descricao || ""),
    })),
    consumo: consumoRaw.map((r) => ({
      consumo_id: String(r.consumo_id || ""),
      cliente_id: String(r.cliente_id || ""),
      email: String(r.email || ""),
      data_hora: normalizeDateValue(r.data_hora),
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
      validade_ate: normalizeDateValue(r.validade_ate),
      ativo: String(r.ativo || ""),
      observacao: String(r.observacao || ""),
    })),
    eventos_conta: eventosContaRaw.map((r) => ({
      evento_id: String(r.evento_id || ""),
      cliente_id: String(r.cliente_id || ""),
      email: String(r.email || ""),
      telefone: String(r.telefone || ""),
      evento_tipo: String(r.evento_tipo || ""),
      status_anterior: String(r.status_anterior || ""),
      status_novo: String(r.status_novo || ""),
      pagamento_status_anterior: String(r.pagamento_status_anterior || ""),
      pagamento_status_novo: String(r.pagamento_status_novo || ""),
      plano_id: String(r.plano_id || ""),
      pagamento_id: String(r.pagamento_id || ""),
      detalhe: String(r.detalhe || ""),
      data_hora: normalizeDateValue(r.data_hora),
      actor_user_id: String(r.actor_user_id || ""),
    })),
  };

  if (data.planos.length === 0) data.planos = defaultSheetData().planos;
  migrateLegacyAnnualPlan(data);
  return data;
}

export async function diagnoseGoogleSheetsPersistence() {
  const configured = canUseGoogleSheets();
  if (!configured) {
    return {
      configured: false,
      mode: IS_VERCEL_RUNTIME ? "misconfigured_no_persistent_store" : "local_file",
      ok: !IS_VERCEL_RUNTIME,
      error: IS_VERCEL_RUNTIME ? "GOOGLE_SHEET_ID/GOOGLE_SERVICE_ACCOUNT_JSON ausentes." : "",
    };
  }

  try {
    await readAuthStoreGoogle();
    await readSheetStoreGoogle();
    return {
      configured: true,
      mode: "google_sheets",
      ok: true,
      error: "",
    };
  } catch (e: any) {
    return {
      configured: true,
      mode: "google_sheets",
      ok: false,
      error: String(e?.message || e || "Falha ao conectar no Google Sheets."),
    };
  }
}

async function writeSheetStoreGoogle(data: SheetData) {
  await writeTab("clientes", CLIENTES_HEADERS, data.clientes as any[]);
  await writeTab("planos", PLANOS_HEADERS, data.planos as any[]);
  await writeTab("pagamentos", PAGAMENTOS_HEADERS, data.pagamentos as any[]);
  await writeTab("consumo", CONSUMO_HEADERS, data.consumo as any[]);
  await writeTab("vouchers", VOUCHERS_HEADERS, data.vouchers as any[]);
  await writeTab("eventos_conta", EVENTOS_CONTA_HEADERS, data.eventos_conta as any[]);
}

async function readAuthStoreGoogle(): Promise<AuthStore> {
  const tabs = await readTabsBatch([
    { tabName: "auth_users", headers: AUTH_USERS_HEADERS },
    { tabName: "auth_sessions", headers: AUTH_SESSIONS_HEADERS },
  ]);
  const usersRaw = tabs.auth_users || [];
  const sessionsRaw = tabs.auth_sessions || [];

  return {
    users: usersRaw.map((r) => ({
      id: String(r.id || ""),
      name: String(r.name || ""),
      email: String(r.email || "").toLowerCase(),
      username: String(r.username || "").trim().toLowerCase(),
      phone: String(r.phone || ""),
      role: String(r.role || "").toLowerCase() === "aluno" ? "aluno" : "professor",
      parentUserId: String(r.parent_user_id || ""),
      accountOwnerUserId: String(r.account_owner_user_id || "") || String(r.parent_user_id || "") || String(r.id || ""),
      status: String(r.status || "").toLowerCase() === "cancelado" ? "cancelado" : "ativo",
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
    username: u.username || "",
    phone: u.phone || "",
    role: u.role,
    parent_user_id: u.parentUserId || "",
    account_owner_user_id: u.accountOwnerUserId || u.id,
    status: u.status || "ativo",
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
  if (!data.eventos_conta) data.eventos_conta = [];

  data.clientes = data.clientes.map((c) => ({
    ...c,
    creditos_disponiveis: toNumber((c as any).creditos_disponiveis),
    creditos_utilizados: toNumber((c as any).creditos_utilizados),
    validade_ate: normalizeDateValue((c as any).validade_ate),
    data_cadastro: normalizeDateValue((c as any).data_cadastro),
    data_ultimo_pagamento: normalizeDateValue((c as any).data_ultimo_pagamento),
  }));
  data.planos = data.planos.map((p) => ({
    ...p,
    valor: toNumber((p as any).valor),
    creditos_inclusos: toNumber((p as any).creditos_inclusos),
    validade_dias: toNumber((p as any).validade_dias),
    franquia_mensal: toNumber((p as any).franquia_mensal),
  }));
  data.pagamentos = data.pagamentos.map((p) => ({
    ...p,
    valor: toNumber((p as any).valor),
    data_criacao: normalizeDateValue((p as any).data_criacao),
    data_confirmacao: normalizeDateValue((p as any).data_confirmacao),
  }));
  data.vouchers = data.vouchers.map((v) => ({
    ...v,
    valor_desconto: toNumber((v as any).valor_desconto),
    percentual_desconto: toNumber((v as any).percentual_desconto),
    creditos_bonus: toNumber((v as any).creditos_bonus),
    limite_uso: toNumber((v as any).limite_uso),
    usos_realizados: toNumber((v as any).usos_realizados),
    validade_ate: normalizeDateValue((v as any).validade_ate),
  }));
  data.eventos_conta = data.eventos_conta.map((e) => ({
    ...e,
    data_hora: normalizeDateValue((e as any).data_hora),
  }));
  migrateLegacyAnnualPlan(data);

  writeJson(SHEET_PATH, data);
  return data;
}

function writeSheetStoreLocal(data: SheetData) {
  writeJson(SHEET_PATH, data);
}

async function readSheetStore(options?: { forceFresh?: boolean }): Promise<SheetData> {
  const forceFresh = Boolean(options?.forceFresh);
  if (!canUseGoogleSheets()) {
    if (IS_VERCEL_RUNTIME) {
      throw new Error("Persistencia obrigatoria nao configurada no Vercel. Defina GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_JSON.");
    }
    return readSheetStoreLocal();
  }

  if (forceFresh) {
    try {
      const data = await readSheetStoreGoogle();
      sheetStoreCache = {
        data: cloneSheetData(data),
        expiresAt: Date.now() + STORE_CACHE_TTL_MS,
      };
      return cloneSheetData(data);
    } catch (e) {
      if (IS_VERCEL_RUNTIME) {
        console.error("Falha ao ler Google Sheets forcando refresh no Vercel (sem fallback local):", e);
        throw e;
      }
      console.error("Falha ao ler Google Sheets forcando refresh. Usando fallback local:", e);
      return readSheetStoreLocal();
    }
  }

  const cached = sheetStoreCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cloneSheetData(cached.data);
  }
  if (sheetStoreReadInFlight) {
    const data = await sheetStoreReadInFlight;
    return cloneSheetData(data);
  }

  sheetStoreReadInFlight = (async () => {
    try {
      const data = await readSheetStoreGoogle();
      sheetStoreCache = {
        data: cloneSheetData(data),
        expiresAt: Date.now() + STORE_CACHE_TTL_MS,
      };
      return data;
    } finally {
      sheetStoreReadInFlight = null;
    }
  })();

  try {
    const data = await sheetStoreReadInFlight;
    return cloneSheetData(data);
  } catch (e) {
    if (IS_VERCEL_RUNTIME) {
      console.error("Falha ao ler Google Sheets no Vercel (sem fallback local):", e);
      throw e;
    }
    console.error("Falha ao ler Google Sheets. Usando fallback local:", e);
    return readSheetStoreLocal();
  }
}

async function writeSheetStore(data: SheetData) {
  if (!canUseGoogleSheets()) {
    if (IS_VERCEL_RUNTIME) {
      throw new Error("Persistencia obrigatoria nao configurada no Vercel. Defina GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_JSON.");
    }
    writeSheetStoreLocal(data);
    return;
  }
  try {
    await writeSheetStoreGoogle(data);
    sheetStoreCache = {
      data: cloneSheetData(data),
      expiresAt: Date.now() + STORE_CACHE_TTL_MS,
    };
  } catch (e) {
    if (IS_VERCEL_RUNTIME) {
      console.error("Falha ao gravar Google Sheets no Vercel (sem fallback local):", e);
      throw e;
    }
    console.error("Falha ao gravar Google Sheets. Gravando fallback local:", e);
    writeSheetStoreLocal(data);
  }
}

async function readAuthStore(): Promise<AuthStore> {
  let data: AuthStore;
  if (!canUseGoogleSheets()) {
    if (IS_VERCEL_RUNTIME) {
      throw new Error("Persistencia de autenticacao obrigatoria no Vercel. Defina GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_JSON.");
    }
    data = readAuthStoreLocal();
  } else {
    try {
      const cached = authStoreCache;
      if (cached && cached.expiresAt > Date.now()) {
        data = cloneAuthStore(cached.data);
      } else if (authStoreReadInFlight) {
        data = cloneAuthStore(await authStoreReadInFlight);
      } else {
        authStoreReadInFlight = (async () => {
          try {
            const fresh = await readAuthStoreGoogle();
            authStoreCache = {
              data: cloneAuthStore(fresh),
              expiresAt: Date.now() + STORE_CACHE_TTL_MS,
            };
            return fresh;
          } finally {
            authStoreReadInFlight = null;
          }
        })();
        data = cloneAuthStore(await authStoreReadInFlight);
      }
    } catch (e) {
      if (IS_VERCEL_RUNTIME) {
        console.error("Falha ao ler auth no Google Sheets no Vercel (sem fallback local):", e);
        throw e;
      }
      console.error("Falha ao ler auth no Google Sheets. Usando fallback local:", e);
      data = readAuthStoreLocal();
    }
  }

  data = normalizeAuthStoreData(data);

  const filtered = data.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
  if (filtered.length !== data.sessions.length) {
    data.sessions = filtered;
    await writeAuthStore(data);
  }
  return data;
}

async function writeAuthStore(data: AuthStore) {
  if (!canUseGoogleSheets()) {
    if (IS_VERCEL_RUNTIME) {
      throw new Error("Persistencia de autenticacao obrigatoria no Vercel. Defina GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_JSON.");
    }
    writeAuthStoreLocal(data);
    return;
  }
  try {
    await writeAuthStoreGoogle(data);
    authStoreCache = {
      data: cloneAuthStore(data),
      expiresAt: Date.now() + STORE_CACHE_TTL_MS,
    };
  } catch (e) {
    if (IS_VERCEL_RUNTIME) {
      console.error("Falha ao gravar auth no Google Sheets no Vercel (sem fallback local):", e);
      throw e;
    }
    console.error("Falha ao gravar auth no Google Sheets. Gravando fallback local:", e);
    writeAuthStoreLocal(data);
  }
}

function hashPassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

async function ensureClienteForUser(user: AuthUser, accountOwner?: AuthUser, loadedSheet?: SheetData) {
  const owner = accountOwner || user;
  const sheet = loadedSheet || await readSheetStore();
  let cliente = sheet.clientes.find((c) => c.email.toLowerCase() === owner.email.toLowerCase());
  if (!cliente) {
    cliente = {
      cliente_id: randomId("CL"),
      nome: owner.name,
      email: owner.email,
      telefone: normalizePhone(owner.phone || ""),
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
  } else if (!cliente.telefone && owner.phone) {
    cliente.telefone = normalizePhone(owner.phone);
    await writeSheetStore(sheet);
  }
  return cliente;
}

export interface AuthenticatedRequest extends express.Request {
  authUser?: AuthUser;
  authOwnerUser?: AuthUser;
  authCliente?: ClienteRow;
  authSheet?: SheetData;
}

export async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Token ausente." });
  const auth = await readAuthStore();
  const session = auth.sessions.find((s) => s.token === token);
  if (!session) return res.status(401).json({ error: "Sessao invalida ou expirada." });
  const user = auth.users.find((u) => u.id === session.userId);
  if (!user) return res.status(401).json({ error: "Usuario da sessao nao encontrado." });
  if (user.status === "cancelado") return res.status(403).json({ error: "Conta cancelada. Contrate um plano para reativar." });
  const ownerUser = auth.users.find((u) => u.id === (user.accountOwnerUserId || user.id)) || user;
  req.authUser = user;
  req.authOwnerUser = ownerUser;

  const sheet = await readSheetStore();
  req.authSheet = sheet;
  req.authCliente = await ensureClienteForUser(user, ownerUser, sheet);
  return next();
}

export async function requireCanGenerate(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const cliente = req.authCliente;
  if (!cliente) return res.status(401).json({ error: "Cliente nao encontrado para sessao atual." });
  const sheet = req.authSheet || await readSheetStore();
  let check = canGenerateFromCliente(cliente, sheet);
  if (!check.canGenerate) {
    try {
      // Revalida com leitura fresca para evitar falso bloqueio apos checkout/cancelamento recente.
      const freshSheet = await readSheetStore({ forceFresh: true });
      const freshCliente = freshSheet.clientes.find((c) =>
        c.cliente_id === cliente.cliente_id ||
        c.email.toLowerCase() === cliente.email.toLowerCase()
      );
      if (freshCliente) {
        const freshCheck = canGenerateFromCliente(freshCliente, freshSheet);
        if (freshCheck.canGenerate) {
          req.authSheet = freshSheet;
          req.authCliente = freshCliente;
          return next();
        }
        check = freshCheck;
        return res.status(402).json({
          error: "Conta sem permissao para gerar conteudo.",
          reasons: check.reasons,
          account: buildAccountStatus(freshCliente, freshSheet)
        });
      }
    } catch (e) {
      console.error("Falha na revalidacao fresca de permissao para gerar:", e);
    }
    return res.status(402).json({
      error: "Conta sem permissao para gerar conteudo.",
      reasons: check.reasons,
      account: buildAccountStatus(cliente, sheet)
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

function normalizePhone(phone: string) {
  return String(phone || "").replace(/\D+/g, "");
}

function normalizeAuthStoreData(data: AuthStore): AuthStore {
  return {
    users: (data.users || []).map((u: any) => ({
      id: String(u.id || ""),
      name: String(u.name || ""),
      email: String(u.email || "").trim().toLowerCase(),
      username: String(u.username || "").trim().toLowerCase(),
      phone: normalizePhone(String(u.phone || "")),
      role: String(u.role || "").toLowerCase() === "aluno" ? "aluno" : "professor",
      parentUserId: String(u.parentUserId || u.parent_user_id || ""),
      accountOwnerUserId: String(u.accountOwnerUserId || u.account_owner_user_id || u.parentUserId || u.parent_user_id || u.id || ""),
      status: String(u.status || "").toLowerCase() === "cancelado" ? "cancelado" : "ativo",
      passwordHash: String(u.passwordHash || u.password_hash || ""),
      passwordSalt: String(u.passwordSalt || u.password_salt || ""),
      createdAt: String(u.createdAt || u.created_at || nowIso()),
    })),
    sessions: (data.sessions || []).map((s: any) => ({
      token: String(s.token || ""),
      userId: String(s.userId || s.user_id || ""),
      createdAt: String(s.createdAt || s.created_at || nowIso()),
      expiresAt: String(s.expiresAt || s.expires_at || nowIso()),
    })),
  };
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
  return { id: user.id, name: user.name, email: user.email, username: user.username || "", role: user.role, accountOwnerUserId: user.accountOwnerUserId };
}

function findPlanForCliente(sheet: SheetData, cliente: ClienteRow) {
  if (!cliente.plano_id) return null;
  return sheet.planos.find((p) => p.plano_id === cliente.plano_id) || null;
}

function findLastConfirmedPlanIdForCliente(sheet: SheetData, clienteId: string) {
  const lastConfirmed = sheet.pagamentos
    .filter((p) => p.cliente_id === clienteId && normalizePaymentStatus(String(p.status)) === "confirmado" && String(p.plano_id || "").trim() !== "")
    .sort((a, b) => {
      const aDate = new Date(a.data_confirmacao || a.data_criacao || 0).getTime();
      const bDate = new Date(b.data_confirmacao || b.data_criacao || 0).getTime();
      return bDate - aDate;
    })[0];
  return lastConfirmed?.plano_id || "";
}

function isClienteExpired(cliente: ClienteRow) {
  if (!cliente.validade_ate) return false;
  return new Date(cliente.validade_ate).getTime() < new Date(today()).getTime();
}

function getMaxQuestionsPerExam(sheet: SheetData, cliente: ClienteRow) {
  const plan = findPlanForCliente(sheet, cliente);
  if (!plan) return DEFAULT_QUESTIONS_PER_EXAM;
  const tipo = String(plan.tipo_plano || "").toLowerCase();
  if (tipo !== "voucher") return DEFAULT_QUESTIONS_PER_EXAM;
  const planLimit = Number(plan.creditos_inclusos || 0) > 0 ? Number(plan.creditos_inclusos || 0) : 20;
  return Math.max(1, Math.min(DEFAULT_QUESTIONS_PER_EXAM, planLimit));
}

function appendAccountEvent(sheet: SheetData, params: {
  cliente: ClienteRow;
  actorUserId: string;
  eventType: string;
  statusBefore?: string;
  statusAfter?: string;
  paymentStatusBefore?: string;
  paymentStatusAfter?: string;
  planId?: string;
  paymentId?: string;
  detail?: string;
}) {
  sheet.eventos_conta.push({
    evento_id: randomId("EVT"),
    cliente_id: params.cliente.cliente_id,
    email: params.cliente.email,
    telefone: normalizePhone(params.cliente.telefone || ""),
    evento_tipo: params.eventType,
    status_anterior: params.statusBefore || params.cliente.status_conta || "",
    status_novo: params.statusAfter || params.cliente.status_conta || "",
    pagamento_status_anterior: params.paymentStatusBefore || params.cliente.pagamento_status || "",
    pagamento_status_novo: params.paymentStatusAfter || params.cliente.pagamento_status || "",
    plano_id: params.planId || params.cliente.plano_id || "",
    pagamento_id: params.paymentId || "",
    detalhe: params.detail || "",
    data_hora: nowIso(),
    actor_user_id: params.actorUserId || "",
  });
}

function canGenerateFromCliente(cliente: ClienteRow, sheet?: SheetData) {
  const allowedStatuses = new Set(["ativo", "gratuito", "voucher"]);
  const reasons: string[] = [];
  let canGenerate = true;

  if (!allowedStatuses.has((cliente.status_conta || "").toLowerCase())) {
    canGenerate = false;
    reasons.push("Conta nao esta ativa para uso.");
  }

  if (isClienteExpired(cliente)) {
    canGenerate = false;
    reasons.push("Conta expirada.");
  }

  if ((cliente.creditos_disponiveis || 0) <= 0) {
    canGenerate = false;
    reasons.push("Sem creditos disponiveis.");
  }

  if (
    (cliente.pagamento_status || "").toLowerCase() === "pendente" &&
    (cliente.status_conta || "").toLowerCase() === "aguardando_pagamento"
  ) {
    canGenerate = false;
    reasons.push(`Pagamento em analise manual. A liberacao pode levar no minimo ${MIN_MANUAL_RELEASE_HOURS} hora(s).`);
  }

  return { canGenerate, reasons };
}


function hasUsedFreeOnce(cliente: ClienteRow) {
  return String(cliente.voucher_codigo || "")
    .split(";")
    .map((v) => v.trim().toUpperCase())
    .includes(FREE_ONCE_VOUCHER_MARK);
}

function hasCancelledBefore(cliente: ClienteRow) {
  return String(cliente.status_conta || "").toLowerCase() === "cancelado";
}

function canActivateFreeByIdentity(sheet: SheetData, cliente: ClienteRow) {
  if (hasUsedFreeOnce(cliente)) return { allowed: false, reason: "Acesso gratuito inicial ja utilizado nesta conta." };
  if (hasCancelledBefore(cliente)) return { allowed: false, reason: "Conta cancelada anteriormente. Plano pago obrigatorio para reativar." };
  if (Number(cliente.creditos_disponiveis || 0) > 0 && (cliente.status_conta || "").toLowerCase() === "ativo") {
    return { allowed: false, reason: "Conta ja possui creditos/plano ativo." };
  }

  const normalizedEmail = String(cliente.email || "").trim().toLowerCase();
  const normalizedPhone = normalizePhone(String(cliente.telefone || ""));
  const duplicateIdentity = sheet.clientes.find((other) => {
    if (other.cliente_id === cliente.cliente_id) return false;
    const sameEmail = String(other.email || "").trim().toLowerCase() === normalizedEmail;
    const samePhone = normalizedPhone && normalizePhone(other.telefone || "") === normalizedPhone;
    if (!sameEmail && !samePhone) return false;
    return hasUsedFreeOnce(other) || hasCancelledBefore(other);
  });
  if (duplicateIdentity) {
    return {
      allowed: false,
      reason: "Identidade ja utilizou gratuito ou teve conta cancelada (email/telefone). Plano pago obrigatorio."
    };
  }
  return { allowed: true, reason: "" };
}

function ensureFreeOncePlan(sheet: SheetData) {
  const exists = sheet.planos.some((p) => p.plano_id === FREE_ONCE_PLAN_ID);
  if (exists) return;
  sheet.planos.push({
    plano_id: FREE_ONCE_PLAN_ID,
    nome_plano: "Acesso gratuito inicial (1 execucao)",
    tipo_plano: "gratuito",
    valor: 0,
    creditos_inclusos: FREE_ONCE_CREDITS,
    validade_dias: FREE_ONCE_VALIDITY_DAYS,
    serie: "geral",
    franquia_mensal: 0,
    ativo: "sim",
    descricao: "Acesso unico gratuito por conta"
  });
}

function appendVoucherMark(cliente: ClienteRow, mark: string) {
  const current = String(cliente.voucher_codigo || "").trim();
  if (!current) {
    cliente.voucher_codigo = mark;
    return;
  }
  const parts = current.split(";").map((v) => v.trim()).filter(Boolean);
  if (parts.map((v) => v.toUpperCase()).includes(mark.toUpperCase())) return;
  parts.push(mark);
  cliente.voucher_codigo = parts.join(";");
}

function buildAccountStatus(cliente: ClienteRow, sheet?: SheetData) {
  const effectiveSheet = sheet;
  const check = canGenerateFromCliente(cliente, effectiveSheet);
  const freeEligibility = effectiveSheet ? canActivateFreeByIdentity(effectiveSheet, cliente) : { allowed: !hasUsedFreeOnce(cliente), reason: "" };
  const maxQuestionsPerExam = effectiveSheet ? getMaxQuestionsPerExam(effectiveSheet, cliente) : DEFAULT_QUESTIONS_PER_EXAM;
  return {
    statusConta: cliente.status_conta,
    tipoAcesso: cliente.tipo_acesso,
    planoId: cliente.plano_id,
    creditosDisponiveis: Number(cliente.creditos_disponiveis || 0),
    creditosUtilizados: Number(cliente.creditos_utilizados || 0),
    validadeAte: cliente.validade_ate || null,
    pagamentoStatus: cliente.pagamento_status,
    freeOnceUsed: hasUsedFreeOnce(cliente),
    canActivateFreeOnce: freeEligibility.allowed,
    freeOnceBlockReason: freeEligibility.allowed ? null : freeEligibility.reason,
    maxQuestionsPerExam,
    canGenerate: check.canGenerate,
    blockReasons: check.reasons
  };
}

function findUserByLogin(auth: AuthStore, login: string) {
  const normalized = String(login || "").trim().toLowerCase();
  return auth.users.find((u) => {
    if (u.status !== "ativo") return false;
    return u.email.toLowerCase() === normalized || (u.username || "").toLowerCase() === normalized;
  });
}

function isOwnerUser(user: AuthUser) {
  return (user.accountOwnerUserId || user.id) === user.id;
}

export function registerAccessControlRoutes(app: express.Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password, phone } = req.body || {};
      if (!name || !email || !password || !phone) {
        return res.status(400).json({ error: "Campos obrigatorios: name, email, password, phone." });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
      }
      const normalizedPhone = normalizePhone(String(phone));
      if (normalizedPhone.length < 10) {
        return res.status(400).json({ error: "Telefone invalido. Informe DDD + numero." });
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
        username: "",
        phone: normalizedPhone,
        role: "professor",
        parentUserId: "",
        accountOwnerUserId: "",
        status: "ativo",
        passwordHash: hashPassword(String(password), salt),
        passwordSalt: salt,
        createdAt: nowIso()
      };
      user.accountOwnerUserId = user.id;
      auth.users.push(user);
      const session = createSession(user.id);
      auth.sessions.push(session);
      await writeAuthStore(auth);

      const sheet = await readSheetStore();
      const cliente = await ensureClienteForUser(user, user, sheet);
      const currentCliente = sheet.clientes.find((c) => c.cliente_id === cliente.cliente_id) || cliente;
      return res.json({
        success: true,
        token: session.token,
        user: sanitizeUser(user),
        account: buildAccountStatus(currentCliente, sheet)
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Falha no cadastro.", details: e?.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Campos obrigatorios: email (ou usuario), password." });
      }
      const auth = await readAuthStore();
      const user = findUserByLogin(auth, String(email));
      if (!user) return res.status(401).json({ error: "Credenciais invalidas." });
      const currentHash = hashPassword(String(password), user.passwordSalt);
      if (currentHash !== user.passwordHash) return res.status(401).json({ error: "Credenciais invalidas." });

      const session = createSession(user.id);
      auth.sessions.push(session);
      await writeAuthStore(auth);
      const owner = auth.users.find((u) => u.id === (user.accountOwnerUserId || user.id)) || user;
      const sheet = await readSheetStore();
      const cliente = await ensureClienteForUser(user, owner, sheet);
      const currentCliente = sheet.clientes.find((c) => c.cliente_id === cliente.cliente_id) || cliente;
      return res.json({
        success: true,
        token: session.token,
        user: sanitizeUser(user),
        account: buildAccountStatus(currentCliente, sheet)
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
    const sheet = req.authSheet as SheetData;
    return res.json({
      user: sanitizeUser(req.authUser as AuthUser),
      account: buildAccountStatus(req.authCliente as ClienteRow, sheet)
    });
  });

  app.get("/api/account/status", requireAuth, (req: AuthenticatedRequest, res) => {
    const sheet = req.authSheet as SheetData;
    return res.json(buildAccountStatus(req.authCliente as ClienteRow, sheet));
  });

  app.get("/api/account/subaccounts", requireAuth, async (req: AuthenticatedRequest, res) => {
    const auth = await readAuthStore();
    const ownerId = req.authOwnerUser?.id || req.authUser?.id;
    const subaccounts = auth.users
      .filter((u) => u.accountOwnerUserId === ownerId && u.id !== ownerId && u.status === "ativo")
      .map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
      }));
    return res.json({ subaccounts });
  });

  app.post("/api/account/subaccounts", requireAuth, async (req: AuthenticatedRequest, res) => {
    const ownerUser = req.authOwnerUser as AuthUser;
    const currentUser = req.authUser as AuthUser;
    if (!isOwnerUser(currentUser)) {
      return res.status(403).json({ error: "Apenas a conta principal pode criar subcadastros." });
    }
    const { name, username, password } = req.body || {};
    if (!name || !username || !password) {
      return res.status(400).json({ error: "Campos obrigatorios: name, username, password." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
    }
    const normalizedUsername = String(username).trim().toLowerCase().replace(/\s+/g, "");
    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
      return res.status(400).json({ error: "Usuario invalido. Use 3-30 caracteres (a-z, 0-9, ., _ ou -)." });
    }
    const auth = await readAuthStore();
    if (auth.users.some((u) => u.username.toLowerCase() === normalizedUsername || u.email.toLowerCase() === normalizedUsername)) {
      return res.status(409).json({ error: "Usuario ja cadastrado." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const subUser: AuthUser = {
      id: randomId("USR"),
      name: String(name).trim(),
      email: `${normalizedUsername}@sub.eduquest.local`,
      username: normalizedUsername,
      phone: ownerUser.phone || "",
      role: "aluno",
      parentUserId: ownerUser.id,
      accountOwnerUserId: ownerUser.id,
      status: "ativo",
      passwordHash: hashPassword(String(password), salt),
      passwordSalt: salt,
      createdAt: nowIso(),
    };
    auth.users.push(subUser);
    await writeAuthStore(auth);
    return res.json({
      success: true,
      subaccount: {
        id: subUser.id,
        name: subUser.name,
        username: subUser.username,
        role: subUser.role,
        createdAt: subUser.createdAt,
      },
    });
  });

  app.delete("/api/account/subaccounts/:subId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const ownerUser = req.authOwnerUser as AuthUser;
    const currentUser = req.authUser as AuthUser;
    if (!isOwnerUser(currentUser)) {
      return res.status(403).json({ error: "Apenas a conta principal pode remover subcadastros." });
    }
    const subId = String(req.params.subId || "");
    const auth = await readAuthStore();
    const subUser = auth.users.find((u) => u.id === subId && u.accountOwnerUserId === ownerUser.id);
    if (!subUser || subUser.id === ownerUser.id) return res.status(404).json({ error: "Subcadastro nao encontrado." });
    subUser.status = "cancelado";
    auth.sessions = auth.sessions.filter((s) => s.userId !== subUser.id);
    await writeAuthStore(auth);
    return res.json({ success: true });
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

  app.post("/api/account/activate-free-once", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOwnerUser(req.authUser as AuthUser)) {
      return res.status(403).json({ error: "Apenas a conta principal pode ativar acesso gratuito." });
    }
    const sheet = req.authSheet || await readSheetStore();
    const cliente = sheet.clientes.find((c) => c.cliente_id === req.authCliente?.cliente_id);
    if (!cliente) return res.status(404).json({ error: "Cliente nao encontrado." });

    const eligibility = canActivateFreeByIdentity(sheet, cliente);
    if (!eligibility.allowed) {
      return res.status(409).json({ error: eligibility.reason, account: buildAccountStatus(cliente, sheet) });
    }

    const statusBefore = cliente.status_conta;
    const paymentBefore = cliente.pagamento_status;
    ensureFreeOncePlan(sheet);
    cliente.status_conta = "gratuito";
    cliente.pagamento_status = "confirmado";
    cliente.plano_id = FREE_ONCE_PLAN_ID;
    cliente.creditos_disponiveis = Number(cliente.creditos_disponiveis || 0) + FREE_ONCE_CREDITS;
    cliente.validade_ate = addDays(nowIso(), FREE_ONCE_VALIDITY_DAYS);
    appendVoucherMark(cliente, FREE_ONCE_VOUCHER_MARK);
    cliente.observacao = "Acesso gratuito inicial ativado (uso unico por conta).";
    appendAccountEvent(sheet, {
      cliente,
      actorUserId: req.authUser?.id || "",
      eventType: "FREE_ONCE_ACTIVATED",
      statusBefore,
      statusAfter: cliente.status_conta,
      paymentStatusBefore: paymentBefore,
      paymentStatusAfter: cliente.pagamento_status,
      detail: `Acesso gratuito inicial ativado com ${FREE_ONCE_CREDITS} creditos.`,
    });

    await writeSheetStore(sheet);
    return res.json({
      success: true,
      message: `Acesso gratuito ativado com ${FREE_ONCE_CREDITS} creditos para uma execucao inicial.`,
      account: buildAccountStatus(cliente, sheet)
    });
  });

  app.post("/api/account/cancel", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOwnerUser(req.authUser as AuthUser)) {
      return res.status(403).json({ error: "Apenas a conta principal pode cancelar a conta." });
    }
    const sheet = req.authSheet || await readSheetStore();
    const cliente = sheet.clientes.find((c) => c.cliente_id === req.authCliente?.cliente_id);
    if (!cliente) return res.status(404).json({ error: "Cliente nao encontrado." });

    const statusBefore = cliente.status_conta;
    const paymentBefore = cliente.pagamento_status;
    cliente.status_conta = "cancelado";
    cliente.pagamento_status = "cancelado";
    cliente.validade_ate = today();
    cliente.creditos_disponiveis = 0;
    cliente.observacao = "Conta cancelada pelo usuario.";
    appendAccountEvent(sheet, {
      cliente,
      actorUserId: req.authUser?.id || "",
      eventType: "ACCOUNT_CANCELLED",
      statusBefore,
      statusAfter: "cancelado",
      paymentStatusBefore: paymentBefore,
      paymentStatusAfter: "cancelado",
      detail: "Cancelamento solicitado pelo usuario.",
    });
    await writeSheetStore(sheet);

    const auth = await readAuthStore();
    const ownerId = req.authOwnerUser?.id || req.authUser?.id || "";
    auth.sessions = auth.sessions.filter((s) => {
      const u = auth.users.find((x) => x.id === s.userId);
      if (!u) return false;
      return (u.accountOwnerUserId || u.id) !== ownerId;
    });
    await writeAuthStore(auth);

    return res.json({
      success: true,
      message: "Conta cancelada com sucesso.",
      account: buildAccountStatus(cliente, sheet),
    });
  });

  app.get("/api/billing/mode", requireAuth, (_req: AuthenticatedRequest, res) => {
    return res.json({
      mode: BILLING_MODE,
      simulationEnabled: BILLING_MODE === "teste",
      minReleaseHours: MIN_MANUAL_RELEASE_HOURS
    });
  });

  app.post("/api/billing/create-checkout", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOwnerUser(req.authUser as AuthUser)) {
      return res.status(403).json({ error: "Apenas a conta principal pode contratar planos." });
    }
    const { planoId } = req.body || {};
    if (!planoId) return res.status(400).json({ error: "Campo obrigatorio: planoId." });

    const sheet = req.authSheet || await readSheetStore();
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

    const statusBefore = cliente.status_conta;
    const paymentBefore = cliente.pagamento_status;
    const previousPlanId = cliente.plano_id || "";
    const alreadyUsable = canGenerateFromCliente(cliente, sheet).canGenerate;
    if (alreadyUsable) {
      // Conta ja liberada: checkout atua como upgrade pendente sem trocar plano atual.
      cliente.plano_id = previousPlanId;
      cliente.observacao = `Checkout pendente para upgrade de plano (${plano.plano_id}). Conta atual permanece ativa.`;
    } else {
      cliente.plano_id = plano.plano_id;
      cliente.pagamento_status = "pendente";
      cliente.status_conta = "aguardando_pagamento";
      cliente.observacao = `Checkout criado. Liberacao manual em ate ${MIN_MANUAL_RELEASE_HOURS} hora(s).`;
    }
    appendAccountEvent(sheet, {
      cliente,
      actorUserId: req.authUser?.id || "",
      eventType: "CHECKOUT_CREATED",
      statusBefore,
      statusAfter: cliente.status_conta,
      paymentStatusBefore: paymentBefore,
      paymentStatusAfter: cliente.pagamento_status,
      planId: plano.plano_id,
      paymentId: payment.pagamento_id,
      detail: "Checkout criado para contratacao de plano.",
    });

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

  app.post("/api/billing/cancel-checkout", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOwnerUser(req.authUser as AuthUser)) {
      return res.status(403).json({ error: "Apenas a conta principal pode cancelar pagamentos." });
    }
    const { pagamentoId } = req.body || {};
    const sheet = req.authSheet || await readSheetStore();
    const cliente = sheet.clientes.find((c) => c.cliente_id === req.authCliente?.cliente_id);
    if (!cliente) return res.status(404).json({ error: "Cliente nao encontrado." });

    const pendingPayments = sheet.pagamentos
      .filter((p) => p.cliente_id === cliente.cliente_id && normalizePaymentStatus(String(p.status)) === "pendente")
      .sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime());
    const payment = pagamentoId
      ? pendingPayments.find((p) => p.pagamento_id === pagamentoId || p.asaas_payment_id === pagamentoId)
      : pendingPayments[0];
    if (!payment) return res.status(404).json({ error: "Nao existe checkout pendente para cancelar." });

    const statusBefore = cliente.status_conta;
    const paymentBefore = cliente.pagamento_status;
    const previousConfirmedPlanId = findLastConfirmedPlanIdForCliente(sheet, cliente.cliente_id);
    payment.status = "cancelado";
    payment.data_confirmacao = nowIso();

    // Se o checkout pendente estava apontando o plano atual da conta, restaura para o ultimo plano confirmado.
    if (cliente.plano_id === payment.plano_id) {
      let restoredPlanId = previousConfirmedPlanId;
      if (!restoredPlanId && (cliente.status_conta || "").toLowerCase() === "gratuito") {
        restoredPlanId = FREE_ONCE_PLAN_ID;
      }
      if (restoredPlanId) {
        cliente.plano_id = restoredPlanId;
      }
    }

    if ((cliente.status_conta || "").toLowerCase() === "aguardando_pagamento") {
      cliente.pagamento_status = "cancelado";
      if (Number(cliente.creditos_disponiveis || 0) > 0 && !isClienteExpired(cliente)) {
        const plan = findPlanForCliente(sheet, cliente);
        const tipo = String(plan?.tipo_plano || "").toLowerCase();
        cliente.status_conta = tipo === "voucher" ? "voucher" : (tipo === "gratuito" ? "gratuito" : "ativo");
      }
    }
    cliente.observacao = `Checkout ${payment.pagamento_id} cancelado pelo usuario.`;
    appendAccountEvent(sheet, {
      cliente,
      actorUserId: req.authUser?.id || "",
      eventType: "CHECKOUT_CANCELLED",
      statusBefore,
      statusAfter: cliente.status_conta,
      paymentStatusBefore: paymentBefore,
      paymentStatusAfter: cliente.pagamento_status,
      planId: payment.plano_id,
      paymentId: payment.pagamento_id,
      detail: "Cancelamento de pagamento pendente solicitado pelo usuario.",
    });
    await writeSheetStore(sheet);

    return res.json({
      success: true,
      message: "Checkout pendente cancelado.",
      account: buildAccountStatus(cliente, sheet),
      cancelledPaymentId: payment.pagamento_id,
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

      const statusBefore = cliente.status_conta;
      const paymentBefore = cliente.pagamento_status;
      cliente.pagamento_status = status;
      if (status === "confirmado") {
        const creditos = Number(plano.creditos_inclusos || 0);
        const validadeDias = Number(plano.validade_dias || 0);
        cliente.creditos_disponiveis = Number(cliente.creditos_disponiveis || 0) + creditos;
        const tipoPlano = String(plano.tipo_plano || "").toLowerCase();
        if (tipoPlano === "voucher") cliente.status_conta = "voucher";
        else if (tipoPlano === "gratuito") cliente.status_conta = "gratuito";
        else cliente.status_conta = "ativo";
        if (validadeDias > 0) cliente.validade_ate = addDays(nowIso(), validadeDias);
        cliente.data_ultimo_pagamento = today();
      } else if (status === "vencido" || status === "cancelado") {
        cliente.status_conta = "aguardando_pagamento";
      }
      appendAccountEvent(sheet, {
        cliente,
        actorUserId: "webhook",
        eventType: "PAYMENT_STATUS_UPDATED",
        statusBefore,
        statusAfter: cliente.status_conta,
        paymentStatusBefore: paymentBefore,
        paymentStatusAfter: status,
        planId: payment.plano_id,
        paymentId: payment.pagamento_id,
        detail: `Webhook de pagamento recebido com status ${status}.`,
      });

      await writeSheetStore(sheet);
      return res.json({ success: true, pagamentoStatus: status, account: buildAccountStatus(cliente, sheet) });
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
  preloadedSheet?: SheetData | null;
}) {
  const sheet = params.preloadedSheet || await readSheetStore();
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
  return { consumo, account: buildAccountStatus(cliente, sheet) };
}

export async function getQuestionPolicyForEmail(userEmail: string) {
  const sheet = await readSheetStore();
  const cliente = sheet.clientes.find((c) => c.email.toLowerCase() === userEmail.toLowerCase());
  if (!cliente) {
    return { maxQuestionsPerExam: DEFAULT_QUESTIONS_PER_EXAM };
  }
  return { maxQuestionsPerExam: getMaxQuestionsPerExam(sheet, cliente) };
}

export function getQuestionPolicyForRequest(req: AuthenticatedRequest) {
  const sheet = req.authSheet;
  const cliente = req.authCliente;
  if (!sheet || !cliente) {
    return { maxQuestionsPerExam: DEFAULT_QUESTIONS_PER_EXAM };
  }
  return { maxQuestionsPerExam: getMaxQuestionsPerExam(sheet, cliente) };
}

export function getAuthFromRequest(req: AuthenticatedRequest) {
  return {
    user: req.authUser ? sanitizeUser(req.authUser) : null,
    cliente: req.authCliente || null
  };
}
