import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";

const Contact = () => {
  const { t } = useLanguage();

  return (
    <Layout>
      <div className="container py-12 md:py-16 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">{t("contact.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("contact.subtitle")}</p>
        </motion.div>

        <p className="text-sm text-muted-foreground">{t("contact.sent")}</p>
      </div>
    </Layout>
  );
};

export default Contact;
