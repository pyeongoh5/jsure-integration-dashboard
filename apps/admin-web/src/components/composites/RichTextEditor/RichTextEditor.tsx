import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import {
  EditorContent,
  ReactNodeViewRenderer,
  useEditor,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import {
  RichTextImageUploadError,
  startRichTextImageUpload,
} from "@/lib/richTextImages";
import { useT } from "@/lib/i18n";
import { ResizableImageView } from "./ResizableImageView";
import styles from "./NoticeEditor.module.css";

type Props = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
  disabled?: boolean;
  /**
   * 지정 시 툴바에 이미지 버튼이 노출되고, 해당 presign 엔드포인트로 업로드.
   * 예: "/uploads/admin/campaign-image/presign"
   */
  imageUploadEndpoint?: string;
};

const ImageWithR2Key = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataR2Key: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-r2-key"),
        renderHTML: (attributes) => {
          if (!attributes.dataR2Key) return {};
          return { "data-r2-key": attributes.dataR2Key as string };
        },
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width as string };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

/**
 * 캠페인 폼 등에서 사용하는 범용 tiptap 리치 에디터.
 * - 이미지/폰트 패밀리는 빠진 슬림 버전 (NoticeEditor 대비)
 * - 스타일은 NoticeEditor.module.css 의 클래스를 그대로 재사용
 */
export function RichTextEditor({
  value,
  onChange,
  minHeight = 180,
  disabled = false,
  imageUploadEndpoint,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageWithR2Key.configure({ inline: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "<p></p>",
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: styles.body ?? "",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  // 본문은 minHeight 의 3배까지만 커지고, 그 이상은 스크롤. 툴바는 스크롤 영역 밖이라 상단 고정.
  const rootStyle = {
    minHeight: minHeight + 48,
    ["--rte-max-body-height" as string]: `${minHeight * 3}px`,
  } as CSSProperties;

  if (!editor) {
    // 에디터 초기화 중에도 자리를 잡아둠 (높이가 0 으로 줄어들지 않게)
    return <div className={styles.root} style={rootStyle} />;
  }
  return (
    <div className={styles.root} style={rootStyle}>
      <Toolbar editor={editor} imageUploadEndpoint={imageUploadEndpoint} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  imageUploadEndpoint,
}: {
  editor: Editor;
  imageUploadEndpoint?: string;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = useCallback(
    (file: File) => {
      if (!imageUploadEndpoint) return;
      let handle;
      try {
        handle = startRichTextImageUpload(file, imageUploadEndpoint);
      } catch (caught) {
        const message =
          caught instanceof RichTextImageUploadError
            ? caught.message
            : t("components.richTextEditor.imageUploadFailed");
        window.alert(message);
        return;
      }
      const { previewUrl, done } = handle;
      editor
        .chain()
        .focus()
        .setImage({
          src: previewUrl,
          dataR2Key: null,
        } as { src: string; dataR2Key: string | null })
        .run();

      done
        .then((result) => {
          let foundPos: number | null = null;
          editor.state.doc.descendants((node, pos) => {
            if (
              foundPos === null &&
              node.type.name === "image" &&
              node.attrs.src === previewUrl
            ) {
              foundPos = pos;
              return false;
            }
            return true;
          });
          if (foundPos !== null) {
            editor.commands.command(({ tr, dispatch }) => {
              const node = tr.doc.nodeAt(foundPos!);
              if (!node) return false;
              if (dispatch) {
                tr.setNodeMarkup(foundPos!, undefined, {
                  ...node.attrs,
                  dataR2Key: result.objectKey,
                });
                dispatch(tr);
              }
              return true;
            });
          }
        })
        .catch((caught: unknown) => {
          const message =
            caught instanceof RichTextImageUploadError
              ? caught.message
              : t("components.richTextEditor.imageUploadFailed");
          window.alert(message);
          const tr = editor.state.tr;
          let removed = false;
          editor.state.doc.descendants((node, pos) => {
            if (
              !removed &&
              node.type.name === "image" &&
              node.attrs.src === previewUrl
            ) {
              tr.delete(pos, pos + node.nodeSize);
              removed = true;
              return false;
            }
            return true;
          });
          if (removed) editor.view.dispatch(tr);
          URL.revokeObjectURL(previewUrl);
        });
    },
    [editor, imageUploadEndpoint, t],
  );

  const onPickFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) handleImage(file);
      event.target.value = "";
    },
    [handleImage],
  );

  const onSetLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      t("components.richTextEditor.linkUrlPrompt"),
      previous ?? "https://",
    );
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, t]);

  return (
    <div className={styles.toolbar}>
      <ToolbarButton
        action={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label={t("components.richTextEditor.bold")}
      />
      <ToolbarButton
        action={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label={t("components.richTextEditor.italic")}
      />
      <ToolbarButton
        action={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        label={t("components.richTextEditor.strikethrough")}
      />
      <span className={styles.divider} />
      <ToolbarButton
        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="H2"
      />
      <ToolbarButton
        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="H3"
      />
      <ToolbarButton
        action={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label={t("components.richTextEditor.bulletList")}
      />
      <ToolbarButton
        action={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label={t("components.richTextEditor.orderedList")}
      />
      <ToolbarButton
        action={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label={t("components.richTextEditor.blockquote")}
      />
      <span className={styles.divider} />
      <input
        type="color"
        className={styles.color}
        title={t("components.richTextEditor.textColor")}
        value={(editor.getAttributes("textStyle").color as string) ?? "#000000"}
        onChange={(event) => {
          editor.chain().focus().setColor(event.target.value).run();
        }}
      />
      <span className={styles.divider} />
      <ToolbarButton
        action={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        label={t("components.richTextEditor.alignLeft")}
      />
      <ToolbarButton
        action={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        label={t("components.richTextEditor.alignCenter")}
      />
      <ToolbarButton
        action={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        label={t("components.richTextEditor.alignRight")}
      />
      <span className={styles.divider} />
      <button
        type="button"
        className={styles.button}
        onClick={onSetLink}
      >
        {t("components.richTextEditor.link")}
      </button>
      {imageUploadEndpoint ? (
        <>
          <button
            type="button"
            className={styles.button}
            onClick={() => fileRef.current?.click()}
          >
            {t("components.richTextEditor.image")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
          {editor.isActive("image") && <ImageSizeControls editor={editor} />}
        </>
      ) : null}
    </div>
  );
}

function ImageSizeControls({ editor }: { editor: Editor }) {
  const t = useT();
  const currentWidth = editor.getAttributes("image").width as string | null;

  const setWidthWithFocus = (width: string | null) => {
    editor.chain().focus().updateAttributes("image", { width }).run();
  };
  const updateWidthOnly = (width: string | null) => {
    editor.commands.updateAttributes("image", { width });
  };

  const pxValue =
    currentWidth && !currentWidth.endsWith("%")
      ? currentWidth.replace(/px$/, "")
      : "";

  return (
    <>
      <span className={styles.divider} />
      <span style={{ fontSize: 11, color: "#6b7280", alignSelf: "center" }}>
        {t("components.richTextEditor.image")}
      </span>
      {["25%", "50%", "75%", "100%"].map((preset) => (
        <button
          key={preset}
          type="button"
          className={`${styles.button} ${currentWidth === preset ? styles.buttonActive : ""}`}
          onClick={() => setWidthWithFocus(preset)}
        >
          {preset}
        </button>
      ))}
      <input
        type="text"
        className={styles.sizeInput}
        placeholder={t("components.richTextEditor.widthPlaceholder")}
        value={pxValue}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d]/g, "");
          updateWidthOnly(raw ? `${raw}px` : null);
        }}
        title={t("components.richTextEditor.widthInPixelsTitle")}
      />
      <span style={{ fontSize: 11, color: "#6b7280", alignSelf: "center" }}>
        px
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={() => setWidthWithFocus(null)}
        title={t("components.richTextEditor.originalSizeTitle")}
      >
        {t("components.richTextEditor.originalSize")}
      </button>
    </>
  );
}

type ButtonProps = {
  action: () => void;
  active: boolean;
  label: string;
};

function ToolbarButton({ action, active, label }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.buttonActive : ""}`}
      onMouseDown={(event) => {
        event.preventDefault();
        action();
      }}
    >
      {label}
    </button>
  );
}
