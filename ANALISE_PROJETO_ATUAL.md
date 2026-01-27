# Análise do projeto (estado atual) — `cartola-canal` / “RachaCanal”

Data da análise: **2026-01-27**

Este documento descreve como o projeto funciona hoje (arquitetura, dados e fluxos) e lista pontos de atenção que impactam as melhorias pedidas (seleção de jogadores do dia e correções de `scoreDay`).

## Status (implementado após aprovação)
- Participantes do dia (`daySessions/{id}.participants`) + “repetir último” (`meta/day.lastParticipants`)
- Admin → Ações: seleção de participantes e filtro de jogadores
- Home → Hoje: mostra apenas participantes (ou vazio se não iniciou)
- Finalizar/Reverter: `best`/`bad` calculados apenas entre participantes
- Correção de `scoreDay`: modal “Histórico do dia” com editar/remover eventos (auditável)

---

## 1) Visão geral do produto

O app é um **ranking/pontuação de “racha”**:
- **Home** (público): mostra rankings por **pontuação total**, **pontuação do dia**, e “**pancada/melhor**” (contadores `bad` e `best`).
- **Admin** (restrito): gerencia jogadores e regras, e executa o fluxo de **pontuação do dia** (iniciar → aplicar eventos → finalizar).

Tecnologicamente, é um **front-end React** rodando em **Vite**, usando **Firebase Auth + Firestore** direto do client (sem backend próprio no repo).

---

## 2) Stack e build/deploy

**Stack principal**
- React + Vite (`vite.config.ts`)
- Ionic React (base CSS + `IonApp`)
- Tailwind + componentes (estilo “shadcn/ui” em `client/src/components/ui/*`)
- Roteamento: `wouter` (`client/src/App.tsx`)
- Estado de dados: `@tanstack/react-query` (cache e mutations)
- Firebase:
  - Auth (email/senha)
  - Firestore (coleções: players/categories/admins e sessão/eventos do dia)

**Build**
- `vite.config.ts` usa `root = client/` e gera build em `dist/public`.
- GitHub Pages: `base: "./"` no Vite + `Router base` calculado em `client/src/App.tsx` para funcionar em `/repo/`.

**Mobile**
- Capacitor (`capacitor.config.ts`) aponta `webDir: dist/public`.

---

## 3) Estrutura do projeto (alto nível)

- `client/src/pages/*`
  - `Home.tsx`: rankings e modal de detalhe do dia
  - `Login.tsx`: login admin via Firebase Auth
  - `Admin.tsx`: painel admin (Jogadores / Regras / Ações / Usuários)
- `client/src/hooks/*`
  - `use-data.ts`: leitura/escrita no Firestore (players, categories, sessão/eventos do dia)
  - `use-auth.ts`: sessão Firebase Auth no client
  - `use-admin.ts`: checagem de admin via coleção `admins`
- `client/src/components/*`
  - `ScoreUpdateForm.tsx`: fluxo de “pontuação do dia” (iniciar/aplicar/finalizar/reverter)
  - dialogs de CRUD (criar jogador, editar nome, criar regra)

---

## 4) Rotas e acesso

Rotas (em `client/src/App.tsx`):
- `/` → `Home`
- `/login` → `Login`
- `/admin` → `Admin`

Autenticação:
- `Login.tsx` faz `signInWithEmailAndPassword(auth, email, password)`.
- `use-auth.ts` usa `onAuthStateChanged` para controlar `isAuthenticated`.

Autorização (admin):
- Em `Admin.tsx` chama `useAdminStatus(isAuthenticated)`.
- `use-admin.ts` considera admin se existir `admins/{uid}` no Firestore.
- Se não for admin, mostra tela “Acesso restrito”.

---

## 5) Modelo de dados (Firestore) e como é usado

### 5.1 Coleções principais

**`players/{id}`** (ranking)
- `name: string`
- `score: number` (pontuação total acumulada)
- `scoreDay: number` (pontuação do dia atual)
- `best: number` (contador de “melhor do dia”)
- `bad: number` (contador de “pancada no ovo”)

**`categories/{id}`** (regras)
- `name: string`
- `points: number` (pode ser negativo)

**`admins/{uid}`** (permissão)
- a existência do documento já dá permissão
- campos extras são opcionais (`email`, `createdAt`, `lastSignInAt` etc.)

### 5.2 Pontuação do dia (sessão + eventos)

O projeto usa um modelo simples de “sessão corrente”:

**`meta/day`** (documento)
- `currentSessionId: string | null`
- `startedAt: timestamp | null`
- `isFinalized: boolean`
- `finalizedAt: timestamp | null`

**`daySessions/{id}`** (coleção)
- hoje só é usada para **criar** um doc na largada; não há leitura dessa coleção na UI.

**`dayEvents/{id}`** (coleção)
- registros de eventos aplicados durante o dia
- campos:
  - `sessionId`, `playerId`
  - `categoryId`, `categoryName`
  - `points`, `count`, `totalPoints`
  - `createdAt`

Uso na Home:
- Quando você clica em um jogador na aba “Pontuação do Dia”, a Home busca `dayEvents` filtrando por `sessionId` (do `meta/day`) e `playerId`, e agrupa por categoria para mostrar um “extrato” do dia.

---

## 6) Fluxos atuais (funcionamento de ponta a ponta)

### 6.1 Jogadores (Admin → Jogadores)
- Lista jogadores (`usePlayers` → `getDocs(players)`).
- Criar jogador (`CreatePlayerDialog` → `useCreatePlayer`):
  - salva `score` inicial
  - zera `scoreDay`, `best`, `bad`
- Editar jogador (`EditPlayerDialog`):
  - **só altera `name`**
- Excluir jogador:
  - remove doc `players/{id}`

### 6.2 Regras (Admin → Regras)
- Lista regras (`useCategories`).
- Criar regra (`useCreateCategory`) com `name` e `points`.
- Excluir regra (`useDeleteCategory`).

### 6.3 Pontuação do dia (Admin → Ações → `ScoreUpdateForm`)

**A) Iniciar pontuação**
- Apaga `dayEvents` e `daySessions` (batch por chunks).
- Cria um doc novo em `daySessions`.
- Atualiza `meta/day` com `currentSessionId`, `startedAt`, `isFinalized: false`.
- Zera `scoreDay` de **todos os jogadores**.

**B) Aplicar pontuação (por jogador)**
- UI:
  - seleciona um jogador (Select com todos os jogadores)
  - ajusta contadores por regra (`+`/`-`) e calcula um `delta`
- Ao “Aplicar Pontuação”:
  - incrementa `players/{id}.scoreDay += delta`
  - incrementa `players/{id}.score += delta`
  - cria docs em `dayEvents` (um por regra com `count > 0`)

**C) Finalizar pontuação**
- Busca todos players e calcula `max(scoreDay)` e `min(scoreDay)` **considerando todos os jogadores**.
- Incrementa:
  - `best += 1` para quem estiver com `scoreDay === maxScoreDay` (empates inclusos)
  - `bad += 1` para quem estiver com `scoreDay === minScoreDay` (empates inclusos)
- Marca `meta/day.isFinalized = true`.

**D) Reverter pontuação**
- Zera `scoreDay` de todos.
- Subtrai de `score` o valor de `scoreDay` anterior (para cada jogador).
- Se já estava finalizado:
  - desfaz 1 ponto de `best` e/ou `bad` (para os empates de max/min daquele dia)
- Apaga `dayEvents` e `daySessions` e reseta `meta/day` para sessão nula.

---

## 7) Seed de dados (dev)

Na Home, `useInitializeDB()` roda **apenas em DEV** e, se as coleções estiverem vazias, popula:
- lista padrão de jogadores
- lista padrão de categorias

Isso facilita o primeiro uso local, mas em produção (Vercel/GH Pages) **não roda**.

---

## 8) Pontos de atenção (importantes para suas demandas)

1) **O dia considera todos os jogadores**
- Hoje, o “dia” é baseado em `scoreDay` de todos; quem não foi ao racha fica com `scoreDay = 0`.
- Impacto: no “Finalizar”, o `minScoreDay` costuma ser 0 e pode dar “bad/pancada” para vários ausentes.
- Impacto: na aba “Pontuação do Dia” na Home, aparecem jogadores que não jogaram (com 0), poluindo o ranking.

2) **Seleção de jogador na aba Ações não é otimizada**
- `Select` lista todos os jogadores, sem busca, sem agrupamento e sem “roster do dia”.
- Em dia com muitos jogadores, fica ruim para operar “ao vivo”.

3) **Não existe UI de correção de `scoreDay`**
- Hoje você consegue:
  - aplicar novos eventos (que somam)
  - ou reverter o dia inteiro
- Não existe “corrigir um jogador” (ajuste manual, desfazer evento, editar histórico).

4) **Sem histórico de partidas**
- Ao iniciar um novo dia, o app apaga `dayEvents` e `daySessions`.
- O que fica como histórico são só os acumulados (`score`, `best`, `bad`).

5) **Atualização “ao vivo” é limitada**
- As queries do React Query não refazem fetch automaticamente (staleTime `Infinity`, sem `refetchInterval`).
- Em geral, **outros celulares na Home não vão ver mudanças em tempo real** sem recarregar/reatualizar (dependendo do ciclo do app).

6) **Sobras de template**
- Existem deps de backend (ex: `express`, `pg`, `drizzle`) no `package.json`, mas não há uso no código do repo.
- Existem utilitários de “/api” (`client/src/lib/queryClient.ts` e `client/src/lib/auth-utils.ts`) que não parecem ser usados no fluxo atual (o app usa Firestore direto).

---

## 9) Perguntas rápidas (pra eu fechar os planos sem suposições erradas)

1) Você quer que “quem não foi no dia”:
   - (A) não apareça na aba “Pontuação do Dia” na Home, **ou**
   - (B) apareça separado (ex: seção “Não jogaram”), **ou**
   - (C) apareça normal, mas **não entre** em `best/bad`?

2) “Pancada no ovo (bad)” deve considerar:
   - só quem participou do dia, mesmo que tenha feito 0 pontos?

3) Correção de `scoreDay`:
   - você prefere (A) **ajuste manual por delta** (ex: “+2”, “-5”), **ou**
   - (B) **definir valor final** do `scoreDay` (ex: “era 7, vira 10”), **ou**
   - (C) **editar/remover eventos** do histórico do dia (auditável)?

4) Pode existir mais de 1 admin aplicando pontos ao mesmo tempo, ou é sempre 1 pessoa?

---

## 10) Planos (propostas) — sem implementar ainda

### Decisões confirmadas (suas respostas)
- **Home → Pontuação do Dia**: opção **A** → **não mostrar** quem não foi no dia.
- **`bad` (pancada no ovo)**: **sim**, mas **apenas entre participantes** (mesmo se alguém participante fizer 0 pontos).
- **Correção de `scoreDay`**: opção **C** → corrigir via **editar/remover eventos do dia** (auditável).
- **Operação do admin**: sempre **1 pessoa** (sem concorrência).

### Plano 1 — Melhorar a “APPLY SCORE TAB” (seleção de jogadores do dia)

Objetivo: separar **“jogadores do dia”** (presentes) do cadastro geral e tornar a aplicação de eventos mais rápida e menos sujeita a erro.

**Fase 1 (MVP — resolve sua dor principal)**
1) Criar conceito de **“participantes da sessão do dia”** no Firestore:
   - salvar em `daySessions/{currentSessionId}` um campo `participants: string[]` (lista de `playerId`).
   - (opcional) salvar também em `meta/day` um `lastParticipants: string[]` para “repetir lista”.
2) No “Iniciar Pontuação”, abrir um modal “Quem jogou hoje?”:
   - lista com checkbox + busca
   - ações rápidas: “Selecionar todos”, “Limpar”, “Repetir lista do último dia” (opcional)
3) Em `ScoreUpdateForm`, trocar o select atual para mostrar **apenas participantes** (por padrão).
4) Ajustar “Finalizar Pontuação” para calcular `best/bad` **somente entre participantes**.
5) Ajustar a aba “Pontuação do Dia” na Home:
   - mostrar ranking do dia **somente com participantes** (de acordo com sua decisão A).

**Regras de negócio (sugestão)**
- Se `participants` ainda não estiver definido, bloquear “Aplicar Pontuação” e pedir seleção.
- Quem não está em `participants`:
  - não entra em `best/bad`
  - **não aparece** no ranking do dia (decisão A).
- Se `participants` estiver vazio, bloquear “Finalizar” e “Aplicar Pontuação”.

**Critérios de aceite (objetivos claros)**
- “Finalizar” não marca `bad` para ausentes.
- Na Home, o ranking do dia **não mostra** quem não foi (0 pontos).

**Fase 2 (UX — operar rápido durante o jogo)**
1) Substituir o `Select` por um **combobox com busca** (estilo Command/CMDK).
2) Exibir “participantes” como **chips/botões** (toque rápido) + “recentes” (últimos 3–5 usados).
3) Destacar na UI:
   - jogador selecionado
   - status da sessão (ativa/finalizada)

**Fase 3 (qualidade e segurança)**
1) Validar “aplicar pontuação” bloqueando jogadores fora de `participants`.
2) Guardar no `daySessions` um snapshot opcional:
   - `participantsCount`, `startedBy`, `finalizedBy` (se você quiser auditoria)

**Observação importante sobre “repetir lista do último dia”**
- Hoje o código apaga `daySessions` ao iniciar um novo dia; para reaproveitar a lista, uma saída simples é salvar
  `lastParticipants: string[]` também em `meta/day` (ou em `meta/settings`) antes de limpar/atualizar a sessão.

---

### Plano 2 — Editar/corrigir `scoreDay` quando necessário

Objetivo: corrigir erros sem precisar “Reverter o dia inteiro”, mantendo consistência entre `scoreDay` e `score`, e (idealmente) com rastro/auditoria.

**Estratégia escolhida (sua decisão C): editar/remover eventos do dia (auditável)**
1) Criar no Admin um modal/painel “Histórico do dia”:
   - filtro por **jogador** (normalmente o jogador selecionado na Ações)
   - listar `dayEvents` do jogador na sessão atual (ordenados por `createdAt`)
   - exibir resumo: total do dia, categorias agrupadas (opcional), e lista “evento a evento”
2) Ações por evento:
   - **Remover evento**:
     - `delete dayEvents/{id}`
     - atualizar `players/{id}` com `increment(-totalPoints)` em `scoreDay` e `score`
   - **Editar evento** (ex: corrigir contagem):
     - editar `count`
     - recalcular `totalPoints = points * count`
     - aplicar `deltaDiff = totalPointsNovo - totalPointsAntigo` no `players/{id}` (`scoreDay` e `score`)
3) Implementação recomendada:
   - usar **transaction** (Firestore) para manter consistência (evento + player atualizam juntos).
4) Regra para dia finalizado:
   - por padrão, **bloquear edição/remover** quando `meta/day.isFinalized = true` (evita incoerência em `best/bad`).
   - alternativa (se você quiser): criar um botão “Desfazer finalização” que reverte `best/bad` e libera edição, e depois “Finalizar” novamente.

**Detalhe importante (qualquer opção):**
- A correção deve sempre manter `scoreDay` e `score` coerentes (hoje eles andam juntos via `increment(delta)`).

**Critérios de aceite (MVP)**
- Consigo corrigir rapidamente um jogador sem “reverter o dia inteiro”.
- O extrato do dia (Home) reflete a correção (via `dayEvents`).
