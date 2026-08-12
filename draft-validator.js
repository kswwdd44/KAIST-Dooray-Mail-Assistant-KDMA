(function initDraftValidator(globalScope) {
  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function collectMatches(text, patterns) {
    const matches = new Set();
    for (const pattern of patterns) {
      for (const match of String(text || "").matchAll(pattern)) {
        const value = match[0]?.trim();
        if (value) matches.add(value);
      }
    }
    return [...matches];
  }

  function validateDraft({ draft = "", source = "" } = {}) {
    const warnings = [];
    const normalizedSource = normalize(source);

    if (/\[\s*확인\s*필요\s*\]|(?:^|\s)(?:OO|○○|XX)(?:\s|$)|\{[^{}]{1,40}\}|_{3,}/iu.test(draft)) {
      warnings.push({
        code: "placeholder",
        text: "[확인 필요] 또는 임시 입력값이 남아 있습니다."
      });
    }

    if (/첨부(?:\s*파일)?(?:해|하였|했|드리|드립니다|합니다|했습)/u.test(draft)) {
      warnings.push({
        code: "attachment",
        text: "초안에서 첨부파일을 언급합니다. 실제 파일이 첨부됐는지 확인하세요."
      });
    }

    const urls = collectMatches(draft, [/https?:\/\/[^\s)>\]}]+/giu])
      .filter((url) => !normalizedSource.includes(normalize(url.replace(/[.,!?]+$/u, ""))));
    if (urls.length) {
      warnings.push({
        code: "url",
        text: "원문이나 사용자 지시에 없는 링크가 포함되어 있습니다."
      });
    }

    const names = new Set();
    const greetingPattern = /(?:^|\n)\s*(?:안녕하세요[,.]?\s*)?([가-힣]{2,4})\s*(?:교수님|선생님|박사님|님)/gmu;
    for (const match of draft.matchAll(greetingPattern)) names.add(match[1]);
    const unverifiedNames = [...names].filter((name) => !normalizedSource.includes(normalize(name)));
    if (unverifiedNames.length) {
      warnings.push({
        code: "name",
        text: `원문에서 확인되지 않는 호칭 이름: ${unverifiedNames.join(", ")}`
      });
    }

    return warnings;
  }

  const api = { validateDraft };
  globalScope.DoorayDraftValidator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
