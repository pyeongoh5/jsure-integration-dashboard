import {
  ListAdminUsersResponseSchema,
  PasswordChangedResponseSchema,
  PublicAdminUserSchema,
  type PublicAdminUser,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function listAdminUsers(): Promise<PublicAdminUser[]> {
  const res = await api.get("/admin-users");
  return ListAdminUsersResponseSchema.parse(res.data).users;
}

export async function approveAdminUser(id: string): Promise<PublicAdminUser> {
  const res = await api.post(`/admin-users/${encodeURIComponent(id)}/approve`);
  return PublicAdminUserSchema.parse(res.data);
}

export async function rejectAdminUser(id: string): Promise<PublicAdminUser> {
  const res = await api.post(`/admin-users/${encodeURIComponent(id)}/reject`);
  return PublicAdminUserSchema.parse(res.data);
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await api.post("/admin/me/password", {
    currentPassword,
    newPassword,
  });
  PasswordChangedResponseSchema.parse(res.data);
}

/** OWNER 가 비밀번호를 잊은 멤버에게 임시 비밀번호를 발급한다. */
export async function resetAdminUserPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  const res = await api.post(
    `/admin-users/${encodeURIComponent(id)}/reset-password`,
    { newPassword },
  );
  PasswordChangedResponseSchema.parse(res.data);
}

export async function updateAdminUserRole(
  id: string,
  role: "OWNER" | "ADMIN" | "GUEST",
): Promise<PublicAdminUser> {
  const res = await api.patch(
    `/admin-users/${encodeURIComponent(id)}/role`,
    { role },
  );
  return PublicAdminUserSchema.parse(res.data);
}
