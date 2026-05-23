import { ListAdminUsersResponseSchema, type PublicAdminUser } from "@jsure/shared";
import { api } from "./api";

export async function listAdminUsers(): Promise<PublicAdminUser[]> {
  const res = await api.get("/admin-users");
  return ListAdminUsersResponseSchema.parse(res.data).users;
}
