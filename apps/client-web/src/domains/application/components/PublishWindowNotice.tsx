import { t } from "@i18n";
import type { PublishWindowText } from "../publishWindowText";

interface Props {
  publishWindow: PublishWindowText;
}

const NOTICE_STYLE = {
  fontSize: 12,
  marginTop: 10,
  textAlign: "center",
  fontWeight: 600,
} as const;

export function PublishWindowNotice({ publishWindow }: Props) {
  if (publishWindow.state === "NONE") return null;
  if (publishWindow.state === "BEFORE") {
    return (
      <p style={{ ...NOTICE_STYLE, color: "#dc2626" }}>
        {publishWindow.startText}
        {t("application.publishWindow.beforeSuffix")}
      </p>
    );
  }
  if (publishWindow.state === "AFTER") {
    return (
      <p style={{ ...NOTICE_STYLE, color: "#dc2626" }}>
        {t("application.publishWindow.afterNotice")}
      </p>
    );
  }
  return (
    <p style={{ ...NOTICE_STYLE, color: "#6b7280" }}>
      {publishWindow.endText}
      {t("application.publishWindow.untilSuffix")}
    </p>
  );
}
