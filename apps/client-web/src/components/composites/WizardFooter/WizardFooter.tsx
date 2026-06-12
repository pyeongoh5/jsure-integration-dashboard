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
            className="wfooter__btn wfooter__btn--back"
            onClick={onBack}
            disabled={loading}
          >
            {backLabel}
          </button>
        )}
        <button
          type="button"
          className="wfooter__btn wfooter__btn--next"
          onClick={onNext}
          disabled={disabled || loading}
        >
          {loading ? "送信中…" : nextLabel}
        </button>
      </div>
    </div>
  );
}
