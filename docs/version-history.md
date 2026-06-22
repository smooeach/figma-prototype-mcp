# 버전 히스토리 — figma-prototype-mcp

프로젝트가 각 버전에서 **무엇을 했고 그래서 무엇이 만들어졌는지** 정리한 문서입니다.
(공식 Figma MCP가 화면을 *만들면*, 이 도구는 그 화면들을 *엮습니다* — 노드/스크린 생성은 설계상 범위 밖.)

> 한 줄 요약: **navigate-only 위어링(v0.1.0)** 에서 출발 → 인터랙션 표면 전체 + 트랜지션/트리거 + 변수/조건/모드 + 읽기·코드젠·정적 검증을 갖춘 **24개 도구 + 3채널 배포(npm·GitHub·Figma Community)** 제품으로.

도구 수 추이: v0.1.0 wiring MVP → v0.27.0 **17** → get_prototype_flow **18** → create_variable **19** → generate_interaction_code **20** → export_interactions 계열 정리 → v0.37.0 validate_prototype **22** → v0.39.0 proto_set_variable_mode **23** → proto_media **24**.

---

## Phase 0 — MVP: navigate-only 와이어링 (v0.1.0)

**한 일:** 셀렉션/이름 기반으로 버튼→프레임 Navigate 리액션을 만드는 최소 제품. 플러그인 + 릴레이 서버 + MCP 3-컴포넌트 구조 확립.

**만든 것 / 5개 E2E 시나리오 (실제 Figma 파일에서 통과):**
1. **선택 기반 와이어링** — 선택한 버튼들을 한 프레임으로 연결
2. **이름 기반 와이어링** — 선택 없이 이름으로 순차 연결
3. **검사(Inspection)** — "이 버튼 어디로 연결돼 있어?"
4. **되돌리기(Undo)** — 방금 만든 리액션 제거
5. **에러 경로** — 없는 타깃 → 친절한 에러, 크래시 없음

**한계(v1):** Navigate To만, 기본 transition Instant, 단일 페이지, 전부 localhost.

**핵심 교훈:** `setReactionsAsync`는 INSTANT엔 `transition:null`, DISSOLVE엔 `easing`을 요구 — 유닛 테스트는 통과해도 실 API가 거부. → **"reaction-builder 변경은 live-API로 재검증"** 원칙의 시작.

---

## Phase 1 — 인터랙션 표면 확장 (v0.2.0 ~ v0.5.0)

Navigate 하나뿐이던 액션을 Figma 프로토타입 인터랙션 전반으로 넓힘.

- **v0.2.0** — **Scroll To** (`SCROLL_TO`는 action.type이 아니라 NODE.navigation이라는 첫 live-API 교훈)
- **v0.3.0** — **Open Overlay + Close Overlay**
- **v0.4.0** — **Back / URL / Swap Overlay** (overlay-action 와이어 형태 교정 — 3번째 연속 live-API 표면 차이 패턴)
- **v0.5.0** — **URL `openInNewTab`** (spec 단계 readonly 체크가 처음으로 live 표면 차이를 미리 막은 릴리스)

> 참고: overlay 프레임 속성(위치/배경)은 Figma 타이핑상 readonly + 플러그인 setter 없음 → 한때 기획했다 차단됨. 이후 **브레인스토밍에 readonly 체크 단계** 추가.

---

## Phase 2 — 연결 인프라 하드닝 (v0.6.0 ~ v0.8.0)

- **v0.6.0** — 플러그인 auto-connect + UI 상태 스타일링
- **v0.7.0** — 플러그인 auto-reconnect
- **v0.8.0** — MCP 브리지 auto-reconnect (플러그인 측과 대칭)

---

## Phase 3 — 트리거 & 트랜지션 (v0.9.0 ~ v0.12.0)

모션·트리거 표현력 확보.

- **v0.9.0** — **AFTER_TIMEOUT** 트리거
- **v0.10.0** — 트랜지션 Phase 1
- **v0.11.0** — **스프링 프리셋 + 커스텀 easing**
- **v0.12.0** — **방향성(directional) 트랜지션 + 7개 신규 트리거 타입**

---

## Phase 4 — 스크롤 속성 (v0.13.0 ~ v0.14.0)

- **v0.13.0** — **`set_frame_scroll`** (overflowDirection setter — 리액션이 아닌 첫 "프레임 속성" setter)
- **v0.14.0** — 스크롤 옵션 번들 (`fixedChildren` + `resetScrollPosition`; deprecated `preserveScrollPosition` emit 제거)

---

## Phase 5 — 조건 & 변수 (v0.15.0 ~ v0.17.0)

- **v0.15.0** — **조건부 리액션 MVP** (단일 비교 + IF/ELSE, 변수는 이름으로)
- **v0.16.0** — **`set_variable` + `toggle_variable`** (BOOLEAN desugar-write/match-read)
- **v0.17.0** — **`set_variable` COLOR (hex)** (타입 주도 값 해석; alpha 필수 런타임 발견)

---

## Phase 6 — 통합 서버 (v0.18.0)

**Phase A:** stdio MCP + WS 릴레이를 **단일 24/7 Express 프로세스**로 통합 (SSE + WS). `PluginSession` single-active 모델, 3초 타임아웃 가드. Express 5 body-parser 버그를 live probe가 포착.

---

## Phase 7 — `proto_*` 고수준 인텐트 클러스터 + 히스토리 (v0.19.0 ~ v0.23.1)

저수준 `create_reactions` 위에, **의도 기반 고수준 도구**와 **명명된 모션 프리셋(10종, 전부 SMART_ANIMATE)** 를 얹음.

- **v0.19.0** — `proto_wire` / `proto_overlay` / `proto_scroll` + **10 모션 프리셋** (overlay에 SMART_ANIMATE 금지 → 컴파일 시 DISSOLVE 재작성)
- **v0.20.0 / v0.20.1** — 버전 문자열 정합 + polish (`recordedHandler` + `makeTools`)
- **v0.21.0** — `proto_back` + `proto_url` (고수준 내비게이션 클러스터 완성; proto_url은 모션 필드 없음 `.strict()`)
- **v0.21.1** — proto_scroll 설명 정리 (SCROLL_TO vs 일반 "스크롤 느낌")
- **v0.22.0** — `proto_set_variable` + `proto_toggle_variable`
- **v0.23.0** — `proto_conditional` (고수준 표면 완성)
- **v0.23.1** — SSE single-active (MCP 클라이언트 측도 newest-wins, 플러그인 측과 대칭)

> 이 구간에 **in-memory 히스토리 스택** + `proto_get_last_history` 도입 (FIFO ring cap 10, `proto_*`만 기록).

---

## Phase 8 — 변수 UX + NL 스티어링 (v0.24.0 ~ v0.25.1)

LLM이 변수를 더 잘 다루도록.

- **v0.24.0** — **`list_variables`** + 라이브러리/원격 변수 해석 (라이브러리 변수 자동 import)
- **v0.25.0** — 변수 **이름 충돌 디스앰비규에이션** (`collection` 옵션; 미해소 충돌은 침묵-선택이 아니라 에러)
- **v0.25.1** — overlay "돌아가" back↔close 모호성 → LLM이 사용자에게 질문; proto_scroll KO 큐 ("스크롤 느낌")

---

## Phase 9 — 모션/NL 하드닝 + 변형 + 복합 조건 (v0.26.0 ~ v0.28.0)

- **v0.26.0** — **SMART_ANIMATE auto-degrade → DISSOLVE** (매칭 레이어 없을 때) + 계층 인식(상대경로) 매칭 + 공간 큐 + proto_back affordance 능동 탐색
- **v0.27.0 / v0.27.1** — **`proto_change_to`** (인스턴스→형제 variant 전환, 17번째 도구 — 마지막 인터랙션 표면 갭) + NL 스티어링 polish
- **v0.28.0** — **복합 조건 (AND/OR, 1단계)** — `if`가 ≥2개 비교의 `all`/`any` 허용

---

## Phase 10 — 읽기/이해 도구 (v0.29.0)

- **v0.29.0** — **`get_prototype_flow`** (18번째 도구, 첫 read/understand 도구) — 페이지 전체 인터랙션 그래프. **프레임이 Section 안에 중첩** → `page.findAll`로 열거해야 한다는 live 교훈.

---

## Phase 11 — 배포 채널 구축 (v0.30.0 ~ v0.33.0)

제품을 실제로 설치·사용 가능하게.

- **v0.30.0** — **npm 배포 가능** (bin + tsup 서버 번들 + 플러그인 동봉). 리포 PUBLIC 전환.
- **v0.30.1** — 플러그인 dynamic-page 마이그레이션 (Figma Community 배포 준비)
- **v0.30.2** — 이중언어 연결 안내 에러 메시지 (플러그인은 구조상 필수 — REST로는 리액션을 못 쓰고 headless 경로 없음)
- **v0.30.3** — **`--stdio` 서버 모드** (Claude Desktop이 supergateway 없이 서버 직접 실행)
- **v0.33.0** — **Claude Desktop 확장 (.mcpb / DXT)** — 더블클릭 설치 (`@anthropic-ai/mcpb`, manifest 0.2)

---

## Phase 12 — 개발자 핸드오프 (v0.31.0 ~ v0.32.0)

- **v0.31.0** — **`export_interactions`** (인터랙션 → 정규 JSON, dev 핸드오프; 서버 전용)
- **v0.32.0** — multi-action echo (`action` → `actions[]`, read 도구 출력 형태 BREAKING)

---

## Phase 13 — 변수 생성 + 코드 생성 (v0.34.0)

- **v0.34.0** — **`create_variable`** (19번째 도구, find-or-create reuse-first) + **`generate_interaction_code`** (20번째, 인터랙션 스펙 → 결정적 React 코드젠: routes/store/hooks/README)

---

## Phase 14 — 멀티타깃 코드젠 + 명명 수용 + 스티어링 (v0.35.0 ~ v0.36.0)

- **v0.35.0** — **멀티타깃 코드젠 5종** (React / React Native / SwiftUI / Compose / Flutter) + **`proto_*` 이름 수용** (from/to에 노드 NAME 허용, plugin-side resolve + `fromScreen` 스코핑 — 라운드트립 절감 레버) + **orient-skip 스티어링** + get_canvas_overview Section 수정
- **v0.36.0** — **overlay 코드젠 1급화** (sheet/dialog) + 코드젠 마무리 (scrollTo/openUrl/예약어 가드/`$`-escape) + changeVariant guide stub → **코드젠이 모든 인터랙션 타입 커버**

---

## Phase 15 — 정적 검증 (v0.37.0)

- **v0.37.0** — **`validate_prototype`** (22번째 도구, 서버 전용) — 정적 프로토타입 린트 4규칙: broken-reference / unreachable(BFS) / dead-end / start-frame. `buildInteractionSpec` 재사용한 순수 `analyzeFlow`.

---

## 패치 — proto_scroll 트랜지션 수정 (v0.37.1)

- **v0.37.1** — **`proto_scroll`이 SCROLL_TO에 Figma-유효 트랜지션을 emit**하도록 수정. Figma 런타임은 SCROLL_TO에 `INSTANT`/`SCROLL_ANIMATE`만 허용하는데, proto_scroll 기본 모션 M3_EMPHASIZED(=SMART_ANIMATE)가 거부당함 (v0.19.0부터 잠복). `rewriteForScroll` 추가 (easing/duration 보존). 서버 전용 → Figma 재배포 불필요.
  - overlay/scroll **target-by-name** 라이브 검증 중 발견. conditional-branch SCROLL_TO는 Figma가 SMART_ANIMATE를 수용 → 영향 없음(별도 검증).

---

## Phase 16 — 캔버스 개관 강화 (v0.38.0)

- **v0.38.0** — **`get_canvas_overview` `includeElements`** (opt-in) — 화면별 **와이어 가능한 요소**를 함께 반환 (라운드트립 절감 레버 #3). 플러그인 변경 → Figma Community 재배포. 라이브 프로브 PASS.

---

## Phase 17 — 변수 모드 전환 (v0.39.0)

- **v0.39.0** — **`proto_set_variable_mode`** (23번째 도구) — 인터랙션으로 변수 컬렉션의 **모드 전환** (예: Light → Dark) via `SET_VARIABLE_MODE`. 모드는 이름으로 해석(`collection` 옵션, 모호하면 LLM이 질문); `list_variables`에 `collections[]` 추가. 라이브 프로브 PASS, 701 테스트.
  - Opus 리뷰가 plan-vs-spec 불일치 포착: set_variable_mode를 conditional-branch 액션 union에서 제외(스펙 non-goal), 대신 interaction-spec read 경로에만 매핑.

---

## Phase 18 — 미디어 런타임 제어 (v0.40.0)

- **v0.40.0** — **`proto_media`** (24번째 도구) + 저수준 `media` 액션 — 인터랙션으로 **미디어 재생 제어**
  (`UPDATE_MEDIA_RUNTIME`): PLAY/PAUSE/TOGGLE_PLAY_PAUSE/MUTE/UNMUTE/TOGGLE_MUTE_UNMUTE +
  SKIP_FORWARD/SKIP_BACKWARD(`amountToSkip` 초) + SKIP_TO(`newTimestamp` 초). `target` 생략 시 트리거
  노드 자신의 미디어. 조건부 분기 제외. 읽기 완전 디코딩 + 코드젠 5타깃 가이드 스텁.
  **이로써 buildable한 마지막 인터랙션 표면 갭이 닫힘** (나머지 미구현은 전부 플랫폼 차단).
  라이브 프로브: (사용자 검증 대기).

---

## 가로지르는 패턴 (engineering through-lines)

- **live-API > 유닛 테스트** — Figma 런타임은 자기 타이핑이 required라 선언한 필드도 거부하곤 함(initialVelocity, deprecatedVersion 등). reaction을 emit하는 변경은 항상 실 Figma로 재검증. 공식 `use_figma`는 우리 플러그인 경로를 안 거치므로, `/sse`에 `SSEClientTransport`로 직접 `proto_*`를 구동해 프로브.
- **플랫폼 차단 사례** — overlay 프레임 props readonly(v1.4), conditional else-if 부재(v0.24.0 후보 폐기). → 브레인스토밍에 readonly·UI-capability 체크 단계 추가.
- **스키마 = 스티어링의 단일 출처** — NL 유도는 zod `.describe()` (런타임 표면). 모델 행동 변경은 Claude Desktop에서 검증 (예: orient-skip은 MCP 로그의 `tools/call` 추적으로 확인).
- **3채널 배포** — npm(latest) + GitHub releases + Figma Community 플러그인(id 1647184714488719280). **플러그인(code.ts)이 바뀌면 Figma 재배포 필요**, 서버 전용 변경이면 npm+GitHub만.
