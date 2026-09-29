# Diário do Motorista

Aplicação Next.js para registo de jornadas, sessões de condução, eventos e relatórios.

## Desenvolvimento

Requisitos: Node.js 20.9 ou superior e PostgreSQL.

1. Instale dependências com `npm install`.
2. Copie `.env.example` para `.env.local` e configure `DATABASE_URL` e `JWT_SECRET`.
3. Gere e aplique as migrations com `npm run db:deploy`.
4. Inicie com `npm run dev`.

`npm test`, `npm run lint` e `npx tsc --noEmit` verificam cálculos, lint e tipos. O modo offline oferece apenas a página de indisponibilidade; ele não armazena nem sincroniza alterações.

## Banco de dados

Em um banco PostgreSQL vazio, `npm run db:deploy` cria o schema e aplica todas as migrations.

Em um banco já existente, faça backup e compare o schema antes de adotar o histórico de migrations. Se as tabelas da migration `20260402_init` já existem e correspondem ao schema inicial, marque somente essa migration como aplicada antes de aplicar as migrations pendentes:

```sh
npx prisma migrate resolve --applied 20260402_init
npm run db:deploy
```

Se migrations posteriores já foram aplicadas manualmente ou via `db push`, compare cada alteração antes de marcar sua migration como aplicada. Não execute `db:reset` em um banco com dados que devam ser preservados.

## Limites

Os alertas de condução são auxiliares e dependem dos horários, pausas e sessões informados. O sistema ainda não registra todos os períodos de descanso necessários para certificar conformidade integral com o Regulamento (CE) 561/2006; confirme o tacógrafo e a legislação aplicável.