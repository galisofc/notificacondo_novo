

## Corrigir fuso horário ao salvar a Data da Ocorrência

### Problema
Ao registrar uma ocorrência informando "21:39", o sistema exibe "18:39". Causa: o input `datetime-local` retorna uma string sem fuso (`2026-04-21T21:39`). Esse valor é enviado direto ao Supabase (campo `timestamptz`), que o interpreta como UTC. Na exibição, o helper `toSaoPauloTime` converte UTC para Brasília (UTC-3), subtraindo 3 horas e mostrando 18:39.

### Solução
Tratar o valor do input como horário local de São Paulo e convertê-lo para UTC ISO antes de salvar no banco. A exibição não precisa mudar — ela já faz a conversão correta de UTC para Brasília.

### Mudanças

**1. `src/lib/dateUtils.ts`** — Adicionar helper de conversão:
- `saoPauloInputToISO(value: string): string` — recebe `"2026-04-21T21:39"` (horário de Brasília vindo do `datetime-local`) e retorna o ISO UTC equivalente (ex.: `"2026-04-22T00:39:00.000Z"`), usando `fromZonedTime` de `date-fns-tz` com a timezone `America/Sao_Paulo`.

**2. `src/pages/Occurrences.tsx`** — Aplicar a conversão ao salvar:
- No insert (linha ~440) e em qualquer update da ocorrência: trocar `occurred_at: formData.occurred_at` por `occurred_at: saoPauloInputToISO(formData.occurred_at)`.
- Ao carregar uma ocorrência existente para edição, converter o ISO UTC do banco de volta para o formato `yyyy-MM-dd'T'HH:mm` em horário de Brasília (usando o `formatCustom` existente) ao popular `formData.occurred_at`, para que o input mostre o horário correto.

**3. Verificar outros formulários que gravam `occurred_at`**:
- Buscar nos formulários de portaria (`porteiro/PortariaOccurrences.tsx`, `sindico/PortariaOccurrences.tsx`) e aplicar a mesma conversão se houver input `datetime-local` salvando o campo.

### Observações
- Registros antigos salvos incorretamente (já com o "horário local" gravado como se fosse UTC) continuarão exibindo 3h a menos. Não faremos correção retroativa em massa — apenas novos registros e edições passarão a ficar corretos. Se desejar, posso preparar um script de migração separado para ajustar o histórico.
- A exibição (`formatDateTimeLong`, `formatDate`, `formatTime`, etc.) já está correta e não precisa de alterações.

