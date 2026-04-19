

## Plano: Editor de Template do PDF de Ocorrência (SuperAdmin)

Criar uma página de configuração no SuperAdmin que permita editar os textos/parâmetros do PDF de ocorrência de forma centralizada. Qualquer alteração refletirá imediatamente em todo o sistema, pois o `OccurrenceDetails.tsx` passará a ler esses valores do banco em vez de tê-los hardcoded.

### 1. Banco de Dados

Nova tabela `occurrence_pdf_template` (singleton — uma linha global):

```text
- id (uuid, pk)
- intro_paragraph (text)        -- "Em [data], foi constatado..."
- legal_basis (text)            -- bloco amarelo
- syndic_role_paragraph (text)  -- explicação do papel do síndico
- penalty_paragraph (text)      -- detalhes de multa/penalidade
- defense_deadline_paragraph    -- prazo de defesa
- closing_remarks (text)        -- encerramento
- footer_text (text)            -- rodapé
- signature_label (text)        -- "Atenciosamente," / cargo
- updated_at, updated_by
```

Suporte a **placeholders** dentro dos textos: `{{data}}`, `{{bloco}}`, `{{apartamento}}`, `{{morador}}`, `{{descricao_ocorrencia}}`, `{{condominio}}`, `{{sindico}}`, `{{prazo_defesa}}`.

RLS: leitura pública autenticada (qualquer síndico pode gerar PDF), escrita só `super_admin`.

Migration popula a linha inicial com os textos atualmente hardcoded em `OccurrenceDetails.tsx`.

### 2. Página SuperAdmin

Nova rota `/superadmin/pdf-template` → `src/pages/superadmin/OccurrencePdfTemplate.tsx`.

Layout em duas colunas:
- **Esquerda**: formulário com `Textarea`s para cada bloco do PDF, lista de placeholders disponíveis (chips clicáveis que inserem no campo focado), botão "Salvar" e "Restaurar padrão".
- **Direita**: preview ao vivo do texto renderizado com placeholders substituídos por valores de exemplo.

Adicionar entrada no menu de configurações do SuperAdmin (`src/pages/superadmin/Settings.tsx` ou sidebar) → "Template do PDF de Ocorrência".

Registrar rota em `src/App.tsx` com `ProtectedRoute requiredRole="super_admin"`.

### 3. Refatorar `OccurrenceDetails.tsx`

- No `generatePDF()`, buscar a linha de `occurrence_pdf_template` via supabase (com cache via React Query).
- Função `interpolate(text, vars)` substitui `{{chave}}` pelos valores reais da ocorrência.
- Substituir as strings hardcoded (intro, legal_basis, syndic_role, penalty, defense_deadline, closing) pelos valores vindos do template.
- Manter toda a lógica visual existente (justificação, paginação, bloco amarelo, header com logo).

### 4. Arquivos afetados

```text
NEW  supabase/migrations/<timestamp>_occurrence_pdf_template.sql
NEW  src/pages/superadmin/OccurrencePdfTemplate.tsx
NEW  src/hooks/useOccurrencePdfTemplate.ts
EDIT src/App.tsx                        (rota nova)
EDIT src/pages/superadmin/Settings.tsx  (link para a página)
EDIT src/pages/OccurrenceDetails.tsx    (consumir template do banco)
```

### 5. Detalhes técnicos

- Singleton: usar `id` fixo (ex: `00000000-0000-0000-0000-000000000001`) e `upsert` no save.
- Cache: React Query `staleTime: 5 min` para evitar refetch a cada PDF.
- Validação: campos obrigatórios não-vazios; aviso se um placeholder citado não existir.
- Toast de sucesso ao salvar.

