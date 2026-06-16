---
name: Responsável Advertência/Multa
description: Distinção inquilino x proprietário em advertências e multas; notificação enviada para ambos quando inquilino é responsável
type: feature
---
- `residents` tem `resident_type` (`proprietario`|`inquilino`), `owner_name`, `owner_phone`, `owner_email`.
- `occurrences` tem snapshot `responsible_party`/`responsible_name`/`responsible_phone` na decisão.
- Edge `notify-resident-decision`: se `resident_type='inquilino'` e existe `owner_phone`, envia template para AMBOS (inquilino + proprietário). Logs em `whatsapp_notification_logs.recipient_role`.
- UI: dialog em `DefenseAnalysis.tsx` mostra seletor "Tipo (Inquilino/Proprietário)" + nome editável. Cadastro do morador em `CondominiumDetails.tsx` mostra bloco "Dados do proprietário" quando tipo = inquilino.
- SQL manual: `.lovable/manual-sql/2026-06-16-occurrence-responsible-party.sql`.
