// 사용법: npx tsx scripts/hash-password.ts <비밀번호>
// 출력된 해시를 ADMIN_PASSWORD_HASH 환경변수에 설정한다.
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('usage: tsx scripts/hash-password.ts <password>');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 10));
