# Diario do Motorista

Aplicacao web responsiva para registrar jornadas de motoristas, sessoes de conducao, eventos, veiculos e relatorios. O projeto usa Next.js, React, TypeScript, Prisma e PostgreSQL; a producao atual roda na Vercel com banco Neon.

## Indice

- [Recursos](#recursos)
- [Arquitetura](#arquitetura)
- [Executar localmente](#executar-localmente)
- [Comandos](#comandos)
- [Banco Neon e migrations](#banco-neon-e-migrations)
- [Deploy na Vercel](#deploy-na-vercel)
- [API](#api)
- [Testes](#testes)
- [Limites conhecidos](#limites-conhecidos)

## Recursos

- Cadastro e login com senha hash, sessao JWT em cookie HTTP-only e isolamento de dados por usuario.
- Abertura e encerramento de jornadas com data, horarios, paises, matricula, verificacao do veiculo, odometro e observacoes.
- Jornadas com um ou dois motoristas, identificacao do motorista principal e alternancia de sessoes na troca de condutor.
- Pausas continuas ou divididas para jornadas individuais; o inicio e o total concluido ficam persistidos no banco.
- Contador de conducao continua com renovacao dos 4h30 (Reg. CE 561/2006, Art. 7): cada pausa valida (45min continuos ou par 15+30 dentro de ate 75min) zera o contador; pausas invalidas nao renovam. Os blocos de pausa com timestamps reais sao persistidos na coluna `break_blocks` (JSON) da tabela `work_days` (migration `20261001_add_break_blocks`). O cartao na tela atualiza a cada 10s e avisa em ambar quando faltam <=30min para as 4h30, em vermelho quando o limite e excedido (v4.1.8).
- Eventos vinculados a uma jornada, como abastecimento, fronteiras e anotacoes.
- Historico de jornadas, consulta do ultimo odometro por matricula, estatisticas por veiculo e relatorios semanais, mensais, por periodo e para impressao em PDF.
- Alertas auxiliares de conducao diaria, semanal e em duas semanas, considerando sessoes e pausas registradas.
- Interface instalavel como PWA. Offline, o sistema mostra uma pagina de indisponibilidade, mas nao grava nem sincroniza alteracoes.

## Arquitetura

- `src/app`: telas Next.js e handlers de API.
- `src/components`: telas e componentes de jornada, historico e relatorios.
- `src/hooks`: estado do cliente, formularios e chamadas de API.
- `src/lib`: Prisma, autenticacao, validacao, datas, calculos e regras do Regulamento 561/2006.
- `prisma/schema.prisma`: modelos PostgreSQL.
- `prisma/migrations`: migrations versionadas.
- `public/sw.js`: service worker; limita o cache a recursos estaticos e a pagina offline.

Modelos principais: `AppUser`, `WorkDay`, `DrivingSession`, `Event`, `Settings` e `RateLimit`. As sessoes guardam `driverNumber`; a jornada guarda `primaryDriverNumber`, usado para separar o calculo pessoal do total de utilizacao do veiculo.

## Executar localmente

Requisitos: Node.js 20.9 ou superior, npm e um banco PostgreSQL acessivel.

1. Instale as dependencias:

   ```sh
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha `DATABASE_URL`, `JWT_SECRET` e `NEXT_PUBLIC_APP_URL`. Nunca publique os valores secretos.
3. Para um banco vazio, aplique o schema conforme [Banco Neon e migrations](#banco-neon-e-migrations).
4. Gere o Prisma Client e inicie o servidor:

   ```sh
   npm run db:generate
   npm run dev
   ```

5. Abra `http://localhost:3000`. O cadastro inicial e feito pela tela de login.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento na porta 3000 |
| `npm run build` | Build Next.js e preparacao dos arquivos standalone |
| `npm start` | Iniciar o servidor standalone ja compilado |
| `npm run lint` | ESLint 9 sobre o projeto |
| `npm test` | Testes de horario, odometro, pausas, datas e limites |
| `npx tsc --noEmit` | Verificar tipos sem emitir arquivos |
| `npm run db:generate` | Gerar Prisma Client |
| `npm run db:migrate` | Criar/aplicar migration em desenvolvimento local |
| `npm run db:deploy` | Aplicar migrations pendentes; verificar o historico antes de usar em banco existente |
| `npm run db:push` | Sincronizar schema sem historico de migrations; apenas desenvolvimento descartavel |
| `npm run db:reset` | Apagar/recriar o banco; destrutivo e nunca usar em producao |

## Banco Neon e migrations

### Banco novo

Configure `DATABASE_URL` para o Neon e rode:

```sh
npm run db:deploy
npm run db:generate
```

A migration `20260402_init` cria as tabelas-base. As migrations seguintes adicionam fuso horario, numero de motoristas, pausas, atribuicao de motorista e rate limit persistente.

### Banco Neon existente

O banco de producao ja contem dados. **Nao execute `20260402_init` nele**: essa migration cria as tabelas-base e nao e uma migration incremental. Antes de qualquer alteracao, crie uma branch/backup no Neon.

As alteracoes aditivas mais recentes podem ser aplicadas pelo SQL Editor do Neon. O bloco abaixo e idempotente para as colunas e tabela listadas: se uma coluna ja existir, o PostgreSQL emite um aviso `already exists, skipping` e continua.

```sql
BEGIN;

ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "utc_offset" TEXT;
ALTER TABLE "driving_sessions" ADD COLUMN IF NOT EXISTS "utc_offset" TEXT;
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "num_drivers" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "break_start" TIMESTAMP(3);
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "break_type" TEXT;
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "break_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "driving_sessions" ADD COLUMN IF NOT EXISTS "driver_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "primary_driver_number" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "rate_limits" (
    "identifier" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);

COMMIT;
```

Confirme o resultado no Neon:

```sql
SELECT to_regclass('public.rate_limits') AS rate_limits_table;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'work_days' AND column_name IN (
      'timezone', 'utc_offset', 'num_drivers', 'break_start',
      'break_type', 'break_minutes', 'primary_driver_number'
    ))
    OR
    (table_name = 'driving_sessions' AND column_name IN ('utc_offset', 'driver_number'))
  )
ORDER BY table_name, column_name;
```

**Historico Prisma:** executar SQL pelo Neon nao atualiza `_prisma_migrations`. Antes de rodar `npm run db:deploy` em um banco existente, confira o historico de migrations e compare cada migration com o schema real. So marque uma migration como aplicada com `prisma migrate resolve --applied <nome>` depois de verificar que todas as alteracoes dela ja existem. Nao marque migrations as cegas e nao use `db:reset` para corrigir divergencias.

## Deploy na Vercel

O repositorio esta conectado ao deploy da Vercel pela branch `main`; push nessa branch inicia o processo configurado no projeto. Configure as variaveis abaixo em **Vercel > Project > Settings > Environment Variables**:

- `DATABASE_URL`: string de conexao PostgreSQL do Neon.
- `JWT_SECRET`: segredo aleatorio forte, igual para as instancias do mesmo ambiente.
- `NEXT_PUBLIC_APP_URL`: URL publica da aplicacao, se usada pela configuracao do ambiente.

O build executa `next build` e copia os recursos para `output: standalone`. Ele **nao aplica migrations automaticamente**. Atualize e valide o banco Neon antes de colocar em producao codigo que depende de novas colunas ou tabelas. Nunca coloque credenciais de producao no repositorio, README, logs ou prompts.

## API

Todas as rotas de dados exigem sessao autenticada; o middleware/Proxy libera apenas login, cadastro, verificacao de sessao e recursos estaticos.

| Rota | Metodos/uso |
| --- | --- |
| `/api/auth/login` | `POST` autenticar e iniciar sessao |
| `/api/auth/register` | `POST` criar conta, limitado por IP |
| `/api/auth/logout` | `POST` terminar sessao |
| `/api/auth/me` | `GET` consultar sessao |
| `/api/workdays` | `GET` listar; `POST` iniciar jornada |
| `/api/workdays/:id` | `GET`, `PUT`, `DELETE` jornada do usuario |
| `/api/driving-sessions?workDayId=...` | `GET` sessoes; `POST` com `action: pause` ou `resume` |
| `/api/events` | `GET` eventos; `POST` criar evento |
| `/api/matricula/lastkm?matricula=...` | `GET` ultimo odometro do veiculo |
| `/api/reports` | `GET` relatorio semanal, mensal ou periodo personalizado |
| `/api/reports/matricula` | `GET` resumo por matricula |
| `/api/reports/pdf` | `GET` relatorio HTML para imprimir/salvar em PDF |
| `/api/reports/pdf/veiculo` | `GET` relatorio de veiculo para imprimir/salvar em PDF |
| `/api/veiculos/estatisticas` | `GET` totais por veiculo |
| `/api/veiculos/historico` | `GET` historico e odometros por veiculo |

## Testes

`npm test` cobre parsing de `HH:MM`, passagem da meia-noite, duracao de sessoes, odometros, pausas, selecao de motorista, semanas ISO, limites diarios/semanal/quinzenal e formatacao em fusos negativos. Antes de publicar, rode `npm test`, `npm run lint`, `npx tsc --noEmit` e `npm run build`.

## Limites conhecidos

Os avisos sao auxiliares e dependem dos horarios, sessoes, pausas e odometros informados. O sistema ainda nao registra todos os periodos de descanso nem todos os dados necessarios para certificar conformidade integral com o Regulamento (CE) 561/2006. Confirme o tacografo e a legislacao aplicavel; este sistema nao substitui aconselhamento legal nem o tacografo.
