# Phase 5: Fundação Multi-Setor — Schema, Autorização e Empresas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 5-funda-o-multi-setor-schema-autoriza-o-e-empresas
**Areas discussed:** Atribuição inicial DP/Contábil, Campo CLT (EMPR-03), Placeholders DP/Contábil, Tela de empresas p/ novo setor

---

## Atribuição inicial DP/Contábil

| Option | Description | Selected |
|--------|-------------|----------|
| Deixar sem responsável (null) até atribuição manual | Migra sem atribuição falsa/aleatória | ✓ |
| Atribuição automática round-robin | Distribui as 197 empresas automaticamente entre os 7 placeholders | |
| Você já sabe quem cuida de quê | Importar lista real de atribuição, como no Fiscal v1.0 | |

**User's choice:** Deixar sem responsável (null) até atribuição manual.

| Option | Description | Selected |
|--------|-------------|----------|
| Só o dono | Apenas DONO edita os 3 seletores de responsável | ✓ |
| Dono + colaboradores do próprio setor | Colaborador DP edita só seu próprio seletor | |

**User's choice:** Só o dono.

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, filtro/badge "sem responsável" | Indicador visual/filtro na lista de empresas | ✓ |
| Não precisa agora | Sem indicador especial | |

**User's choice:** Sim, filtro/badge "sem responsável".

**Notes:** Diferente do Fiscal (que teve atribuição real via script de CNPJ no v1.0), não existe hoje informação real de quem cuida de DP/Contábil em cada empresa — atribuir algo agora (aleatório ou round-robin) criaria responsabilidade falsa.

---

## Campo CLT (EMPR-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Não (false) por padrão | Mais seguro contra falso positivo de geração de DP | ✓ |
| Desconhecido/null por padrão | Evita assumir "não tem CLT" silenciosamente | |

**User's choice:** Não (false) por padrão.

| Option | Description | Selected |
|--------|-------------|----------|
| Revisão manual no sistema | Toggle/checkbox no cadastro de empresa | ✓ |
| Tenho uma planilha/lista pronta | Importação em lote | |

**User's choice:** Revisão manual no sistema.

**Notes:** Não existe fonte de dados externa para esse campo — revisão será feita aos poucos, igual ao padrão usado para regime tributário no v1.0.

---

## Placeholders DP/Contábil

| Option | Description | Selected |
|--------|-------------|----------|
| DP1–DP4 / Contabil1–Contabil3 | Mesmo padrão do fiscal v1.0 (colaborador1-4) | ✓ |
| Outro padrão de nomenclatura | — | |

**User's choice:** DP1–DP4 / Contabil1–Contabil3.

| Option | Description | Selected |
|--------|-------------|----------|
| Login funcional desde já | Senha definida, pode logar imediatamente | ✓ |
| Só registro, sem login ainda | Existe só para popular seletores | |

**User's choice:** Login funcional desde já.

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo padrão usado no fiscal v1.0 | Reaproveita convenção de senha já existente | ✓ |
| Senha padrão específica a informar | — | |

**User's choice:** Mesmo padrão usado no fiscal v1.0 — identificado no código como hash bcrypt de `"trocar-no-primeiro-login"` (`prisma/seed.ts:16`).

---

## Tela de empresas p/ novo setor

| Option | Description | Selected |
|--------|-------------|----------|
| Esperado, sem mensagem especial | Lista vazia padrão | |
| Mensagem explicativa no estado vazio | Texto explicando ausência de atribuição | ✓ |

**User's choice:** Mensagem explicativa no estado vazio.

| Option | Description | Selected |
|--------|-------------|----------|
| Mesma tela, mesmas colunas p/ todos | Todos veem as 3 colunas, linhas filtradas por responsabilidade | |
| Colunas filtradas por setor do usuário | Colaborador só vê a coluna do próprio setor | ✓ |

**User's choice:** Colunas filtradas por setor do usuário.

**Notes:** DONO continua vendo as 3 colunas (Fiscal/DP/Contábil), sem restrição.

---

## Claude's Discretion

- Forma exata da tabela de junção `EmpresaResponsavelSetor` (nomes de campos, índices), guiada pelo Pitfall B1 do RESEARCH.md.
- Assinatura exata de `withVisibilityScope`/`withTarefaScope` setor-aware, guiada pelo Pitfall B3.
- Texto exato da mensagem de estado vazio e do filtro/badge "sem responsável".

## Deferred Ideas

Nenhuma — a discussão permaneceu dentro do escopo da fase.
