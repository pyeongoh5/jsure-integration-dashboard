/** 어드민 사용자 표시 라벨. 이름이 비어 있으면 이메일로 대체한다. */
export function adminUserLabel(user: { name: string | null; email: string }): string {
  return user.name || user.email;
}
