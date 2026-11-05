import { useNavigate } from "@/lib/router-compat";
import { Shield } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminRequestForm from "@/components/AdminRequestForm";

const RequestAdmin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (loading) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("requestAdmin.signInRequired")}</h1>
          <p className="text-muted-foreground mb-6">{t("requestAdmin.signInDesc")}</p>
          <button onClick={() => navigate("/auth?redirect=/request-admin")} className="px-6 py-3 rounded-lg gradient-accent text-accent-foreground font-semibold">
            {t("requestAdmin.signInContinue")}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-12 md:py-20">
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-secondary mx-auto mb-3" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">{t("requestAdmin.title")}</h1>
          <p className="text-muted-foreground max-w-md mx-auto">{t("requestAdmin.desc")}</p>
        </div>
        <AdminRequestForm />
      </div>
    </Layout>
  );
};

export default RequestAdmin;
