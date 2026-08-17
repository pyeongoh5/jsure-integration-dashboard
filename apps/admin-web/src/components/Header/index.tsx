import { Breadcrumb } from "@/components/composites/Breadcrumb";
import { useLanguage } from "@/lib/i18n";
import { ADMIN_LANGUAGES, type AdminLanguage } from "@i18n/admin";

const LANGUAGE_LABELS: Record<AdminLanguage, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

export const Header = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <header className="admin__topbar">
      <Breadcrumb />
      <div className="admin__topbar-actions">
        <select
          className="admin__btn"
          value={language}
          onChange={(event) => setLanguage(event.target.value as AdminLanguage)}
          aria-label="Language"
        >
          {ADMIN_LANGUAGES.map((languageOption) => (
            <option key={languageOption} value={languageOption}>
              {LANGUAGE_LABELS[languageOption]}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};
