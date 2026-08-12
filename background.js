const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const MODEL_FALLBACKS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
const SETTINGS_VERSION = 12;
const PRIVACY_CONSENT_VERSION = 1;
const activeRequests = new Map();

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("사이드 패널 설정 실패:", error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], ({ settings }) => {
    const previous = settings || {};
    const next = {
      apiKey: previous.apiKey || "",
      model: previous.settingsVersion === SETTINGS_VERSION ? previous.model || DEFAULT_MODEL : DEFAULT_MODEL,
      userProfile: previous.userProfile || "",
      signature: previous.signature || "",
      englishSignature: previous.englishSignature || "Best regards\nSunwook Kim",
      tone: previous.tone || "professional",
      fontSize: Number(previous.fontSize) || 15,
      settingsVersion: SETTINGS_VERSION
    };
    chrome.storage.local.set({ settings: next });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "LIST_GEMINI_MODELS") {
    listGeminiModels(message.apiKey)
      .then((models) => sendResponse({ success: true, models }))
      .catch((error) => sendResponse({ success: false, error: normalizeApiError(error) }));
    return true;
  }

  if (message?.action === "CANCEL_GEMINI_GENERATION") {
    const requestId = String(message.requestId || "");
    const controller = activeRequests.get(requestId);
    if (controller) controller.abort();
    sendResponse({ success: Boolean(controller) });
    return false;
  }

  if (message?.action !== "GENERATE_WITH_GEMINI") return false;

  const requestId = String(message.requestId || `request-${Date.now()}`);
  const previousController = activeRequests.get(requestId);
  if (previousController) previousController.abort();
  const controller = new AbortController();
  activeRequests.set(requestId, controller);

  generateWithGemini(message.payload, controller.signal)
    .then((text) => sendResponse({ success: true, text }))
    .catch((error) => {
      // 사용자에게 처리된 API 오류는 Chrome 확장 관리 페이지의 런타임 오류로 쌓지 않습니다.
      console.info("Gemini 요청 처리 실패:", error?.message || error);
      sendResponse({ success: false, error: normalizeApiError(error) });
    })
    .finally(() => {
      if (activeRequests.get(requestId) === controller) activeRequests.delete(requestId);
    });

  return true;
});

async function generateWithGemini(payload = {}, signal) {
  signal?.throwIfAborted();
  const { settings = {}, privacyConsentVersion } = await chrome.storage.local.get(["settings", "privacyConsentVersion"]);
  const apiKey = String(settings.apiKey || "").trim();
  const model = sanitizeModel(settings.model || DEFAULT_MODEL);

  if (privacyConsentVersion !== PRIVACY_CONSENT_VERSION) {
    throw new Error("메일 데이터 처리 동의가 필요합니다.");
  }
  if (!apiKey) {
    throw new Error("Gemini API 키가 없습니다. 설정에서 API 키를 먼저 저장해 주세요.");
  }

  const systemInstruction = String(payload.systemInstruction || "").slice(0, 12000);
  const contents = sanitizeContents(payload.contents);
  if (!contents.length) throw new Error("AI에 보낼 내용이 비어 있습니다.");

  const requestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      responseMimeType: "text/plain"
    }
  };
  const modelsToTry = [...new Set([model, ...MODEL_FALLBACKS])];
  let lastError = null;

  for (const candidateModel of modelsToTry) {
    signal?.throwIfAborted();
    const result = await callGenerateContent(candidateModel, apiKey, requestBody, signal);
    if (result.success) {
      if (candidateModel !== model) {
        await chrome.storage.local.set({
          settings: { ...settings, model: candidateModel, settingsVersion: SETTINGS_VERSION }
        });
      }
      return result.text;
    }

    lastError = new Error(result.error);
    if (!isModelAvailabilityError(result.error)) throw lastError;
  }

  throw lastError || new Error("사용 가능한 Gemini 모델을 찾지 못했습니다.");
}

async function callGenerateContent(model, apiKey, requestBody, signal) {
  const thinkingConfig = { thinkingLevel: "minimal" };
  const response = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        ...requestBody,
        generationConfig: { ...requestBody.generationConfig, thinkingConfig }
      }),
      signal
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      error: data?.error?.message || `HTTP ${response.status}`
    };
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("")
    .trim();
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason;
    return {
      success: false,
      error: reason ? `응답이 비어 있습니다 (${reason}).` : "Gemini 응답이 비어 있습니다."
    };
  }
  return { success: true, text };
}

async function listGeminiModels(apiKeyValue) {
  const apiKey = String(apiKeyValue || "").trim();
  if (!apiKey) throw new Error("Gemini API 키가 없습니다.");

  const response = await fetch(`${GEMINI_ENDPOINT}?pageSize=1000`, {
    headers: { "x-goog-api-key": apiKey }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);

  return [...new Set((data.models || [])
    .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
    .map((model) => String(model.baseModelId || model.name || "").replace(/^models\//u, ""))
    .filter(Boolean))];
}

function isModelAvailabilityError(message) {
  return /no longer available|not available|not found|unsupported model|new users|deprecated|does not exist/i.test(
    String(message || "")
  );
}

function sanitizeModel(model) {
  const value = String(model || "").trim();
  return /^[a-zA-Z0-9._-]+$/.test(value) ? value : DEFAULT_MODEL;
}

function sanitizeContents(contents) {
  if (!Array.isArray(contents)) return [];

  return contents
    .slice(-12)
    .map((item) => {
      const role = item?.role === "model" ? "model" : "user";
      const text = String(item?.parts?.[0]?.text || item?.text || "").slice(0, 50000).trim();
      return text ? { role, parts: [{ text }] } : null;
    })
    .filter(Boolean);
}

function normalizeApiError(error) {
  const message = String(error?.message || error || "알 수 없는 오류");
  if (error?.name === "AbortError" || /aborted|중단/i.test(message)) {
    return "답변 생성을 중단했습니다.";
  }
  if (/API key not valid|API_KEY_INVALID/i.test(message)) {
    return "Gemini API 키가 올바르지 않습니다. 설정에서 다시 확인해 주세요.";
  }
  if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Gemini 사용량 한도에 도달했습니다. 잠시 후 다시 시도하거나 API 할당량을 확인해 주세요.";
  }
  if (/Failed to fetch|network/i.test(message)) {
    return "Gemini 서버에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.";
  }
  return message;
}
