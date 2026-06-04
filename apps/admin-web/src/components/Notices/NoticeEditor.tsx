import { useCallback, useEffect, useRef } from "react";
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
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import { startNoticeImageUpload, NoticeImageUploadError } from "../../lib/notices";
import { ResizableImageView } from "./ResizableImageView";
import "./NoticeEditor.css";

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
      ImageWithR2Key.configure({ inline: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "<p></p>",
    // 셀렉션만 바뀌어도 toolbar (editor.isActive) 가 갱신되도록 강제 리렌더
    shouldRerenderOnTransaction: true,
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
    (file: File) => {
      let handle;
      try {
        handle = startNoticeImageUpload(file);
      } catch (caught) {
        const message =
          caught instanceof NoticeImageUploadError
            ? caught.message
            : "이미지 업로드에 실패했습니다";
        window.alert(message);
        return;
      }

      // 1) 즉시 로컬 objectURL 로 에디터 삽입 (R2 왕복 대기 없음)
      const { previewUrl, done } = handle;
      editor
        .chain()
        .focus()
        .setImage({
          src: previewUrl,
          dataR2Key: null,
        } as { src: string; dataR2Key: string | null })
        .run();

      // 2) 업로드 완료되면 같은 src 를 가진 이미지 노드에 dataR2Key 채워줌
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
            caught instanceof NoticeImageUploadError
              ? caught.message
              : "이미지 업로드에 실패했습니다";
          window.alert(message);
          // 실패한 이미지 노드는 제거
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
    [editor],
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

      {editor.isActive("image") && (
        <ImageSizeControls editor={editor} />
      )}
    </div>
  );
}

function ImageSizeControls({ editor }: { editor: Editor }) {
  const currentWidth = editor.getAttributes("image").width as string | null;

  // 프리셋/원본 버튼: 처리 후 에디터에 포커스 복귀
  const setWidthWithFocus = (width: string | null) => {
    editor.chain().focus().updateAttributes("image", { width }).run();
  };

  // px 입력: 매 키 입력마다 editor.focus() 가 따라가면 input 포커스가 빠지므로
  // focus 없이 attribute 만 업데이트.
  const updateWidthOnly = (width: string | null) => {
    editor.commands.updateAttributes("image", { width });
  };

  const pxValue =
    currentWidth && !currentWidth.endsWith("%")
      ? currentWidth.replace(/px$/, "")
      : "";

  return (
    <>
      <span className="notice-editor__divider" />
      <span style={{ fontSize: 11, color: "#6b7280", alignSelf: "center" }}>
        이미지
      </span>
      {["25%", "50%", "75%", "100%"].map((preset) => (
        <button
          key={preset}
          type="button"
          className={`notice-editor__button ${currentWidth === preset ? "is-active" : ""}`}
          onClick={() => setWidthWithFocus(preset)}
        >
          {preset}
        </button>
      ))}
      <input
        type="text"
        className="notice-editor__size-input"
        placeholder="예: 300"
        value={pxValue}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d]/g, "");
          updateWidthOnly(raw ? `${raw}px` : null);
        }}
        title="픽셀(px) 단위 너비"
      />
      <span style={{ fontSize: 11, color: "#6b7280", alignSelf: "center" }}>
        px
      </span>
      <button
        type="button"
        className="notice-editor__button"
        onClick={() => setWidthWithFocus(null)}
        title="원본 크기"
      >
        원본
      </button>
    </>
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
