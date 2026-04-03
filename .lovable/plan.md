

# Atualização da URL do Checklist de Entrada

## Mudança

No plano do Checklist de Entrada Digital, a URL enviada no WhatsApp será construída usando o domínio oficial `https://notificacondo.com.br`, seguindo o padrão já usado em todas as outras edge functions do projeto.

## Como será feito

Na edge function `start-party-hall-usage`, ao montar o link do checklist, buscar a URL base da tabela `app_settings` (chave `app_url`) ou `whatsapp_config.app_url`, com fallback para `https://notificacondo.com.br`:

```typescript
const { data: appSettings } = await supabase
  .from("app_settings")
  .select("value")
  .eq("key", "app_url")
  .maybeSingle();

const appBaseUrl = (appSettings?.value as string) || "https://notificacondo.com.br";
const checklistLink = `${appBaseUrl}/checklist-entrada/${checklistToken}`;
```

Resultado: o morador recebe no WhatsApp o link `https://notificacondo.com.br/checklist-entrada/{token}`.

O plano principal do checklist será atualizado para refletir esta URL.

