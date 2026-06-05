import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { TemplatesPage } from "@/components/superadmin/whatsapp/TemplatesPage";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export default function WhatsApp() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <Helmet>
        <title>Templates WhatsApp | Super Admin</title>
      </Helmet>
      <div className="space-y-4 sm:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "WhatsApp" }, { label: "Templates" }]} />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg sm:text-xl md:text-3xl font-bold text-foreground">
              Templates WhatsApp
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
              Gerencie os templates de mensagens para a API oficial da Meta
            </p>
          </div>
          <Button
            onClick={() => navigate("/superadmin/whatsapp/chat")}
            variant="outline"
            className="gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chat / Inbox</span>
          </Button>
        </div>

        <TemplatesPage />
      </div>
    </DashboardLayout>
  );
}
