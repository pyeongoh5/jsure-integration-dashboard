import { Outlet, useLocation } from "react-router-dom";
import { SignupProvider } from "../context/SignupContext";
import "./SignupShell.css";

const SIGNUP_STEPS = [
  "/signup/terms",
  "/signup/account",
  "/signup/profile",
  "/signup/sns",
  "/signup/bank",
];

function progressPercent(pathname: string): number {
  const i = SIGNUP_STEPS.indexOf(pathname);
  if (i < 0) return 0;
  return ((i + 1) / SIGNUP_STEPS.length) * 100;
}

export function SignupShell() {
  const { pathname } = useLocation();
  const percent = progressPercent(pathname);
  const step = SIGNUP_STEPS.indexOf(pathname) + 1;
  return (
    <SignupProvider>
      <div className="signup-shell">
        <div className="signup-shell__progress-wrap">
          <div className="signup-shell__step">STEP {step}/5</div>
          <div className="signup-shell__progress">
            <div
              className="signup-shell__progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <main className="signup-shell__main">
          <Outlet />
        </main>
      </div>
    </SignupProvider>
  );
}
