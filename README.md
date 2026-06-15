## Agenda Fiscal

Sistema de gestão de tarefas fiscais para a equipe de um escritório de contabilidade: login individual com permissões por papel (colaborador/dono), cadastro de empresas-cliente com regime tributário, e importação assistida da planilha de empresas existente.

Stack: Next.js 15.5 (App Router) + TypeScript strict, Auth.js v5 (Credentials), Prisma 6 + PostgreSQL (Neon), shadcn/ui + Tailwind CSS 4, Vitest.

## Pré-requisitos

- Node.js 20 LTS ou superior (recomendado 24.x)
- Acesso a um banco PostgreSQL (este projeto usa [Neon](https://neon.tech) — managed Postgres serverless)

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha os valores reais:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL`: connection string pooled do Neon (host com sufixo `-pooler`), usada em runtime pela aplicação.
   - `DIRECT_URL`: connection string direta do Neon (sem `-pooler`), usada por `prisma db push` / migrations.
   - `AUTH_SECRET`: gere com `npx auth secret` ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   - `AUTH_TRUST_HOST`: deixe `true` em qualquer ambiente atrás de proxy (produção). Em desenvolvimento local pode ficar como está no `.env.example`.

3. Aplique o schema do Prisma ao banco:

   ```bash
   npx prisma db push
   ```

4. Popule os usuários iniciais (1 dono + 4 colaboradores, com senha placeholder):

   ```bash
   npx prisma db seed
   ```

5. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

6. (Opcional) Rode a suíte de testes:

   ```bash
   npx vitest run
   ```

## Build de produção

```bash
npm run build
npm start
```

O `next.config.ts` define `output: "standalone"`, gerando um build autocontido em `.next/standalone` adequado para deploy em um processo Node sempre ativo (Railway).

## Deploy no Railway

> **Importante — banco de dados:** este projeto usa **Neon** (Postgres gerenciado externo), não um serviço Postgres do Railway. O Railway hospeda **apenas o processo da aplicação Next.js**. Não crie/adicione um serviço Postgres no projeto Railway — `DATABASE_URL` e `DIRECT_URL` devem apontar para o mesmo banco Neon já usado em desenvolvimento (Plano 01).

1. **Criar o projeto no Railway**

   - Crie um novo projeto em [railway.app](https://railway.app).
   - Conecte o repositório GitHub deste projeto (deploy automático a cada push na branch conectada) **ou** use a Railway CLI (`railway up`) para deploy manual a partir da pasta local.

2. **Configurar as variáveis de ambiente**

   No serviço da aplicação, em **Variables**, defina as seguintes variáveis (texto puro, **não** como "reference variables" de um serviço Postgres do Railway — não existe esse serviço aqui):

   | Variável | Valor |
   |----------|-------|
   | `DATABASE_URL` | Mesma connection string pooled do Neon usada no `.env` local (host `-pooler`) |
   | `DIRECT_URL` | Mesma connection string direta do Neon usada no `.env` local (host sem `-pooler`) |
   | `AUTH_SECRET` | Mesmo valor gerado/usado no `.env` local (Plano 01) |
   | `AUTH_TRUST_HOST` | `true` (necessário para o Auth.js validar corretamente o host atrás do proxy do Railway) |

3. **Pre-deploy command (aplicar schema)**

   Este repositório já inclui `railway.json` com:
   - `build.buildCommand`: `npm run build`
   - `deploy.startCommand`: `npm start`
   - `deploy.preDeployCommand`: `npx prisma generate && npx prisma db push`

   O Railway lê `railway.json` automaticamente. Se o painel não detectar o pre-deploy command automaticamente, configure-o manualmente em **Settings -> Deploy -> Pre-Deploy Command** com o mesmo valor.

   > **Por que `prisma db push` e não `prisma migrate deploy`:** o Plano 01 aplicou o schema ao Neon via `prisma db push` (não existe pasta `prisma/migrations/`). O banco já está em produção com schema aplicado e 5 usuários seedados. Rodar `prisma migrate dev --name init` agora, para criar retroativamente um histórico de migrations, arriscaria o Prisma detectar "drift" entre o banco populado e o histórico vazio e sugerir um reset (que apagaria os usuários seedados). Por isso o pre-deploy mantém o fluxo `db push`, consistente com o Plano 01. Migrations versionadas podem ser adotadas em uma fase futura, partindo de um baseline (`prisma migrate resolve --applied`).

4. **Gerar o domínio público**

   Em **Settings -> Networking**, gere um domínio público (`*.up.railway.app`). É essa URL que a equipe usará para acessar o sistema pela internet (fora da rede do escritório).

5. **Disparar o deploy**

   - Se o repositório está conectado: faça push para a branch conectada.
   - Se via CLI: rode `railway up` na raiz do projeto.

   Acompanhe os logs de build/deploy no painel do Railway e confirme que o pre-deploy (`prisma db push`) rodou sem erros antes do `npm start`.

6. **Smoke test externo**

   De uma rede fora do escritório (ex.: dados móveis):

   ```bash
   curl -I https://<seu-app>.up.railway.app
   ```

   Deve retornar um status HTTP (200/3xx), não erro de conexão. No navegador, acesse a URL, faça login com um usuário seedado e confirme que `/empresas` carrega; feche e reabra o navegador para confirmar que a sessão persiste.

## Credenciais iniciais (placeholder)

O seed cria 5 usuários (1 `DONO` + 4 `COLABORADOR`) com a senha placeholder `trocar-no-primeiro-login`. Antes de entregar o sistema à equipe, atualize nome/email dos 5 registros para os dados reais e garanta a troca de senha de cada usuário (ver `01-01-SUMMARY.md` para detalhes).
