import { AppMode } from "../types/exam";

export interface AccountStatus {
  statusConta: string;
  tipoAcesso: string;
  planoId: string | null;
  creditosDisponiveis: number;
  creditosUtilizados: number;
  validadeAte: string | null;
  pagamentoStatus: string;
  freeOnceUsed?: boolean;
  canActivateFreeOnce?: boolean;
  freeOnceBlockReason?: string | null;
  maxQuestionsPerExam?: number;
  canGenerate: boolean;
  blockReasons: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: AppMode;
}

export interface AuthPayload {
  token: string;
  user: AuthUser;
  account: AccountStatus;
}

const TOKEN_KEY = "eduquest-auth-token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredToken(token: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  throw new Error(`Resposta inesperada do servidor: ${text.slice(0, 120)}`);
}

export async function registerWithBackend(params: {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: AppMode;
}): Promise<AuthPayload> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha no cadastro.");
  return data as AuthPayload;
}

export async function loginWithBackend(email: string, password: string): Promise<AuthPayload> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha no login.");
  return data as AuthPayload;
}

export async function logoutFromBackend(token: string): Promise<void> {
  if (!token) return;
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchMe(token: string): Promise<{ user: AuthUser; account: AccountStatus }> {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Sessao invalida.");
  return data;
}

export async function fetchAccountStatus(token: string): Promise<AccountStatus> {
  const response = await fetch("/api/account/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao consultar conta.");
  return data as AccountStatus;
}

export async function fetchPlans() {
  const response = await fetch("/api/plans");
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao listar planos.");
  return data.plans || [];
}

export async function createCheckout(token: string, planoId: string) {
  const response = await fetch("/api/billing/create-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planoId }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao criar checkout.");
  return data;
}

export async function cancelCheckout(token: string, pagamentoId?: string) {
  const response = await fetch("/api/billing/cancel-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pagamentoId }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao cancelar checkout.");
  return data as { success: boolean; message: string; account: AccountStatus; cancelledPaymentId: string };
}

export async function cancelAccount(token: string) {
  const response = await fetch("/api/account/cancel", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao cancelar conta.");
  return data as { success: boolean; message: string; account: AccountStatus };
}

export async function activateFreeOnce(token: string) {
  const response = await fetch("/api/account/activate-free-once", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao ativar acesso gratuito.");
  return data as { success: boolean; message: string; account: AccountStatus };
}

export async function fetchBillingMode(token: string) {
  const response = await fetch("/api/billing/mode", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao consultar modo de cobranca.");
  return data as {
    mode: "pix_manual" | "teste";
    simulationEnabled: boolean;
    minReleaseHours: number;
  };
}

export interface Subaccount {
  id: string;
  name: string;
  username: string;
  role: AppMode;
  createdAt: string;
}

export async function fetchSubaccounts(token: string) {
  const response = await fetch("/api/account/subaccounts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao listar subcadastros.");
  return (data.subaccounts || []) as Subaccount[];
}

export async function createSubaccount(token: string, params: { name: string; username: string; password: string }) {
  const response = await fetch("/api/account/subaccounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao criar subcadastro.");
  return data as { success: boolean; subaccount: Subaccount };
}

export async function deleteSubaccount(token: string, subId: string) {
  const response = await fetch(`/api/account/subaccounts/${encodeURIComponent(subId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || data.details || "Falha ao remover subcadastro.");
  return data as { success: boolean };
}

