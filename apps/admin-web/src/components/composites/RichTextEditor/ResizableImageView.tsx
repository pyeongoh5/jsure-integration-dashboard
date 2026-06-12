import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import styles from "./NoticeEditor.module.css";

type Attrs = {
  src: string;
  width: string | null;
  alt: string | null;
  dataR2Key: string | null;
};

export function ResizableImageView(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor, getPos } = props;
  const attrs = node.attrs as Attrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState<{
    startX: number;
    startWidth: number;
    aspect: number;
  } | null>(null);
  const [displayWidth, setDisplayWidth] = useState<string | null>(attrs.width);

  function handleImageClick(event: React.MouseEvent) {
    if (!editor.isEditable) return;
    event.preventDefault();
    // 이미지 노드 선택: ProseMirror 가 click 이벤트를 NodeView 영역에서
    // 항상 받지는 못해서, 명시적으로 NodeSelection 을 걸어준다.
    if (typeof getPos === "function") {
      const pos = getPos();
      if (typeof pos === "number") {
        editor.commands.setNodeSelection(pos);
      }
    }
  }

  // attrs.width 변경 시 표시값 동기화
  useEffect(() => {
    setDisplayWidth(attrs.width);
  }, [attrs.width]);

  function startResize(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startX = event.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const naturalAspect = img.naturalWidth / img.naturalHeight || 1;
    setDragging({ startX, startWidth, aspect: naturalAspect });
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const delta = e.clientX - dragging!.startX;
      const next = Math.max(40, Math.round(dragging!.startWidth + delta));
      setDisplayWidth(`${next}px`);
    }
    function onUp() {
      if (displayWidth !== attrs.width) {
        updateAttributes({ width: displayWidth });
      }
      setDragging(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, displayWidth, attrs.width, updateAttributes]);

  const widthStyle = displayWidth ?? undefined;
  const isEditable = editor.isEditable;
  const showHandles = isEditable && selected;

  return (
    <NodeViewWrapper
      as="span"
      className={`${styles.image} ${selected ? styles.imageSelected : ""}`}
      style={{ display: "inline-block", position: "relative", lineHeight: 0 }}
    >
      <img
        ref={imgRef}
        src={attrs.src}
        alt={attrs.alt ?? ""}
        data-r2-key={attrs.dataR2Key ?? undefined}
        style={{
          width: widthStyle,
          maxWidth: "100%",
          height: "auto",
          display: "block",
          userSelect: "none",
          cursor: isEditable ? "pointer" : "default",
        }}
        draggable={false}
        onClick={handleImageClick}
      />
      {showHandles && (
        <>
          <span
            className={`${styles.imageHandle} ${styles.imageHandleBr}`}
            onMouseDown={startResize}
          />
        </>
      )}
    </NodeViewWrapper>
  );
}
