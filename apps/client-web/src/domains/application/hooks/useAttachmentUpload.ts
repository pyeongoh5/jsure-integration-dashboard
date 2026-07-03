import { useRef, useState } from "react";
import type { AttachmentKind, AttachmentUploadInput } from "@jsure/shared";
import { t } from "@i18n";
import {
  UploadError,
  uploadInfluencerAttachment,
} from "@/lib/api/uploads";

const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadedAttachment extends AttachmentUploadInput {
  previewUrl: string;
  name: string;
}

interface Options {
  applicationId: string;
  kind: AttachmentKind;
  maxFiles: number;
}

export function useAttachmentUpload({
  applicationId,
  kind,
  maxFiles,
}: Options) {
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = pendingCount > 0;
  const remaining = maxFiles - attachments.length;

  async function uploadOne(file: File): Promise<UploadedAttachment | null> {
    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      setError(`${t("application.attachmentUpload.unsupportedPrefix")}${file.name}`);
      return null;
    }
    if (file.size > MAX_BYTES) {
      setError(`${t("application.attachmentUpload.oversizedPrefix")}${file.name}`);
      return null;
    }
    try {
      const uploaded = await uploadInfluencerAttachment(
        applicationId,
        kind,
        file,
      );
      return {
        ...uploaded,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      };
    } catch (err) {
      const message =
        err instanceof UploadError
          ? err.message
          : t("application.attachmentUpload.genericError");
      setError(`${message} (${file.name})`);
      return null;
    }
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    setError(null);
    if (remaining <= 0) {
      setError(
        `${t("application.attachmentUpload.maxFilesPrefix")}${maxFiles}${t("application.attachmentUpload.maxFilesSuffix")}`,
      );
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setPendingCount((count) => count + list.length);
    try {
      for (const file of list) {
        try {
          const uploaded = await uploadOne(file);
          if (uploaded) {
            setAttachments((prev) => [...prev, uploaded]);
          }
        } finally {
          setPendingCount((count) => count - 1);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("application.attachmentUpload.genericError"),
      );
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, position) => position !== index);
    });
  }

  function toInputs(): AttachmentUploadInput[] {
    return attachments.map((attachment) => ({
      objectKey: attachment.objectKey,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    }));
  }

  return {
    attachments,
    pendingCount,
    uploading,
    remaining,
    error,
    setError,
    fileInputRef,
    handleFiles,
    removeAttachment,
    toInputs,
  };
}
