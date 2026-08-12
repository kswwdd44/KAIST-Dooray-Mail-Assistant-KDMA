const assert = require("node:assert/strict");
const fs = require("node:fs");

const background = fs.readFileSync("background.js", "utf8");
const content = fs.readFileSync("content.js", "utf8");
const sidepanel = fs.readFileSync("sidepanel.js", "utf8");
const html = fs.readFileSync("sidepanel.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

assert.match(background, /"x-goog-api-key"\s*:\s*apiKey/u, "API 키는 요청 헤더로 전송해야 한다");
assert.doesNotMatch(background, /[?&]key=\$\{encodeURIComponent\(apiKey\)\}/u, "API 키를 URL에 넣으면 안 된다");
assert.match(background, /privacyConsentVersion\s*!==\s*PRIVACY_CONSENT_VERSION/u, "백그라운드 요청에 동의 검사가 필요하다");
assert.match(content, /if \(!privacyConsentAccepted\) return;/u, "동의 전 메일 감시를 막아야 한다");
assert.match(content, /ENABLE_MAIL_ASSISTANT/u, "동의 후 메일 감시를 시작할 수 있어야 한다");
assert.match(sidepanel, /showConsentScreen/u, "최초 동의 화면이 필요하다");
assert.match(html, /무료 API 이용 시 주의/u, "무료 API 데이터 이용 안내가 필요하다");
assert.match(html, /사람 검토자가 읽을 수/u, "무료 API의 사람 검토 가능성을 고지해야 한다");
assert.match(html, /privacy-policy\.html/u, "개인정보처리방침 링크가 필요하다");
assert.doesNotMatch(`${background}\n${sidepanel}\n${html}`, /gemini-2\.5-flash-lite/u, "종료 예정 모델을 제공하면 안 된다");
assert.match(manifest.description, /공식 제품이 아닙니다/u, "비공식 제품 고지가 필요하다");
assert.ok(fs.existsSync("privacy-policy.html"), "개인정보처리방침 파일이 필요하다");

console.log("✓ 개인정보 동의·API 키 전송·모델 목록 배포 가드 통과");
