# Continuar o projeto Agenda Fiscal em outra máquina

## 1. Clonar o repositório

```
git clone https://github.com/CaduDragon107/Agenda-Fiscal.git
cd Agenda-Fiscal
```

## 2. Instalar dependências

```
npm install
```

## 3. Criar o arquivo `.env`

O `.env` não vai pro GitHub (está no `.gitignore`). Crie um arquivo `.env` na raiz do projeto com estas 4 variáveis (veja `.env.example` para os comentários completos):

```
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
AUTH_TRUST_HOST=
```

Como preencher:

- **DATABASE_URL** e **DIRECT_URL**: copie os valores reais do banco de produção rodando, na máquina atual ou em qualquer máquina logada no Railway:
  ```
  railway login
  railway link        # selecionar workspace "cadudragon107's Projects" > projeto "agenda-fiscal" > ambiente "production"
  railway variables --service web
  ```
  Isso mostra as variáveis configuradas no serviço `web` (inclui `DATABASE_URL`/`DIRECT_URL` apontando pro Postgres do Railway).
  ⚠️ Usar o banco de produção em dev local é arriscado (pode alterar dados reais). Se for só para continuar o desenvolvimento, prefira criar um banco Postgres separado (local via Docker, ou um segundo serviço Postgres no Railway) e rodar `npx prisma db push` nele.

- **AUTH_SECRET**: gerado agora para você usar (ou gere outro com `npx auth secret`):
  ```
  83v2OmcPeM4KpCNCoUacnMNy93azRU8hAic9ZedF74g=
  ```
  Se for usar o MESMO banco de produção, use o MESMO `AUTH_SECRET` que já está configurado no Railway (pegue com `railway variables --service web`), não o gerado acima — caso contrário sessões existentes invalidam.

- **AUTH_TRUST_HOST**: `true` (necessário em produção atrás de proxy; em dev local pode deixar `true` também, não tem efeito negativo).

## 4. Gerar o Prisma Client

```
npx prisma generate
```

Se estiver usando um banco novo (não o de produção), aplique o schema:

```
npx prisma db push
```

## 5. Rodar localmente

```
npm run dev
```

Acesse http://localhost:3000

## 6. (Opcional) Deploy do Railway a partir dessa máquina

```
npm install -g @railway/cli   # se ainda não tiver o CLI
railway login
railway link                  # conectar ao projeto agenda-fiscal já existente (não cria um novo)
railway up --service web      # dispara um novo deploy
```

## 7. Continuar trabalhando

- Branch principal: `master`
- Sempre puxar antes de começar: `git pull origin master`
- Ao terminar uma alteração: `git add`, `git commit`, `git push origin master`
- Projeto usa o workflow GSD — comandos como `/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase` (ver `CLAUDE.md` na raiz do projeto)
