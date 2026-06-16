---
name: Responsável por Advertência/Multa + Cadastro Independente de Proprietário
description: Inquilino x proprietário em residents, notifica ambos; proprietário agora em tabela própria property_owners vinculado por FK
type: feature
---

## Modelo
- `residents.resident_type`: `proprietario` (default) | `inquilino`.
- `residents.property_owner_id`: FK → `property_owners(id)` com `ON DELETE SET NULL`. Excluir inquilino NÃO apaga o proprietário.
- `residents.owner_name/owner_phone/owner_email`: snapshot mantido para compatibilidade; sincronizado a partir do `property_owners` selecionado.
- `property_owners`: tabela por condomínio (`condominium_id`, `full_name`, `cpf`, `phone`, `email`, `address`).
- `occurrences.responsible_party` / `responsible_name` / `responsible_phone`: snapshot da decisão.
- `whatsapp_notification_logs.recipient_role`: `morador` | `inquilino` | `proprietario`.

## UI
- `CondominiumDetails`: nova seção **Proprietários** (collapsible) + dialog `OwnerFormDialog`. No cadastro de inquilino, escolhe-se um proprietário existente via select, com botão "Cadastrar novo".
- Exclusão de proprietário bloqueada se houver inquilinos vinculados.

## Notificação
`notify-resident-decision`: busca proprietário via `property_owner_id` (fallback para snapshot `owner_*`). Envia template WABA para inquilino + proprietário quando aplicável.

## SQL manual
- `.lovable/manual-sql/2026-06-16-occurrence-responsible-party.sql`
- `.lovable/manual-sql/2026-06-16-property-owners.sql`
