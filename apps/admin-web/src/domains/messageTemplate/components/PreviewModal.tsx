type Props = {
  renderedBody: string;
  onClose: () => void;
};

export function PreviewModal({ renderedBody, onClose }: Props): JSX.Element {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          padding: 24,
          minWidth: 400,
          maxWidth: 600,
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>미리보기</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f9fafb",
            padding: 12,
            borderRadius: 4,
          }}
        >
          {renderedBody}
        </pre>
        <button onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
