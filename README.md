# KAIST Dooray Mail Assistant for Chrome

> Made by Sunwook Kim

Dooray 메일을 열어 둔 상태에서 Chrome 사이드 패널로 답장 초안, 요약, 후속 질문을 처리하는 Gemini 기반 KAIST Dooray용 메일 답변 도우미입니다.

Sunwook Kim이 개발한 비공식 도구이며 KAIST, Dooray 또는 Google의 공식 제품이 아닙니다.

문의 및 지원: [kswwdd44@gmail.com](mailto:kswwdd44@gmail.com)

## 브라우저별 배포 파일

GitHub Release에는 같은 기능을 제공하는 두 설치 파일이 올라갑니다.

- `KAIST-Dooray-Mail-Assistant-Chrome-v3.17.3.zip`: Google Chrome 전용
- `KAIST-Dooray-Mail-Assistant-Edge-v3.17.3.zip`: Microsoft Edge 전용

두 버전을 동시에 같은 브라우저에 설치하지 마세요. 사용하는 브라우저에 맞는 ZIP 하나만 압축 해제해 불러옵니다.

## 지금 되는 것

- 현재 열린 메일의 제목, 보낸 사람, 본문, 이전 대화 자동 인식
- 미리보기에서 첨부 이미지가 AI 인식 대상이 아님을 명확히 안내
- 브라우저 탭 이름에서 `전체 메일`, `KAIST`, `Dooray!`를 제거해 실제 메일 제목만 표시
- **선택한 메일 가져오기** 버튼을 눌렀을 때만 작업 메일 교체
- 다른 메일을 클릭해도 가져온 메일과 AI 대화는 그대로 유지
- 드래그한 문장을 별도 관심 영역으로 AI에 전달
- 사용자가 버튼을 눌렀을 때만 답장 초안 생성
- 메일 가져오기·변경·다시 읽기에서는 Gemini API를 호출하지 않는 완전 수동 방식
- 답변 생성 중 전송 버튼으로 요청 즉시 중단
- 답장 초안, 핵심 요약, 수락, 정중한 거절 빠른 작업
- 같은 메일을 문맥으로 유지한 연속 질문과 수정 요청
- 결과를 한 번에 복사
- 사용자 프로필, 기본 서명, 말투, Gemini 모델 설정
- API 키로 사용 가능한 안정 모델을 가벼운 순서로 선택
- 최초 동의 전에는 Dooray 메일 내용을 읽지 않는 개인정보 보호 잠금
- API 키를 URL에 노출하지 않고 요청 헤더로 안전하게 전송
- 설정에서 API 키·사용자 정보·동의 기록을 한 번에 삭제
- 연속 질문에는 최근 6개 메시지만 전달해 입력 토큰 절약
- 이메일 안의 프롬프트 인젝션 문구를 따르지 않도록 분리된 시스템 지침

## 설치

승인된 사용자를 위한 GitHub Release 설치 방법은 [INSTALL.md](INSTALL.md)를 참고하세요.

1. Chrome 주소창에 `chrome://extensions`를 입력합니다.
2. 오른쪽 위의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. 이 폴더를 선택합니다.

   `C:\Users\User\.gemini\antigravity\scratch\dooray-mail-assistant-chrome`

5. 확장 프로그램을 다시 로드했다면 이미 열려 있던 Dooray 탭도 한 번 새로고침합니다.
6. 툴바의 확장 프로그램 아이콘을 누르면 Chrome 사이드 패널이 열립니다.

## 처음 설정

1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 Gemini API 키를 발급합니다.
2. 사이드 패널의 설정에서 키를 붙여 넣고 저장합니다.
3. 필요하면 사용자 정보와 기본 서명을 입력합니다.
4. 메일 가져오기와 다시 읽기는 Gemini API를 호출하지 않습니다. 빠른 작업이나 전송 버튼을 직접 눌렀을 때만 호출됩니다.

기본 모델은 저비용 안정 모델인 `gemini-3.1-flash-lite`입니다. 설정을 열면 현재 API 프로젝트에서 `generateContent`를 지원하는 경량 안정 모델만 확인할 수 있습니다.

## 사용 흐름

1. Dooray 받은 메일함에서 메일을 엽니다.
2. 사이드 패널에서 **선택한 메일 가져오기**를 누릅니다.
3. 고정된 제목과 보낸 사람을 확인하고 **답장 초안**을 누릅니다.
4. “조금 더 짧게”, “화요일 오후를 제안해줘”처럼 이어서 수정합니다.
5. **복사**를 누른 뒤 Dooray 답장창에 붙여 넣습니다.
6. 보내기 전에 수신자, 날짜, 약속, 서명을 반드시 검토합니다.

## 개인정보와 API 키

- Gemini 기능을 실행할 때 현재 메일의 제목, 보낸 사람, 본문과 선택 영역이 Google Gemini API로 전송됩니다.
- 최초 데이터 처리 동의 전에는 메일 내용을 읽지 않으며, 동의 후에도 사용자가 AI 버튼을 누른 경우에만 외부로 전송합니다.
- Google의 공식 약관에 따르면 무료 Gemini API 등급의 입력·출력 데이터는 Google 제품 개선에 사용되며 사람 검토자가 읽고 처리할 수 있습니다. 민감한 메일에는 무료 등급을 사용하지 마세요.
- API 키는 `chrome.storage.local`에 저장되며 웹페이지 코드에는 노출되지 않습니다.
- API 키는 요청 URL이 아닌 `x-goog-api-key` 헤더로 Google에 전송됩니다.
- 소스 코드에는 API 키가 들어 있지 않습니다. 폴더를 공유할 때도 키가 함께 복사되지 않습니다.
- 조직의 보안 정책상 외부 AI로 업무 메일 전송이 허용되는지 먼저 확인하세요.
- 전체 내용은 [개인정보처리방침](privacy-policy.html)에서 확인할 수 있습니다.

## 개발 및 점검

Node.js가 설치되어 있으면 다음 명령으로 구문 및 파서 테스트를 실행할 수 있습니다.

```powershell
npm run check
npm test
```

메일 인식 결과가 이상하면 사이드 패널의 **AI가 읽을 내용 미리보기**를 먼저 확인하세요. Dooray의 DOM 구조가 계정이나 업데이트에 따라 달라질 수 있으므로, 실제 화면에서 인식이 빗나가는 샘플을 확보하면 `content.js`의 선택자와 점수 규칙을 조정할 수 있습니다.

## 구조

- `manifest.json`: Manifest V3 권한 및 로딩 설정
- `icons/`: Chrome 툴바와 확장 관리 화면용 아이콘 세트
- `content.js`: Dooray DOM 인식
- `mail-parser.js`: 텍스트 정리와 fingerprint 생성
- `background.js`: Gemini API 호출 (API 키를 웹페이지와 분리)
- `sidepanel.html`, `sidepanel.js`, `styles.css`: 사이드 패널 UI와 대화 상태
- `test_dooray_parser.js`: 의존성 없는 파서 단위 테스트
