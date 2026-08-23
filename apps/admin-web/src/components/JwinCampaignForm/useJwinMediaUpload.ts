import { useState } from "react";
import { useT } from "@/lib/i18n";
import { JwinUploadError, uploadJwinMedia } from "@/lib/jwinUploads";

/**
 * 파일 하나를 올리는 동안의 진행·에러 상태만 들고 있는다.
 * 올라간 URL 을 어디에 넣을지는 호출부(소재 폼 / 결과화면 폼)가 정한다.
 */
export function useJwinMediaUpload() {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 성공하면 공개 URL, 실패하면 null (에러 메시지는 error 에 담긴다) */
  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    setError(null);
    try {
      return await uploadJwinMedia(file);
    } catch (caught: unknown) {
      // JwinUploadError 의 메시지는 이미 현재 언어로 번역돼 있다
      if (caught instanceof JwinUploadError) setError(caught.message);
      else setError(t("jwin.upload.failed"));
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, error, upload, clearError: () => setError(null) };
}
