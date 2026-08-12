(function initDoorayMailAssistant() {
  if (window.__doorayMailAssistantLoaded) return;
  window.__doorayMailAssistantLoaded = true;

  const Parser = globalThis.DoorayMailParser;
  if (!Parser) {
    console.error("Dooray Mail Assistant: mail-parser.js를 불러오지 못했습니다.");
    return;
  }

  const PRIVACY_CONSENT_VERSION = 1;
  let privacyConsentAccepted = false;
  let observationStarted = false;
  let observer = null;

  const SELECTORS = {
    subject: [
      "[data-testid*='subject']",
      "[data-role*='subject']",
      "[class*='mail-subject']",
      "[class*='mail_subject']",
      "[class*='subject']",
      ".mail-detail-header h1",
      ".mail-detail-header h2",
      "main h1",
      "main h2"
    ],
    sender: [
      "[data-testid*='sender']",
      "[data-testid*='from']",
      "[class*='sender-info']",
      "[class*='sender']",
      "[class*='from-info']",
      "[class*='mail-from']",
      "[class*='mail_from']"
    ],
    body: [
      "[data-testid*='mail-body']",
      "[data-testid*='message-body']",
      "[class*='mail-body']",
      "[class*='mail_body']",
      "[class*='message-body']",
      "[class*='message_body']",
      "[class*='mail-content']",
      "[class*='mail_content']",
      "[class*='body-content']",
      "article"
    ]
  };

  let lastNotificationKey = "";
  let notifyTimer = null;

  function getAccessibleDocuments() {
    const documents = [{ document, iframe: null }];
    for (const iframe of document.querySelectorAll("iframe")) {
      try {
        const iframeDocument = iframe.contentDocument;
        if (iframeDocument?.body) documents.push({ document: iframeDocument, iframe });
      } catch (_error) {
        // 다른 출처의 iframe은 브라우저 보안 정책상 읽을 수 없습니다.
      }
    }
    return documents;
  }

  function isVisible(element) {
    if (!element || element.nodeType !== 1) return false;
    const view = element.ownerDocument.defaultView || window;
    const style = view.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function descriptor(element) {
    return `${element.tagName || ""} ${element.id || ""} ${element.className || ""} ${
      element.getAttribute?.("data-testid") || ""
    }`.toLowerCase();
  }

  function collectCandidates(doc, selectors) {
    const seen = new Set();
    const candidates = [];
    for (const selector of selectors) {
      let elements = [];
      try {
        elements = doc.querySelectorAll(selector);
      } catch (_error) {
        continue;
      }
      for (const element of elements) {
        if (!seen.has(element) && isVisible(element)) {
          seen.add(element);
          candidates.push(element);
        }
      }
    }
    return candidates.slice(0, 500);
  }

  function horizontalPositionScore(element, iframe) {
    const rect = iframe?.getBoundingClientRect() || element.getBoundingClientRect();
    const viewportWidth = Math.max(window.innerWidth, 1);
    const centerRatio = (rect.left + rect.width / 2) / viewportWidth;
    if (centerRatio >= 0.58) return 32;
    if (centerRatio >= 0.45) return 16;
    if (centerRatio < 0.28) return -28;
    return 0;
  }

  function findRightReadingPane() {
    const viewportWidth = Math.max(window.innerWidth, 1);
    const viewportHeight = Math.max(window.innerHeight, 1);
    const candidates = new Set();
    const xPoints = [0.58, 0.72, 0.86];
    const yPoints = [0.22, 0.42, 0.68];

    for (const xRatio of xPoints) {
      for (const yRatio of yPoints) {
        const stack = document.elementsFromPoint?.(
          Math.floor(viewportWidth * xRatio),
          Math.floor(viewportHeight * yRatio)
        ) || [];
        for (const hit of stack) {
          let element = hit;
          while (element && element !== document.body) {
            candidates.add(element);
            element = element.parentElement;
          }
        }
      }
    }

    for (const element of document.querySelectorAll("main, article, section, [role='main']")) {
      candidates.add(element);
    }

    let best = null;
    for (const element of candidates) {
      if (!isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < viewportWidth * 0.28 || rect.height < viewportHeight * 0.38) continue;
      if (rect.right < viewportWidth * 0.72 || rect.left < viewportWidth * 0.25) continue;

      const rawText = Parser.normalizeWhitespace(element.innerText || element.textContent || "");
      if (rawText.length < 120 || rawText.length > 120000) continue;

      const desc = descriptor(element);
      let score = horizontalPositionScore(element, null);
      if (/\b\d{1,2}[./-]\d{1,2}\s+\d{1,2}:\d{2}\b/u.test(rawText)) score += 35;
      if (/받는\s*사람\s*:/u.test(rawText)) score += 45;
      if (/보낸\s*사람\s*:|발신자\s*:|\bFrom\s*:/iu.test(rawText)) score += 35;
      if (/참조\s*:/u.test(rawText)) score += 18;
      if (/첨부\s*파일/u.test(rawText)) score += 18;
      if (/Original Message|원본 메시지|보낸 날짜/iu.test(rawText)) score += 12;
      if (/navigation|sidebar|mail-list|mail_list|folder|menu/.test(desc)) score -= 90;

      const areaRatio = (rect.width * rect.height) / (viewportWidth * viewportHeight);
      if (areaRatio > 0.75) score -= 45;
      else if (areaRatio > 0.25 && areaRatio < 0.68) score += 15;

      if (!best || score > best.score || (score === best.score && rawText.length < best.text.length)) {
        best = { element, score, text: rawText, source: `우측 패널: ${desc.slice(0, 120)}` };
      }
    }

    return best?.score >= 45 ? best : null;
  }

  function scoreCandidate(element, type, iframe) {
    const text = Parser.normalizeWhitespace(element.innerText || element.textContent || "");
    const desc = descriptor(element);
    let score = 0;
    const rightPaneScore = horizontalPositionScore(element, iframe);

    if (type === "subject") {
      if (!Parser.isPlausibleSubject(text)) return -Infinity;
      if (/subject|title|mail-subject|mail_subject/.test(desc)) score += 60;
      if (/^H[1-3]$/.test(element.tagName)) score += 18;
      if (!text.includes("\n")) score += 20;
      score += rightPaneScore;
      score += Math.max(0, 20 - Math.floor(text.length / 15));
    }

    if (type === "sender") {
      if (!text || text.length > 500) return -Infinity;
      if (/sender|from|writer|author/.test(desc)) score += 65;
      if (/@/.test(text)) score += 12;
      if (/(보낸\s*사람|발신자|from)/i.test(text)) score += 15;
      score += rightPaneScore;
      score += Math.max(0, 15 - Math.floor(text.length / 25));
    }

    if (type === "body") {
      const cleaned = Parser.removeUiNoise(text);
      if (!Parser.isPlausibleBody(cleaned)) return -Infinity;
      if (/mail[-_]?body|message[-_]?body|body[-_]?content/.test(desc)) score += 90;
      else if (/mail[-_]?content|message[-_]?content/.test(desc)) score += 65;
      if (element.tagName === "ARTICLE") score += 25;
      if (iframe) score += 35;
      score += rightPaneScore;
      if (/list|navigation|sidebar|menu|toolbar|editor|compose|reply/.test(desc)) score -= 100;
      score += Math.min(55, Math.floor(cleaned.length / 120));
      if (cleaned.length > 50000) score -= 60;
    }

    return score;
  }

  function findBestCandidate(type) {
    let best = null;
    for (const item of getAccessibleDocuments()) {
      const candidates = collectCandidates(item.document, SELECTORS[type]);
      if (type === "body" && item.iframe && isVisible(item.document.body)) candidates.push(item.document.body);
      for (const element of candidates) {
        const score = scoreCandidate(element, type, item.iframe);
        if (!best || score > best.score) {
          best = { element, score, iframe: item.iframe, source: descriptor(element).slice(0, 160) };
        }
      }
    }
    return best?.score > 0 ? best : null;
  }

  function fallbackBody() {
    const mainCandidates = collectCandidates(document, [
      "[class*='mail-detail']",
      "[class*='mail_view']",
      "[class*='mail-view']",
      "[class*='message-view']",
      "main"
    ]);
    let best = null;
    for (const element of mainCandidates) {
      const text = Parser.removeUiNoise(element.innerText || "");
      if (!Parser.isPlausibleBody(text)) continue;
      const lengthScore = Math.min(60, Math.floor(text.length / 200));
      const oversizePenalty = text.length > 60000 ? 80 : 0;
      const score = horizontalPositionScore(element, null) + lengthScore - oversizePenalty;
      if (!best || score > best.score) best = { text, score, source: descriptor(element) };
    }
    return best;
  }

  function isMailMessageUrl() {
    return /\/mail\/[^/?#]+\/\d+(?:[/?#]|$)/i.test(location.pathname + location.search + location.hash);
  }

  function fallbackSender(bodyText) {
    const match = bodyText.match(
      /(?:보낸\s*사람|발신자|From)\s*:\s*([^\n]{2,160})|^([^\n]{2,80})\s+\d{1,2}[./-]\d{1,2}\s+\d{1,2}:\d{2}/imu
    );
    return Parser.cleanSender(match?.[1] || match?.[2] || "");
  }

  function extractEmailDetails() {
    const rightPane = findRightReadingPane();
    const subjectCandidate = findBestCandidate("subject");
    const senderCandidate = findBestCandidate("sender");
    const bodyCandidate = findBestCandidate("body");
    const fallback = bodyCandidate || rightPane ? null : fallbackBody();

    const subjectCandidateIsRight = subjectCandidate
      ? horizontalPositionScore(subjectCandidate.element, subjectCandidate.iframe) >= 0
      : false;
    const senderCandidateIsRight = senderCandidate
      ? horizontalPositionScore(senderCandidate.element, senderCandidate.iframe) >= 0
      : false;
    const useSpecificBody = bodyCandidate && bodyCandidate.score >= 80;
    const paneText = Parser.removeUiNoise(rightPane?.text || "");

    const body = Parser.limitText(
      Parser.removeUiNoise(
        (useSpecificBody
          ? bodyCandidate.element.innerText || bodyCandidate.element.textContent
          : paneText || bodyCandidate?.element?.innerText || bodyCandidate?.element?.textContent) ||
          fallback?.text || ""
      ),
      40000
    );
    const selectedText = Parser.limitText(
      getAccessibleDocuments()
        .map((item) => item.document.defaultView?.getSelection?.().toString() || "")
        .find((text) => text.trim()) || "",
      12000
    );
    const paneSender = fallbackSender(rightPane?.text || "");
    const sender = Parser.cleanSender(
      (senderCandidateIsRight ? senderCandidate?.element?.innerText : "") ||
      paneSender ||
      senderCandidate?.element?.innerText ||
      fallbackSender(body)
    );
    const senderKey = Parser.cleanSender(sender).toLocaleLowerCase();
    const subjectChoices = [
      { text: Parser.extractSubjectFromPane(rightPane?.text || "", sender), source: rightPane?.source },
      {
        text: subjectCandidateIsRight ? subjectCandidate?.element?.innerText : "",
        source: subjectCandidate?.source
      },
      { text: subjectCandidate?.element?.innerText, source: subjectCandidate?.source },
      { text: document.title, source: "document.title" }
    ];
    const subjectChoice = subjectChoices.find((choice) => {
      const cleaned = Parser.cleanSubject(choice.text || "");
      if (!Parser.isPlausibleSubject(cleaned)) return false;
      return !senderKey || Parser.cleanSender(cleaned).toLocaleLowerCase() !== senderKey;
    });
    const subject = Parser.cleanSubject(subjectChoice?.text || "");
    const hasMail = Parser.isPlausibleBody(body) && (
      Parser.isPlausibleSubject(subject) || Boolean(sender) || isMailMessageUrl()
    );

    const result = {
      subject,
      sender,
      body,
      selectedText,
      hasMail,
      url: location.href,
      diagnostics: {
        subjectSource: subjectChoice?.source || "찾지 못함",
        senderSource: senderCandidate?.source || "본문 패턴",
        bodySource: useSpecificBody
          ? bodyCandidate?.source
          : rightPane?.source || bodyCandidate?.source || fallback?.source || "찾지 못함",
        rightPaneScore: rightPane?.score || 0,
        bodyLength: body.length,
        confidence: hasMail ? (subjectCandidate && bodyCandidate ? "high" : "medium") : "low"
      }
    };
    result.fingerprint = Parser.makeFingerprint(result);
    return result;
  }

  function scheduleNotification(delay = 350) {
    if (!privacyConsentAccepted) return;
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      if (!privacyConsentAccepted) return;
      const mail = extractEmailDetails();
      const notificationKey = `${mail.fingerprint}:${Parser.makeFingerprint({ body: mail.selectedText || "" })}`;
      if (notificationKey === lastNotificationKey) return;
      lastNotificationKey = notificationKey;
      chrome.runtime.sendMessage({ action: "EMAIL_CHANGED", data: mail }).catch(() => {});
    }, delay);
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === "ENABLE_MAIL_ASSISTANT") {
      startMailObservation();
      sendResponse({ success: true });
      return false;
    }
    if (request?.action === "DISABLE_MAIL_ASSISTANT") {
      stopMailObservation();
      sendResponse({ success: true });
      return false;
    }
    if (request?.action === "GET_EMAIL_DATA") {
      if (!privacyConsentAccepted) {
        sendResponse({ success: false, error: "메일 데이터 처리 동의가 필요합니다." });
        return false;
      }
      sendResponse({ success: true, data: extractEmailDetails() });
      return false;
    }
    return false;
  });

  function handleDocumentClick() {
    scheduleNotification(450);
  }

  function handleSelectionChange() {
    scheduleNotification(250);
  }

  function startMailObservation() {
    privacyConsentAccepted = true;
    if (observationStarted) return;
    observationStarted = true;
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("selectionchange", handleSelectionChange, true);
    observer = new MutationObserver(() => scheduleNotification(500));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleNotification(150);
  }

  function stopMailObservation() {
    privacyConsentAccepted = false;
    observationStarted = false;
    clearTimeout(notifyTimer);
    document.removeEventListener("click", handleDocumentClick, true);
    document.removeEventListener("selectionchange", handleSelectionChange, true);
    observer?.disconnect();
    observer = null;
    lastNotificationKey = "";
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.privacyConsentVersion) return;
    if (changes.privacyConsentVersion.newValue === PRIVACY_CONSENT_VERSION) startMailObservation();
    else stopMailObservation();
  });

  chrome.storage.local.get(["privacyConsentVersion"], (stored) => {
    if (stored.privacyConsentVersion === PRIVACY_CONSENT_VERSION) startMailObservation();
  });
})();
