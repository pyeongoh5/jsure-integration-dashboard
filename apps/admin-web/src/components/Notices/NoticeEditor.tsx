import { useCallback, useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import { uploadNoticeImage, NoticeImageUploadError } from "../../lib/notices";
import "./NoticeEditor.css";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

const FONT_FAMILIES = [
  { label: "기본", value: "" },
  { label: "Sans", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Monospace", value: "monospace" },
];

export function NoticeEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "notice-editor__body",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;
  return (
    <div className="notice-editor">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = useCallback(
    async (file: File) => {
      try {
        const result = await uploadNoticeImage(file);
        editor.chain().focus().setImage({ src: `r2:${result.objectKey}` }).run();
      } catch (caught) {
        const message =
          caught instanceof NoticeImageUploadError
            ? caught.message
            : "이미지 업로드에 실패했습니다";
        window.alert(message);
      }
    },
    [editor],
  );

  const onPickFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleImage(file);
      event.target.value = "";
    },
    [handleImage],
  );

  const onSetLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="notice-editor__toolbar">
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="굵게"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="기울임"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        label="취소선"
      />
      <span className="notice-editor__divider" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="H2"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="H3"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="• 목록"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="1. 목록"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label="인용"
      />
      <span className="notice-editor__divider" />
      <select
        className="notice-editor__button"
        value={(editor.getAttributes("textStyle").fontFamily as string) ?? ""}
        onChange={(event) => {
          const family = event.target.value;
          if (family) {
            editor.chain().focus().setFontFamily(family).run();
          } else {
            editor.chain().focus().unsetFontFamily().run();
          }
        }}
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <input
        type="color"
        className="notice-editor__color"
        title="글자 색"
        value={(editor.getAttributes("textStyle").color as string) ?? "#000000"}
        onChange={(event) => {
          editor.chain().focus().setColor(event.target.value).run();
        }}
      />
      <span className="notice-editor__divider" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        label="좌"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        label="중"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        label="우"
      />
      <span className="notice-editor__divider" />
      <button
        type="button"
        className="notice-editor__button"
        onClick={onSetLink}
      >
        링크
      </button>
      <button
        type="button"
        className="notice-editor__button"
        onClick={() => fileRef.current?.click()}
      >
        이미지
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={onPickFile}
      />
    </div>
  );
}

type ButtonProps = {
  editor: Editor;
  action: () => void;
  active: boolean;
  label: string;
};

function ToolbarButton({ action, active, label }: ButtonProps) {
  return (
    <button
      type="button"
      className={`notice-editor__button ${active ? "is-active" : ""}`}
      onClick={action}
    >
      {label}
    </button>
  );
}
