import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { RequireAuth } from "./components/RequireAuth";
import { Overview } from "./pages/Overview";
import { Campaigns } from "./pages/Campaigns";
import { CampaignNew } from "./pages/Campaigns/New";
import { CampaignEdit } from "./pages/Campaigns/Edit";
import { Applicants } from "./pages/Applicants";
import { Drafts } from "./pages/Drafts";
import { Influencers } from "./pages/Influencers";
import { Brands } from "./pages/Brands";
import { Payouts } from "./pages/Payouts";
import { Reports } from "./pages/Reports";
import { Team } from "./pages/Team";
import { Notices } from "./pages/Notices";
import { NoticeEdit } from "./pages/Notices/Edit";
import { MessageTemplates } from "./pages/MessageTemplates";
import { MessageTemplateEdit } from "./pages/MessageTemplates/Edit";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route path="/overview" element={<Overview />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<CampaignNew />} />
        <Route path="/campaigns/:id/edit" element={<CampaignEdit />} />
        <Route path="/applicants" element={<Applicants />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/influencers" element={<Influencers />} />
        <Route path="/brands" element={<Brands />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/team" element={<Team />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/notices/new" element={<NoticeEdit mode="create" />} />
        <Route path="/notices/:id/edit" element={<NoticeEdit mode="edit" />} />
        <Route path="/message-templates" element={<MessageTemplates />} />
        <Route
          path="/message-templates/:category/:subType/:triggerKey"
          element={<MessageTemplateEdit />}
        />
      </Route>
      <Route path="/*" element={<NotFound />} />
    </Routes>
  );
}
