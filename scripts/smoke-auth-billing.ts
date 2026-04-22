import { app } from "../api/app.js";

type JsonRecord = Record<string, any>;

async function requestJson(url: string, init?: RequestInit): Promise<{ status: number; body: JsonRecord }> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function assertCondition(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  const server = app.listen(0);
  const port = Number((server.address() as any)?.port);
  const base = `http://127.0.0.1:${port}`;
  const email = `smoke_${Date.now()}@eduquest.local`;
  const password = "abc12345";

  try {
    const register = await requestJson(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Test",
        email,
        password,
        role: "professor",
      }),
    });
    assertCondition(register.status === 200, `Cadastro falhou (${register.status}): ${JSON.stringify(register.body)}`);
    assertCondition(Boolean(register.body?.token), "Cadastro sem token.");

    const login = await requestJson(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assertCondition(login.status === 200, `Login falhou (${login.status}): ${JSON.stringify(login.body)}`);
    const token = String(login.body?.token || "");
    assertCondition(Boolean(token), "Login sem token.");

    const status = await requestJson(`${base}/api/account/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assertCondition(status.status === 200, `Status da conta falhou (${status.status}): ${JSON.stringify(status.body)}`);
    assertCondition(status.body?.statusConta === "aguardando_pagamento", "Status inicial inesperado.");

    const plans = await requestJson(`${base}/api/plans`);
    assertCondition(plans.status === 200, `Listagem de planos falhou (${plans.status}): ${JSON.stringify(plans.body)}`);
    assertCondition(Array.isArray(plans.body?.plans) && plans.body.plans.length > 0, "Nenhum plano retornado.");
    assertCondition(plans.body.plans.some((p: any) => Number(p?.valor || 0) > 0), "Todos os planos estao com valor 0.");

    const checkout = await requestJson(`${base}/api/billing/create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planoId: "PRE100" }),
    });
    assertCondition(checkout.status === 200, `Checkout falhou (${checkout.status}): ${JSON.stringify(checkout.body)}`);
    assertCondition(Boolean(checkout.body?.checkout?.pagamentoId), "Checkout sem pagamentoId.");
    assertCondition(Number(checkout.body?.checkout?.valor || 0) > 0, "Checkout gerou valor 0.");

    console.log("SMOKE TEST OK");
    console.log(JSON.stringify({
      registerStatus: register.status,
      loginStatus: login.status,
      accountStatus: status.body?.statusConta,
      plansCount: plans.body?.plans?.length || 0,
      checkoutStatus: checkout.status,
      checkoutValor: checkout.body?.checkout?.valor,
      billingMode: checkout.body?.billingMode || "teste",
    }, null, 2));
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error("SMOKE TEST FALHOU");
  console.error(err?.message || err);
  process.exit(1);
});

