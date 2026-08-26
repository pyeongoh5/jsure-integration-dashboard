import { t } from "@i18n";
import type { PublishWindowText } from "../publishWindowText";

interface Props {
  window: PublishWindowText;
}

const NOTICE_STYLE = {
  fontSize: 12,
  marginTop: 10,
  textAlign: "center",
  fontWeight: 600,
} as const;

export function PublishWindowNotice({ window }: Props) {
  if (window.state === "NONE") return null;
  if (window.state === "BEFORE") {
    return (
      <p style={{ ...NOTICE_STYLE, color: "#dc2626" }}>
        {t("application.publishWindow.beforePrefix")}
        {window.startText}
        {t("application.publishWindow.beforeSuffix")}
      </p>
    );
  }
  if (window.state === "AFTER") {
    return (
      <p style={{ ...NOTICE_STYLE, color: "#dc2626" }}>
        {t("application.publishWindow.afterNotice")}
      </p>
    );
  }
  return (
    <p style={{ ...NOTICE_STYLE, color: "#6b7280" }}>
      {window.endText}
      {t("application.publishWindow.untilSuffix")}
    </p>
  );
}
