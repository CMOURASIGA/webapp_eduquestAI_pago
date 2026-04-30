# EduQuest IA — Relatório Técnico de Problemas e Correções

> **Contexto:** Os problemas relatados abaixo foram identificados a partir de casos concretos em provas de Inglês e Matemática, mas **se aplicam a todas as disciplinas**. As correções devem ser implementadas de forma transversal à geração de qualquer prova.

---

## 1. Idioma incorreto nas provas (qualidade geral de todas as disciplinas)

### Problema
O prompt de geração abre com `"Aja como um professor especialista brasileiro"`, estabelecendo português como contexto cultural e linguístico dominante. A instrução de idioma de saída (quando diferente do português) aparece enterrada entre 15 outras regras numeradas. Para modelos GPT com respostas longas (40 questões em múltiplos batches), o contexto dominante do início do prompt tende a prevalecer.

Embora o caso mais visível seja o Inglês vindo em Português, o mesmo princípio se aplica a qualquer disciplina que exija precisão terminológica: termos técnicos de Química, Biologia, Física, Literatura etc. podem ser gerados com vocabulário inadequado para a série escolar se o prompt não posicionar a instrução de tom e registro logo no início.

### Arquivos envolvidos
- `utils/examGenerationPromptBuilder.ts` — função `buildExamGenerationPrompt`
- `utils/subjectUtils.ts` — lista de disciplinas por série

### Causa raiz
```
// Prompt abre assim — contexto cultural domina o modelo:
"Aja como um professor especialista brasileiro criando uma prova..."

// Instrução de idioma só aparece mais abaixo:
"15. Validação final de idioma: antes de responder, confirme que TODOS os campos..."
```

### Correção recomendada

**a) Mover a instrução de idioma para o topo do prompt**, antes de qualquer contexto cultural:

```typescript
// examGenerationPromptBuilder.ts — início do template
return `
OUTPUT LANGUAGE — MANDATORY FIRST RULE:
${outputLanguage.guidance}
All fields — "enunciado", "alternativas[].texto", "explicacao" — MUST be written exclusively in ${outputLanguage.label}.
Do not mix languages. This rule overrides all other instructions.

---
Aja como um professor especialista criando uma prova de ESTUDO para alunos do ${label}...
`;
```

**b) Remover a instrução 15 (validação de idioma no final)**, pois ela se torna redundante e só existe porque a instrução principal estava mal posicionada.

**c) Para disciplinas em português, reforçar vocabulário adequado à série escolar** — não apenas o idioma, mas o nível de linguagem:

```typescript
// Adicionar ao prompt para TODAS as disciplinas:
`Use vocabulário e complexidade de linguagem estritamente adequados para alunos de ${age}.
Evite termos técnicos avançados sem explicação contextual no próprio enunciado.`
```

---

## 2. Questões com ambiguidade ou múltiplas respostas possíveis

### Problema
A validação atual (`validateExam`) é **puramente estrutural**: verifica se existem 5 alternativas com labels A-E e texto com pelo menos 2 caracteres. Ela **não detecta**:

- Alternativas semanticamente equivalentes (ex: `"4"` e `"quatro"`, `"H₂O"` e `"água"`, `"verdadeiro"` e `"correto"`)
- Enunciados com dupla interpretação
- Gabarito que pode ser defendido por mais de uma alternativa

Isso **não é exclusivo de Matemática** — ocorre em qualquer disciplina onde o modelo gera alternativas próximas entre si.

### Arquivos envolvidos
- `utils/validateExam.ts`
- `services/openaiService.ts` — função `callOpenAIBatch`
- `api/app.ts` — rota `/api/openai/generate` — `temperature: 0.7`

### Causa raiz

**temperatura alta demais para conteúdo educacional:**
```typescript
// api/app.ts
const response = await openai.chat.completions.create({
  model: modelName || 'gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }],
  response_format: { type: 'json_object' },
  temperature: 0.7,  // ← alto demais para gabarito único e preciso
});
```

**Prompt não instrui explicitamente contra equivalência:**
O prompt atual pede "apenas uma alternativa está correta" mas não instrui o modelo a garantir que as demais sejam *objetivamente incorretas e claramente distintas entre si*.

### Correção recomendada

**a) Reduzir temperature para `0.3`** em todas as gerações de prova:
```typescript
temperature: 0.3,  // reduz alucinações e ambiguidade; criatividade suficiente para variação
```

**b) Adicionar instrução anti-ambiguidade no prompt**, válida para todas as disciplinas:

```
REGRA CRÍTICA DE UNICIDADE DO GABARITO (vale para todas as disciplinas):
- As 4 alternativas incorretas devem ser OBJETIVAMENTE erradas — não apenas menos corretas.
- Nenhuma alternativa incorreta pode ser defendida como correta sob qualquer interpretação razoável.
- Alternativas não podem ser sinônimas, numericamente equivalentes ou semanticamente equivalentes entre si.
  Exemplos proibidos: "4" e "quatro"; "H₂O" e "água"; "verdadeiro" e "correto"; "aumenta" e "cresce".
- Em questões de cálculo: verifique internamente que o resultado correto é único e que os distratores são claramente errados.
- Em questões de interpretação de texto: o trecho citado deve sustentar apenas uma resposta.
- Se houver qualquer dúvida sobre unicidade, reescreva a questão antes de incluir no JSON.
```

**c) Adicionar validação semântica mínima no código** para pegar os casos mais óbvios:

```typescript
// validateExam.ts — adicionar após validação estrutural existente
function hasEquivalentAlternatives(alternativas: Alternative[]): boolean {
  const normalized = alternativas.map(a =>
    a.texto.toLowerCase().trim().replace(/[^a-z0-9\u00e0-\u00fa]/g, '')
  );
  const unique = new Set(normalized);
  return unique.size < alternativas.length;
}

// dentro de validateExam, no loop de questões:
if (hasEquivalentAlternatives(q.alternativas)) {
  throw new Error(`Questao ${idx + 1} invalida: alternativas com texto equivalente detectado.`);
}
```

---

## 3. Gabarito vinculado incorretamente (fallback silencioso)

### Problema
Quando o modelo retorna `alternativaCorretaId` em formato inesperado (ex: `"(A)"`, `"alternativa_a"`, `"1"`, `"letra B"`), a função `resolveCorretaId` tenta normalizar, mas ao falhar **cai silenciosamente para a primeira alternativa (A)**, sem emitir erro. O resultado: o gabarito fica errado e o aluno é prejudicado sem que o sistema reporte nada.

Isso pode ocorrer em qualquer disciplina — não é específico de nenhuma.

### Arquivos envolvidos
- `services/openaiService.ts` — funções `resolveCorretaId` e `callOpenAIBatch`

### Causa raiz
```typescript
const resolveCorretaId = (alternativaCorretaIdRaw: any, alternativas: Question['alternativas']) => {
  const requested = String(alternativaCorretaIdRaw || '').trim();
  if (!requested) return alternativas[0]?.id || 'A';  // ← fallback silencioso
  const byId = alternativas.find((a) => a.id === requested);
  if (byId) return byId.id;
  const byLabel = alternativas.find((a) => String(a.label || '').toUpperCase() === requested.toUpperCase());
  if (byLabel) return byLabel.id;
  return alternativas[0]?.id || 'A';  // ← fallback silencioso novamente
};
```

### Correção recomendada

**a) Substituir fallback silencioso por erro explícito:**
```typescript
const resolveCorretaId = (alternativaCorretaIdRaw: any, alternativas: Question['alternativas']): string => {
  const requested = String(alternativaCorretaIdRaw || '').trim().toUpperCase();

  if (!requested) {
    throw new Error(`alternativaCorretaId ausente ou vazio.`);
  }

  // Normaliza formatos comuns: "(A)" → "A", "LETRA A" → "A", "A)" → "A"
  const cleaned = requested.replace(/[^A-E]/g, '');
  
  const byId = alternativas.find(a => a.id === cleaned);
  if (byId) return byId.id;
  
  const byLabel = alternativas.find(a => String(a.label || '').toUpperCase() === cleaned);
  if (byLabel) return byLabel.id;

  // Sem fallback — rejeitar para forçar regeneração
  throw new Error(`alternativaCorretaId "${alternativaCorretaIdRaw}" não mapeável para nenhuma das alternativas (A-E).`);
};
```

**b) O erro será capturado pelo mecanismo de reparo existente** (`maxRepairAttempts = 4`) em `generateExamWithOpenAI`, que já regenera questões inválidas individualmente — sem necessidade de alteração nessa camada.

---

## 4. Falta de contexto entre batches de geração

### Problema
As 40 questões são geradas em lotes independentes (5–8 questões por lote). Cada lote é uma chamada separada à API, sem conhecimento das questões já geradas nos lotes anteriores. Isso permite:

- Repetição de enunciados similares na mesma prova
- Contradição entre questões de lotes diferentes
- Sobreposição de conteúdo cobrado

Afeta todas as disciplinas, especialmente em provas maiores.

### Arquivos envolvidos
- `services/openaiService.ts` — funções `callOpenAIBatch` e `generateExamWithOpenAI`

### Correção recomendada

Passar um resumo das questões já geradas para os lotes seguintes:

```typescript
// generateExamWithOpenAI — acumular contexto entre batches
const allQuestions: Question[] = [];

for (const b of batches) {
  const previousSummary = allQuestions
    .map((q, i) => `Q${i + 1}: ${q.enunciado.slice(0, 80)}`)
    .join('\n');

  const questions = await callOpenAIBatch(params, b.offset, b.count, previousSummary);
  allQuestions.push(...questions);
}

// callOpenAIBatch — incluir no prompt quando houver contexto anterior
${previousSummary ? `
QUESTÕES JÁ GERADAS NESTA PROVA (NÃO REPITA NEM VARIE ESTAS):
${previousSummary}
---` : ''}
```

---

## 5. Código morto — integração Gemini

### Problema
O arquivo `services/geminiService.ts` está ativo no frontend e a rota `/api/gemini/generate` existe no backend, mas retorna `403` com mensagem de desabilitado. Isso representa risco de ativação acidental, confusão em manutenção futura e aumento desnecessário do bundle.

### Arquivos envolvidos
- `services/geminiService.ts`
- `pages/ConfigGeminiPage.tsx`
- `api/app.ts` — endpoints `/api/gemini/generate` e `/api/gemini/test`

### Correção recomendada
Remover completamente os arquivos e endpoints relacionados ao Gemini. Se houver plano de reativar no futuro, manter apenas em branch separada.

---

## 6. Persistência de provas apenas no localStorage

### Problema
Provas são salvas exclusivamente em `localStorage` do navegador (`storageService.ts`). Trocar de navegador, dispositivo ou limpar dados do navegador apaga o histórico do aluno. Não há sincronização com o backend para dados de progresso do aluno.

### Arquivos envolvidos
- `services/storageService.ts`
- `services/answersService.ts` — já existe endpoint `/api/answers` no backend

### Correção recomendada
Usar o endpoint `/api/answers` já existente para persistir o progresso. `localStorage` pode ser mantido como cache local, mas não como fonte de verdade única.

---

## Resumo de prioridades

| # | Problema | Impacto | Prioridade |
|---|----------|---------|-----------|
| 1 | Idioma incorreto / vocabulário inadequado nas provas | Todas as provas afetadas | 🔴 Alta |
| 2 | Questões ambíguas / múltiplas respostas possíveis | Todas as provas afetadas | 🔴 Alta |
| 3 | Gabarito vinculado incorretamente (fallback silencioso) | Todas as provas afetadas | 🔴 Alta |
| 4 | Falta de contexto entre batches (repetição de questões) | Provas longas (40 questões) | 🟡 Média |
| 5 | Código morto — Gemini | Manutenção e segurança | 🟡 Média |
| 6 | Persistência apenas em localStorage | Experiência do aluno | 🟡 Média |

---

> **Observação final:** os itens 1, 2 e 3 devem ser tratados em conjunto, pois todos convergem para a mesma raiz: o prompt precisa ser mais diretivo, e a validação no código precisa ser mais rigorosa. A redução de `temperature` de `0.7` para `0.3` é a mudança mais simples e com maior retorno imediato para a qualidade geral das provas geradas.
