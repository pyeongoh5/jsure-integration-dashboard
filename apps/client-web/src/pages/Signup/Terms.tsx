import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { INFLUENCER_TERMS, type ConsentItem } from "@jsure/shared";
import { TermsAccordion } from "../../components/Signup/TermsAccordion";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { useSignup } from "../../context/SignupContext";

export function SignupTerms() {
  const nav = useNavigate();
  const { draft, setAgreedItems } = useSignup();
  const initial = new Set<ConsentItem>(draft.agreedItems);
  const [agreed, setAgreed] = useState<Set<ConsentItem>>(initial);
  const [showKorean, setShowKorean] = useState(false);

  const allChecked = INFLUENCER_TERMS.every((t) => agreed.has(t.key));

  function toggle(k: ConsentItem) {
    setAgreed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleAll() {
    if (allChecked) {
      setAgreed(new Set());
    } else {
      setAgreed(new Set(INFLUENCER_TERMS.map((t) => t.key)));
    }
  }

  function next() {
    if (!allChecked) return;
    setAgreedItems(Array.from(agreed));
    nav("/signup/account");
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
        利用規約への同意
      </h2>
      <TermsAccordion
        agreed={agreed}
        onToggle={toggle}
        onToggleAll={toggleAll}
        showKorean={showKorean}
        onToggleKorean={() => setShowKorean((v) => !v)}
      />
      <div style={{ marginTop: 20 }}>
        <PrimaryButton onClick={next} disabled={!allChecked}>
          次へ
        </PrimaryButton>
      </div>
    </div>
  );
}
