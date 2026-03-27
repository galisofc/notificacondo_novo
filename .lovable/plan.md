

# Plano: Copiar arquivos do NotificaCondo para este projeto

## Contexto

O projeto [NotificaCondo](/projects/2da534d1-cea2-4119-8236-38e1b4d85d92) tem **~200+ arquivos** de codigo-fonte. Copiar todos usando as ferramentas cross-project vai funcionar, mas sera um processo extenso feito em lotes.

## Recomendacao importante

Antes de prosseguir, considere que **fazer um Remix** do projeto NotificaCondo seria instantaneo e copiaria tudo automaticamente. Voce pode fazer isso em: NotificaCondo > Settings > Remix this project. Depois, basta conectar o Supabase externo ao projeto remixado.

Se mesmo assim preferir copiar para **este** projeto, o plano segue abaixo.

---

## O que sera copiado (~200 arquivos)

| Categoria | Qtd. aprox. |
|---|---|
| Config (package.json, index.html, tailwind, tsconfig, etc.) | 8 |
| src/pages (raiz + porteiro + resident + sindico + superadmin + zelador) | 56 |
| src/components (17 subdiretorios) | 75 |
| src/hooks | 16 |
| src/integrations/supabase | 2 |
| src/lib | 6 |
| src/App.tsx, main.tsx, index.css, App.css | 4 |
| UI components (novos: image-cropper, masked-input, etc.) | 5 |
| Assets (logos) | 3 |
| Public (favicon, og-image, sitemap) | 4 |
| supabase/migrations (~110 arquivos SQL) | 110 |
| supabase/functions (~45 edge functions) | 90+ |

---

## Etapas de implementacao

### 1. Configuracoes base
- Atualizar `package.json` com todas as dependencias do original
- Copiar `index.html`, `tailwind.config.ts`, `.env` (sem secrets)
- Copiar `src/index.css`, `src/App.css`, `src/main.tsx`

### 2. Integracao Supabase + Auth + Roles
- Copiar `src/integrations/supabase/client.ts` e `types.ts`
- Copiar `src/hooks/useAuth.tsx`, `useUserRole.tsx` e demais hooks
- Copiar `src/components/auth/ProtectedRoute.tsx`
- Copiar `src/lib/*`

### 3. Layouts e componentes base
- Copiar `src/components/layouts/DashboardLayout.tsx`
- Copiar `src/components/common/*`, `ThemeToggle.tsx`, `NavLink.tsx`
- Copiar componentes UI novos (image-cropper, masked-input, validated-input, password-strength-indicator)

### 4. Landing page
- Copiar todos os 10 arquivos de `src/components/landing/*`
- Copiar `src/pages/Index.tsx`

### 5. Paginas publicas e auth
- Copiar Auth, AuthCallback, Contact, Plans, PrivacyPolicy, TermsOfUse, CivilCode

### 6. Modulo Sindico (paginas + componentes)
- Copiar ~20 paginas do sindico
- Copiar componentes: condominium, occurrences, dashboard, sindico, onboarding

### 7. Modulo Porteiro
- Copiar 8 paginas do porteiro
- Copiar componentes porteiro

### 8. Modulo Morador
- Copiar paginas resident
- Copiar componentes resident

### 9. Modulo Zelador
- Copiar 3 paginas do zelador

### 10. Modulo Encomendas e Salao de Festas
- Copiar componentes packages (11 arquivos)
- Copiar componentes party-hall (5 arquivos)

### 11. SuperAdmin
- Copiar 18 paginas superadmin
- Copiar ~17 componentes superadmin + 17 whatsapp subcomponents
- Copiar componentes mercadopago e notifications

### 12. App.tsx com todas as rotas
- Copiar o App.tsx completo (~656 linhas com todas as rotas)

### 13. Assets e public
- Copiar logos (logo.png, logo-icon.png, logo.webp)
- Copiar favicon.ico, favicon.png, og-image.png, sitemap.xml

### 14. Supabase migrations e edge functions
- Copiar todas as ~110 migrations SQL
- Copiar todas as ~45 edge functions (cada uma com index.ts)
- Copiar supabase/config.toml e functions/_shared

---

## Detalhes tecnicos

- Cada arquivo sera lido do projeto NotificaCondo via `cross_project--read_project_file` e escrito neste projeto via `code--write`
- Assets binarios (PNG, ICO, WEBP) serao copiados via `cross_project--copy_project_asset`
- O cliente Supabase precisara ser reconfigurado para apontar ao seu Supabase externo
- Apos a copia, voce precisara conectar seu Supabase externo e rodar as migrations

## Estimativa

Este processo levara **muitas rodadas de conversa** dado o volume de arquivos. Cada rodada copiara um lote de ~15-20 arquivos.

**Alternativa rapida**: Fazer Remix do NotificaCondo (1 clique, instantaneo).

