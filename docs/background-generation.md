# Android 백그라운드 생성

Android 설치 앱은 Gemini 인사·채팅·스토리 요청을 시작하기 전에 `dataSync` 포그라운드 서비스를 시작한다. 스토리는 모델 목록 조회, 등장 인물 선정, 모델 폴백, 대본 작성이 끝날 때까지 하나의 작업으로 유지한다. 기존 직접 호출과 Express 경로에 모두 적용한다.

서비스는 생성 중 알림과 시간 제한이 있는 부분 웨이크 락을 사용한다. 요청마다 발급한 토큰을 완료·실패 시 반환하며, 다른 방에서 진행 중인 요청이 있으면 서비스를 유지한다. 마지막 요청이 끝나면 알림과 웨이크 락을 해제한다. API 키·프롬프트·응답은 서비스나 알림에 전달하거나 기록하지 않는다. 네트워크 오류를 숨기거나 과금 가능성이 있는 생성 요청을 자동 재전송하지 않는다.

서비스로 백그라운드 실행을 유지하는 시간은 최대 15분이며 Android의 서비스 시간 초과에도 서비스를 종료한다. 프로세스 강제 종료 뒤에 서비스만 재시작하지 않는다. 앱 강제 종료, 실제 인터넷 단절, 제조사의 강한 절전 정책까지 복구하는 기능은 아니다. Android 13 이상에서 알림 권한이 없으면 알림창 대신 시스템의 실행 중 앱 목록에 작업이 표시될 수 있다.

일반적인 사용 흐름은 앱 화면에서 생성을 시작한 후 홈 화면·다른 앱으로 이동하거나 화면을 끄고, 앱으로 돌아와 응답을 확인하는 것이다. Android 12 이상은 백그라운드에서 새로운 포그라운드 서비스를 시작하는 것을 제한하므로 첫 요청은 앱 화면에서 시작해야 한다.

웹·iOS·네이티브 모듈이 없는 Expo Go는 기존 호출 방식을 유지한다. 이 변경을 사용하려면 Android APK를 새로 빌드해 설치해야 한다.

## 검증

- `npm run test:background-generation`: 병렬 방의 작업 유지, 성공·실패 정리, 서비스 시작 실패 시 API 미호출, 스토리 전체 단계 유지, 플랫폼 폴백.
- `npm run test:chat-input`, `npm run test:sensei-mode`: 기존 채팅 요청·리셋 순서 회귀 검사.
- Android: `gradlew :app:compileDebugKotlin -PreactNativeArchitectures=arm64-v8a`.
- 실기기: Android 13/15 이상에서 채팅·스토리 생성 직후 홈 이동, 앱 전환, 화면 끄기 후 복귀. 병렬 방 요청 중 하나만 완료했을 때 서비스가 계속 유지되는지, 모든 요청이 끝나거나 실패하면 종료되는지 확인한다. 인터넷을 실제로 끊었을 때 정상적으로 실패하고 중복 생성하지 않는지도 확인한다.

참고: [포그라운드 서비스](https://developer.android.com/develop/background-work/services/fgs), [백그라운드 시작 제한](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start), [서비스 시간 초과](https://developer.android.com/develop/background-work/services/fgs/timeout).
