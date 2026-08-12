(function initMailParser(globalScope) {
  const UI_NOISE = [
    "전체 답장", "답장", "전달", "삭제", "이동", "스팸 신고", "서비스 등록",
    "받은 메일함", "보낸 메일함", "메일 쓰기", "첨부 파일", "더보기"
  ];

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[\t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function removeUiNoise(value) {
    const lines = normalizeWhitespace(value).split("\n");
    return normalizeWhitespace(
      lines.filter((line) => {
        if (!line) return false;
        if (/^(읽음|안읽음|중요|보관|인쇄|새 창)$/u.test(line)) return false;
        if (/^(첨부 파일|첨부파일)\s*\d*/u.test(line) && line.length < 30) return false;
        if (UI_NOISE.includes(line)) return false;
        return true;
      }).join("\n")
    );
  }

  function cleanSubject(value) {
    return normalizeWhitespace(value)
      .replace(/^(?:전체\s*메일|받은\s*메일함|보낸\s*메일함)\s*:\s*/u, "")
      .replace(/\s*:\s*(?:KAIST\s*:\s*)?Dooray!?\s*$/iu, "")
      .replace(/\s*[-|]\s*(Dooray!?|두레이).*$/iu, "")
      .replace(/^제목\s*:\s*/u, "")
      .replace(/\[(?:\d{1,3}\.){2,3}\d{1,3}[^\]]*\]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function cleanSender(value) {
    return normalizeWhitespace(value)
      .replace(/^(보낸\s*사람|발신자|From)\s*:\s*/iu, "")
      .replace(/\s*\d{2,4}[./-]\d{1,2}[./-]\d{1,2}.*$/u, "")
      .replace(/\s*\d{1,2}[./-]\d{1,2}\s+\d{1,2}:\d{2}.*$/u, "")
      .replace(/\[[^\]]*(?:Korea|Republic|\d{1,3}\.)[^\]]*\]/giu, "")
      .trim();
  }

  function isPlausibleSubject(value) {
    const text = cleanSubject(value);
    if (text.length < 2 || text.length > 300) return false;
    if (/^(Dooray|메일|받은 메일함|보낸 메일함|전체 답장)$/iu.test(text)) return false;
    return !/^(https?:\/\/|\d{1,3}(?:\.\d{1,3}){3})/u.test(text);
  }

  function isPlausibleBody(value) {
    const text = removeUiNoise(value);
    if (text.length < 20) return false;
    const lineCount = text.split("\n").length;
    return lineCount > 1 || text.length > 80;
  }

  function extractSubjectFromPane(value, senderHint = "") {
    const lines = normalizeWhitespace(value)
      .split("\n")
      .map((line) => cleanSubject(line))
      .filter(Boolean);
    if (!lines.length) return "";
    const senderName = cleanSender(senderHint).toLocaleLowerCase();

    const senderIndex = lines.findIndex((line) =>
      /\b\d{1,2}[./-]\d{1,2}\s+\d{1,2}:\d{2}\b/u.test(line) ||
      /^(보낸\s*사람|발신자|받는\s*사람|From)\s*:/iu.test(line)
    );
    const headingArea = lines.slice(0, senderIndex > 0 ? senderIndex : Math.min(lines.length, 18));
    const candidates = headingArea.filter((line) => {
      if (!isPlausibleSubject(line)) return false;
      if (senderName && cleanSender(line).toLocaleLowerCase() === senderName) return false;
      if (/^(전체\s*답장|답장|삭제|보관|이동|서비스\s*등록|첨부\s*파일|인쇄|더보기)(\s|$)/u.test(line)) return false;
      if (/^(전체\s*메일|받은\s*메일함|보낸\s*메일함|메일\s*검색)$/u.test(line)) return false;
      return true;
    });

    return cleanSubject(candidates[candidates.length - 1] || "");
  }

  function limitText(value, maxLength = 40000) {
    const text = normalizeWhitespace(value);
    if (text.length <= maxLength) return text;
    const head = Math.floor(maxLength * 0.7);
    const tail = maxLength - head;
    return `${text.slice(0, head)}\n\n[중간의 긴 내용은 생략됨]\n\n${text.slice(-tail)}`;
  }

  function makeFingerprint(mail) {
    const seed = [mail?.subject, mail?.sender, mail?.body?.slice(0, 1500)]
      .map(normalizeWhitespace)
      .join("|");
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  const api = {
    normalizeWhitespace,
    removeUiNoise,
    cleanSubject,
    cleanSender,
    isPlausibleSubject,
    isPlausibleBody,
    extractSubjectFromPane,
    limitText,
    makeFingerprint
  };

  globalScope.DoorayMailParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
