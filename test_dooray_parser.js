const assert = require("node:assert/strict");
const parser = require("./mail-parser.js");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("공백과 줄바꿈을 정규화한다", () => {
  assert.equal(parser.normalizeWhitespace("  안녕하세요\r\n\r\n\r\n  반갑습니다  "), "안녕하세요\n\n반갑습니다");
});

test("Dooray 창 제목에서 실제 메일 제목만 남긴다", () => {
  assert.equal(parser.cleanSubject("RE: 연구 미팅 일정 - Dooray!"), "RE: 연구 미팅 일정");
  assert.equal(
    parser.cleanSubject("전체 메일 : 💵숨고르기에 들어간 3대 지수 : KAIST : Dooray!"),
    "💵숨고르기에 들어간 3대 지수"
  );
});

test("발신자 라벨과 날짜를 제거한다", () => {
  assert.equal(parser.cleanSender("보낸 사람: 홍길동 2026.08.11 09:30"), "홍길동");
});

test("툴바 문구를 본문에서 제거한다", () => {
  const input = "전체 답장\n답장\n안녕하세요.\n요청하신 자료를 전달드립니다.\n첨부 파일 2";
  assert.equal(parser.removeUiNoise(input), "안녕하세요.\n요청하신 자료를 전달드립니다.");
});

test("너무 짧은 문자열은 본문으로 보지 않는다", () => {
  assert.equal(parser.isPlausibleBody("확인"), false);
  assert.equal(parser.isPlausibleBody("안녕하세요.\n요청하신 자료를 오늘 오후까지 전달드리겠습니다."), true);
});

test("같은 메일은 같은 fingerprint를 만든다", () => {
  const mail = { subject: "일정", sender: "홍길동", body: "충분히 긴 메일 본문입니다. 다음 주 일정을 확인해 주세요." };
  assert.equal(parser.makeFingerprint(mail), parser.makeFingerprint({ ...mail }));
  assert.notEqual(parser.makeFingerprint(mail), parser.makeFingerprint({ ...mail, subject: "다른 일정" }));
});

test("우측 읽기 창 전체 텍스트에서 제목을 찾는다", () => {
  const pane = `전체 답장 삭제 보관 이동 서비스 등록
(8/14까지 제출) 2027년 2월 졸업예정자 예비졸업사정 안내 (Pre-Graduation Review for Feb. 2027 Graduates)
장정수 08.11 11:52 [143.248.131.173, Korea, Republic of]
받는 사람: 생명화공-박사, 생명화공-석사
참조: 생명화학공학과교수
첨부 파일 2
본 메일은 대학원생에게 발송되는 메일입니다.`;
  assert.equal(
    parser.extractSubjectFromPane(pane),
    "(8/14까지 제출) 2027년 2월 졸업예정자 예비졸업사정 안내 (Pre-Graduation Review for Feb. 2027 Graduates)"
  );
});

test("발신자 이름을 메일 제목으로 오인하지 않는다", () => {
  const pane = `RE: 연구 미팅 일정 확인
윤용종
받는 사람: Sunwook Kim
안녕하세요. 다음 주 연구 미팅 일정을 확인 부탁드립니다.`;
  assert.equal(parser.extractSubjectFromPane(pane, "윤용종"), "RE: 연구 미팅 일정 확인");
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error.stack);
  }
}

if (failures) process.exitCode = 1;
else console.log(`\n${tests.length}개 테스트 통과`);
