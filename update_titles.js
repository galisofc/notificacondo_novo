import fs from 'fs';
import path from 'path';

const pagesDir = './src/pages';

const pageTitles = {
  'Contact.tsx': 'Contato',
  'PartyHallSettings.tsx': 'Configurações do Salão de Festas',
  'Condominiums.tsx': 'Condomínios',
  'PartyHallNotifications.tsx': 'Notificações do Salão de Festas',
  'zelador/Settings.tsx': 'Configurações do Zelador',
  'PartyHall.tsx': 'Salão de Festas',
  'CondominiumDetails.tsx': 'Detalhes do Condomínio',
  'Notifications.tsx': 'Notificações',
  'SindicoSettings.tsx': 'Configurações do Síndico',
  'Occurrences.tsx': 'Ocorrências',
  'zelador/Manutencoes.tsx': 'Manutenções do Zelador',
  'OccurrenceDetails.tsx': 'Detalhes da Ocorrência',
  'ResidentAccess.tsx': 'Acesso de Morador',
  'NotFound.tsx': 'Página Não Encontrada',
  'PrivacyPolicy.tsx': 'Política de Privacidade',
  'CivilCode.tsx': 'Código Civil',
  'SindicoInvoices.tsx': 'Faturas do Síndico',
  'zelador/Dashboard.tsx': 'Dashboard do Zelador',
  'ChecklistEntrada.tsx': 'Checklist de Entrada',
  'Reports.tsx': 'Relatórios',
  'Plans.tsx': 'Planos',
  'superadmin/WhatsAppConfig.tsx': 'Configuração WhatsApp',
  'ResidentOccurrenceDetails.tsx': 'Detalhes da Ocorrência',
  'ResidentProfile.tsx': 'Perfil do Morador',
  'ResidentDashboard.tsx': 'Dashboard do Morador',
  'AuthCallback.tsx': 'Autenticando...',
  'DefenseAnalysis.tsx': 'Análise de Defesa',
  'superadmin/MagicLinkLogs.tsx': 'Logs de Magic Link',
  'TermsOfUse.tsx': 'Termos de Uso',
  'SuperAdminDashboard.tsx': 'Dashboard Super Admin',
  'porteiro/Condominio.tsx': 'Condomínio',
  'superadmin/WhatsAppChat.tsx': 'Chat WhatsApp',
  'porteiro/ShiftHandover.tsx': 'Passagem de Plantão',
  'superadmin/Logs.tsx': 'Logs do Sistema',
  'SindicoSubscriptions.tsx': 'Assinaturas do Síndico',
  'superadmin/Invoices.tsx': 'Faturas Admin',
  'porteiro/PortariaOccurrences.tsx': 'Ocorrências da Portaria',
  'superadmin/Sindicos.tsx': 'Gestão de Síndicos',
  'porteiro/Packages.tsx': 'Encomendas',
  'porteiro/RegisterPackage.tsx': 'Registrar Encomenda',
  'porteiro/Settings.tsx': 'Configurações do Porteiro',
  'porteiro/PackagesHistory.tsx': 'Histórico de Encomendas',
  'superadmin/WhatsApp.tsx': 'WhatsApp Admin',
  'ResidentOccurrences.tsx': 'Minhas Ocorrências',
  'superadmin/Subscriptions.tsx': 'Assinaturas Admin',
  'superadmin/EdgeFunctionLogs.tsx': 'Logs de Edge Functions',
  'Autenticidade.tsx': 'Autenticidade',
  'superadmin/BsuidMigration.tsx': 'Migração BSUID',
  'superadmin/Settings.tsx': 'Configurações Admin',
  'superadmin/OccurrencePdfTemplate.tsx': 'Template PDF de Ocorrência',
  'superadmin/CronJobs.tsx': 'Tarefas Agendadas',
  'superadmin/Transfers.tsx': 'Transferências',
  'superadmin/Condominiums.tsx': 'Gestão de Condomínios',
  'superadmin/SubscriptionDetails.tsx': 'Detalhes da Assinatura',
  'superadmin/PackageTypes.tsx': 'Tipos de Encomenda',
  'superadmin/ContactMessages.tsx': 'Mensagens de Contato',
  'superadmin/WabaLogs.tsx': 'Logs WABA',
  'sindico/Manutencoes.tsx': 'Manutenções',
  'sindico/Banners.tsx': 'Banners',
  'resident/Packages.tsx': 'Minhas Encomendas',
  'sindico/PackagesDashboard.tsx': 'Dashboard de Encomendas',
  'sindico/PortariaShiftHandovers.tsx': 'Passagens de Plantão',
  'sindico/Zeladores.tsx': 'Zeladores',
  'sindico/ManutencoesCategorias.tsx': 'Categorias de Manutenção',
  'sindico/PackagesCondominiumHistory.tsx': 'Histórico de Encomendas do Condomínio',
  'sindico/PackagesHistory.tsx': 'Histórico de Encomendas',
  'sindico/ShiftChecklistSettings.tsx': 'Configurações de Checklist',
  'sindico/Packages.tsx': 'Encomendas',
  'sindico/ManutencoesHistorico.tsx': 'Histórico de Manutenções',
  'sindico/Porteiros.tsx': 'Gestão de Porteiros',
};

function processFile(filePath, title) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has NotificaCondo - [Title]
  if (content.includes(`NotificaCondo - ${title}`)) return;

  // Add import Helmet if not exists
  if (!content.includes('import { Helmet }') && !content.includes('import {Helmet}')) {
    content = "import { Helmet } from 'react-helmet-async';\n" + content;
  }

  // Handle case where it already has Helmet title
  if (content.includes('<title>')) {
    content = content.replace(/<title>.*?<\/title>/, `<title>NotificaCondo - ${title}</title>`);
  } else {
    // Try to find the first <div> or fragment to insert Helmet
    const insertAfterRegex = /(return\s*\(\s*<>|return\s*\(\s*<div[^>]*>|return\s*\s*<>|return\s*\s*<div[^>]*>)/;
    if (insertAfterRegex.test(content)) {
      content = content.replace(insertAfterRegex, `$1\n      <Helmet>\n        <title>NotificaCondo - ${title}</title>\n      </Helmet>`);
    } else {
      console.log(`Could not find insertion point for ${filePath}`);
    }
  }

  fs.writeFileSync(filePath, content);
}

Object.entries(pageTitles).forEach(([file, title]) => {
  const filePath = path.join(pagesDir, file);
  if (fs.existsSync(filePath)) {
    processFile(filePath, title);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
