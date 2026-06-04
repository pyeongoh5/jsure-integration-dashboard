import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { AuthShell } from "./layouts/AuthShell";
import { SignupShell } from "./layouts/SignupShell";
import { Login } from "./pages/Auth/Login";
import { LineReturn } from "./pages/Auth/LineReturn";
import { LineSignup } from "./pages/Signup/LineSignup";
import { SignupTerms } from "./pages/Signup/Terms";
import { SignupAccount } from "./pages/Signup/Account";
import { SignupProfile } from "./pages/Signup/Profile";
import { SignupSns } from "./pages/Signup/Sns";
import { SignupBank } from "./pages/Signup/Bank";
import { Browse } from "./pages/Browse";
import { CampaignDetail } from "./pages/CampaignDetail";
import { Apply } from "./pages/Apply";
import { Applications } from "./pages/Applications";
import { ApplicationDetail } from "./pages/Applications/Detail";
import { Me } from "./pages/Me";
import { Notices } from "./pages/Notices";
import { NoticeDetail } from "./pages/Notices/Detail";
import { MeProfile } from "./pages/Me/Profile";
import { MeSns } from "./pages/Me/Sns";
import { MeBank } from "./pages/Me/Bank";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<AuthShell />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Navigate to="/signup/terms" replace />} />
        <Route path="/auth/line-return" element={<LineReturn />} />
      </Route>

      <Route element={<SignupShell />}>
        <Route path="/signup/terms" element={<SignupTerms />} />
        <Route path="/signup/account" element={<SignupAccount />} />
        <Route path="/signup/profile" element={<SignupProfile />} />
        <Route path="/signup/sns" element={<SignupSns />} />
        <Route path="/signup/bank" element={<SignupBank />} />
        <Route path="/signup/line" element={<LineSignup />} />
      </Route>

      <Route element={<AppShell />}>
        <Route path="/" element={<Browse />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/campaigns/:id/apply" element={<Apply />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/me" element={<Me />} />
        <Route path="/me/profile" element={<MeProfile />} />
        <Route path="/me/sns" element={<MeSns />} />
        <Route path="/me/bank" element={<MeBank />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/notices/:id" element={<NoticeDetail />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
