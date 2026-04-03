

# Correção das Migrations Duplicadas do Checklist

## Problema

Existem 4 migrations no banco remoto (2 pares duplicados) tentando criar as mesmas policies que já existem. O erro ocorre porque `CREATE POLICY` não suporta `IF NOT EXISTS`.

## Solução

1. **Corrigir a migration de schema** (`20260403_checklist_entrada_digital.sql`): Adicionar `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY` para tornar a migration idempotente.

2. **Remover as migrations duplicadas do banco remoto**: As migrations com prefixo `20260403203740_` e `20260403203741_` e `20260403204731_` e `20260403204732_` que aparecem no push são versões antigas duplicadas que o Supabase está tentando aplicar. Como o schema já existe no banco, você precisará marcar essas migrations como já aplicadas no banco remoto usando `supabase migration repair`.

## Alteração no arquivo

**`supabase/migrations/20260403_checklist_entrada_digital.sql`** — adicionar `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`:

```sql
-- Drop policies if they already exist (idempotent)
DROP POLICY IF EXISTS "Public can insert checklists via token" ON party_hall_digital_checklists;
DROP POLICY IF EXISTS "Public can select checklists by token" ON party_hall_digital_checklists;

CREATE POLICY "Public can insert checklists via token" ...
CREATE POLICY "Public can select checklists by token" ...
```

## Ação manual necessária no terminal

Após a correção, as 4 migrations antigas no banco remoto precisam ser marcadas como aplicadas (já que o schema já existe):

```bash
npx supabase migration repair 20260403203740 --status applied
npx supabase migration repair 20260403203741 --status applied
npx supabase migration repair 20260403204731 --status applied
npx supabase migration repair 20260403204732 --status applied
```

Depois rode `npx supabase db push --linked` novamente para aplicar a migration corrigida.

