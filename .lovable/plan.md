

# Correção: Criar migrations locais para sincronizar com o banco remoto

## Problema

O banco remoto tem 4 migrations registradas que não existem localmente:
- `20260403203740`
- `20260403203741`
- `20260403204731`
- `20260403204732`

O Supabase CLI recusa o push porque não encontra esses arquivos locais.

## Solução

Criar os 4 arquivos de migration localmente como **no-op** (apenas comentário), já que o schema dessas migrations já foi aplicado no banco remoto. Isso sincroniza o histórico local com o remoto.

Também corrigir o erro de build no `export-database/index.ts` (linha 401: `error` is of type `unknown`).

## Arquivos a criar

1. **`supabase/migrations/20260403203740_20260403_checklist_entrada_digital.sql`** — conteúdo: `-- Already applied remotely, no-op`
2. **`supabase/migrations/20260403203741_20260403_insert_checklist_entrada_template.sql`** — conteúdo: `-- Already applied remotely, no-op`
3. **`supabase/migrations/20260403204731_20260403_checklist_entrada_digital.sql`** — conteúdo: `-- Already applied remotely, no-op`
4. **`supabase/migrations/20260403204732_20260403_insert_checklist_entrada_template.sql`** — conteúdo: `-- Already applied remotely, no-op`

## Arquivo a editar

5. **`supabase/functions/export-database/index.ts`** linha 401 — corrigir `error.message` para `(error as Error).message`

## Após aplicar

Rodar `npx supabase db push --linked` novamente. O CLI encontrará os 4 arquivos locais, verá que já foram aplicados remotamente, e prosseguirá com as migrations restantes.

