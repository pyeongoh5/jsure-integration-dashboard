import "./WizardFooter.css";

interface Props {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function WizardFooter({
  onBack,
  onNext,
  nextLabel = "次へ",
  backLabel = "戻る",
  disabled,
  loading,
}: Props) {
  return (
    <div className="wfooter">
      <div className="wfooter__inner">
        {onBack && (
          <button
            type="button"
            className="wfooter__back"
            onClick={onBack}
            disabled={loading}
          >
            <i className="fa-solid fa-chevron-left" />
            <span>{backLabel}</span>
          </button>
        )}
        <button
          type="button"
          className="wfooter__next"
          onClick={onNext}
          disabled={disabled || loading}
        >
          {loading ? "送信中…" : nextLabel}
        </button>
      </div>
    </div>
  );
}
