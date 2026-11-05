import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateUi } from "@/lib/ui-translations";

/** Only fixed UI text, controlled enums and known civic display names belong here. */
export function useUiText() {
  const { language } = useLanguage();
  return useCallback((text: string | null | undefined) => translateUi(text ?? "", language), [language]);
}
