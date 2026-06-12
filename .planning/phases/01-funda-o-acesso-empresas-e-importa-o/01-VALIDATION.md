---
phase: 1
slug: funda-o-acesso-empresas-e-importa-o
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (compatível com Next.js 15 / React 19, configuração mínima — recomendação de RESEARCH.md, sem framework configurado ainda no projeto greenfield) |
| **Config file** | none — Wave 0 instala |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` (suite pequena nesta fase) |
| **Estimated runtime** | ~10 segundos |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | AUTH-01 | V2/V3 | Login com email/senha correto retorna sessão; credenciais erradas retornam erro genérico ("Email ou senha incorretos") | unit/integration | `npx vitest run tests/auth.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-01 | V3 | Sessão persiste via cookie JWT `httpOnly`/`secure` com `maxAge` configurado | manual + unit | `npx vitest run tests/auth.test.ts -t "session maxAge"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-02 | V4 / T-1-01 | `withVisibilityScope({role,id})` retorna escopo correto: `{ responsavelId: X }` para colaborador, `{}` para dono | unit | `npx vitest run tests/visibility-scope.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-02 | V4 / T-1-01 (IDOR) | Colaborador A não consegue ler/editar empresa de Colaborador B via Server Action direta | integration | `npx vitest run tests/empresas.idor.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EMPR-01 | V5 | CRUD de empresa com `regimeTributario` válido persiste corretamente; CNPJ com dígito verificador inválido é rejeitado | unit/integration | `npx vitest run tests/empresas.crud.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EMPR-01 | V5 | `validarCNPJ()` aceita CNPJs válidos (módulo 11) e rejeita dígitos verificadores incorretos | unit | `npx vitest run tests/cnpj.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EMPR-02 | V5 | `parseEmpresasXlsx()` lê `Lista de Empresas com CNPJ.xlsx` real e retorna ~198 linhas, com seção/regime (Lucro Real / Simples Nacional / Lucro Presumido) corretamente atribuídos por bloco | unit (fixture = planilha real ou subset) | `npx vitest run tests/import.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EMPR-02 | V5 | Importação não persiste linhas com regime tributário ausente/ambíguo sem confirmação explícita na etapa de revisão | integration | `npx vitest run tests/import.confirm.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EMPR-02 | V6 (upload) | Upload de arquivo não-`.xlsx` (ou `.xlsx` corrompido) é rejeitado com erro genérico, sem expor detalhes do parser | unit/integration | `npx vitest run tests/import.upload.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFRA-01 | — | App responde na URL pública do Railway após deploy | manual (smoke test pós-deploy) | `curl -I https://<app>.up.railway.app` | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task ID / Plan / Wave ficam `TBD` até o planner gerar `01-PLAN-XX.md`; o `gsd-plan-checker` deve preencher esta tabela com os IDs reais de tarefa.*

---

## Wave 0 Requirements

- [ ] `package.json` com script `"test": "vitest run"` + `npm install -D vitest` — projeto greenfield, nenhum framework de teste configurado ainda
- [ ] `vitest.config.ts` — configuração mínima (ambiente Node para libs; jsdom se necessário para componentes)
- [ ] `tests/setup.ts` — helper para criar usuário de teste + sessão mockada (para `withVisibilityScope` e testes de IDOR)
- [ ] `tests/auth.test.ts`, `tests/visibility-scope.test.ts`, `tests/empresas.idor.test.ts`, `tests/empresas.crud.test.ts`, `tests/cnpj.test.ts`, `tests/import.test.ts`, `tests/import.confirm.test.ts`, `tests/import.upload.test.ts` — stubs para AUTH-01, AUTH-02, EMPR-01, EMPR-02
- [ ] Confirmar `node --version` ≥ 20 LTS (requisito Prisma 6) e validar versões dos pacotes (Package Legitimacy Audit, RESEARCH.md)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App responde na URL pública do Railway após deploy | INFRA-01 | Depende de deploy real em ambiente gerenciado (Railway), não reproduzível em testes locais | Após deploy: `curl -I https://<app>.up.railway.app` deve retornar `200 OK`; acessar pelo navegador a partir de uma rede externa (fora do Wi-Fi do escritório, ex.: dados móveis) para confirmar acesso pela internet |
| Sessão persiste entre fechamentos do navegador | AUTH-01 | Comportamento de cookie do navegador real, não simulável fielmente em teste unitário | Fazer login, fechar completamente o navegador, reabrir e acessar a URL do app — usuário deve continuar autenticado até expiração do cookie |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
