# AI 서비스 연결

설정 → AI 및 대화에서 Gemini, OpenRouter, Venice를 선택하고 해당 서비스에서 발급한 본인의 API 키를 저장합니다. AI 모델을 누르면 현재 제공 중인 텍스트 모델 목록을 불러옵니다.

- Gemini의 기존 모델 선택·자동 대체 동작을 유지합니다. 기존에 저장한 Gemini 키도 그대로 읽습니다.
- OpenRouter 자동 선택은 `openrouter/free`를 사용합니다. 목록의 무료 표시는 API의 입력·출력 토큰 가격이 모두 0인 모델에 붙이며 무료 모델을 먼저 표시합니다. 특정 모델을 고르면 그 모델만 호출합니다. 무료 라우터가 실패해도 앱이 유료 모델로 대체하지 않습니다.
- Venice는 모델을 직접 선택해야 합니다. 웹 무료 대화와 API 과금은 별개입니다. API 잔액, 이용 권한, 요금은 서비스에서 확인합니다.
- API 키는 서비스별로 구분합니다. 기존 키 저장소 안에 버전이 있는 JSON 형태로 보관하며, `API 키 기억하기`는 모든 서비스에 적용됩니다. 끄면 모든 서비스 키의 영구 저장을 해제하고 실행 중 메모리에서만 유지합니다. 일반 설정에는 키를 넣지 않습니다.
- OpenRouter와 Venice는 웹·데스크톱·모바일에서 서비스 API로 직접 요청합니다. 모델 목록과 생성 요청의 인증 헤더에는 선택한 서비스의 키만 사용합니다. 대화, 언어 지시문, 스토리 형식 검사 및 복구는 기존 생성 흐름을 공유합니다.
- 공급자 선택과 모델 ID는 기존 모델 설정에 `openrouter:<model-id>` 또는 `venice:<model-id>`로 저장합니다. 서비스 전환 시 자동 선택 상태로 시작하므로 Venice에서는 모델을 다시 선택합니다. 진행 중인 스토리 생성은 시작할 때의 서비스·모델·키를 유지합니다.

공식 문서: [OpenRouter API](https://openrouter.ai/docs/quickstart), [무료 모델 한도](https://openrouter.ai/docs/api_reference/limits), [Venice API](https://docs.venice.ai/getting-started/quick-start), [Venice 요금](https://docs.venice.ai/overview/pricing).

검증: `npm run test:ai-providers`, `npm run test:gemini-models`, `npm run test:language`, `npm run test:background-generation`, `npm run test:sensei-mode`. 실제 계정 키를 사용하는 유료 API 호출은 자동 테스트에 포함하지 않습니다.
