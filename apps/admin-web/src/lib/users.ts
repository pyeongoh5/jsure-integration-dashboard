import { ListUsersResponseSchema, type PublicUser } from "@jsure/shared";
import { api } from "./api";

export async function listUsers(): Promise<PublicUser[]> {
  const res = await api.get("/users");
  return ListUsersResponseSchema.parse(res.data).users;
}
