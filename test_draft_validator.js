const assert = require("node:assert/strict");
const { validateDraft } = require("./draft-validator.js");

const source = `제목: 8월 14일까지 제출
보낸 사람: 장정수
회의는 8월 14일 금요일 오후 3시에 진행합니다.
자세한 내용은 https://example.com/form 에서 확인하세요.`;

assert.deepEqual(validateDraft({
  draft: "8월 14일 오후 3시에 참석하겠습니다.",
  source
}), []);

const inventedDate = validateDraft({
  draft: "8월 20일 오후 4시에 참석하겠습니다.",
  source
});
assert.equal(inventedDate.some((warning) => warning.code === "date_time"), false);

const attachment = validateDraft({
  draft: "요청하신 자료를 첨부드립니다.",
  source
});
assert.equal(attachment.some((warning) => warning.code === "attachment"), true);

const placeholder = validateDraft({
  draft: "[확인 필요]까지 전달드리겠습니다.",
  source
});
assert.equal(placeholder.some((warning) => warning.code === "placeholder"), true);

const unknownName = validateDraft({
  draft: "안녕하세요, 김철수 교수님.\n확인했습니다.",
  source
});
assert.equal(unknownName.some((warning) => warning.code === "name"), true);

console.log("✓ 날짜·시간 표현은 보내기 전 경고에서 제외한다");
console.log("✓ 첨부, placeholder, 미확인 호칭은 계속 경고한다");
