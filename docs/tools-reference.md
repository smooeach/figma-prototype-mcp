# 🧰 도구 레퍼런스 — figma-prototype-mcp

24개 도구를 **한눈에 보는 표 → 그룹별 상세 → 업데이트 내역** 순으로 정리. (v0.40.0 기준)

> 공식 Figma MCP가 **화면을 만들면**, 이 도구는 그 화면들을 **엮습니다(wiring)**.
> 노드/스크린 생성은 설계상 범위 밖.

**배포 경계 = v0.30.0** (npm 배포 + 리포 PUBLIC). 이전 18개 = 핵심 와이어링, 이후 5개 = 핸드오프·코드젠·검증·모드.
배포 표기: 🟦 배포 이전 · 🟩 배포 이후 · ⚠️ = 플러그인 변경(Figma 재배포 필요), 그 외 서버 전용.

---

## 📋 한눈에 보기 (23개)

### 📖 읽기 / 이해 — 5개
| 도구 | 도입 | 한 줄 역할 |
|---|---|---|
| `get_canvas_overview` | 초기 🟦 | 페이지·프레임·선택 노드 훑기 (옵션으로 내부 요소까지) |
| `get_prototype_flow` | v0.29.0 🟦 | 페이지 전체 인터랙션 그래프 한 번에 |
| `find_nodes` | 초기 🟦 | 이름/타입으로 노드(버튼) 찾기 |
| `list_reactions` | v0.1.0 🟦 | 단일 노드의 리액션 목록 |
| `list_variables` | v0.24.0 🟦 | 쓸 수 있는 변수 + 컬렉션/모드 목록 |

### 🔗 엮기 — 고수준 `proto_*` — 12개
| 도구 | 도입 | 한 줄 역할 |
|---|---|---|
| `proto_wire` | v0.19.0 🟦 | 버튼 → 화면 이동 (Navigate) |
| `proto_overlay` | v0.19.0 🟦 | 오버레이 열기/교체/닫기 (모달·시트) |
| `proto_scroll` | v0.19.0 🟦 | 같은 프레임 안 특정 위치로 스크롤 |
| `proto_back` | v0.21.0 🟦 | 뒤로 가기 (히스토리 pop) |
| `proto_url` | v0.21.0 🟦 | 외부 URL 열기 |
| `proto_change_to` | v0.27.0 🟦 | 컴포넌트 variant 전환 (일회성) |
| `proto_set_variable` | v0.22.0 🟦 | 변수에 특정 값 설정 |
| `proto_toggle_variable` | v0.22.0 🟦 | BOOLEAN 변수 토글 (켜고 끄기) |
| `proto_set_variable_mode` | v0.39.0 🟩⚠️ | 변수 컬렉션 모드 전환 (Light↔Dark) |
| `proto_conditional` | v0.23.0 🟦 | 조건 분기 (if/then/else, AND/OR) |
| `proto_media` | v0.40.0 🟩⚠️ | 미디어 재생 제어 (PLAY/PAUSE/SKIP 등) |
| `proto_get_last_history` | v0.20.0 🟦 | 방금 한 proto_* 작업 기록 조회 |

### 🛠 엮기 — 저수준 — 4개
| 도구 | 도입 | 한 줄 역할 |
|---|---|---|
| `create_reactions` | v0.1.0 🟦 | 리액션 저수준 배치 생성 (escape hatch) |
| `clear_reactions` | v0.1.0 🟦 | 노드의 리액션 제거 |
| `set_frame_scroll` | v0.13.0 🟦 | 프레임 스크롤 방향 설정 (속성) |
| `create_variable` | v0.34.0 🟩⚠️ | 변수 find-or-create (재사용 우선) |

### ✅ 검증 / 내보내기 — 3개
| 도구 | 도입 | 한 줄 역할 |
|---|---|---|
| `validate_prototype` | v0.37.0 🟩 | 프로토타입 정적 린트 (4규칙) |
| `export_interactions` | v0.31.0 🟩 | 인터랙션 → 정규 JSON (개발자 핸드오프) |
| `generate_interaction_code` | v0.34.0 🟩 | 인터랙션 → 프레임워크 코드 (5타깃) |

**합계: 읽기 5 + 고수준 12 + 저수준 4 + 검증/내보내기 3 = 24**

> 공통 기본값(고수준 proto_*): `trigger=ON_CLICK`, 모션 있는 도구는 `motion=M3_EMPHASIZED`. 전부 `create_reactions`로 컴파일.
> **이름 직접 수용:** 사용자가 노드/화면 이름을 대면 orient 없이 이름을 바로 넘겨도 됨(중복 시 `fromScreen` 스코핑). 추상 요청·이름 모호 시에만 먼저 orient.

---

## 📖 상세 — 읽기 / 이해

**`get_canvas_overview`** — 페이지 + 최상위 프레임 + 선택 노드.
- `includeElements:true` → 화면별 와이어 가능 요소(버튼/인스턴스, id+name)까지 한 번에. `elementsTruncated:true`면 나머지는 `find_nodes`.

**`get_prototype_flow`** — 페이지 인터랙션 그래프 전체. 프레임(`isStartFrame`) + 모든 인터랙션 `{frameId, sourceNodeId, trigger, actions}`. `pageId?`, `limit`(기본 500).
- 추가 전 **이미 뭐가 엮였나** 확인용(중복 방지). 단일 노드면 `list_reactions`.

**`find_nodes`** — 이름 부분일치 + 선택적 타입 필터.

**`list_reactions`** — 단일 노드의 기존 리액션 목록.

**`list_variables`** — `local` + `library`(자동 import). 컬렉션 모드는 `collections`. set/toggle/conditional **전에** 호출(이름 추측 금지).

---

## 🔗 상세 — 고수준 `proto_*`

**`proto_wire`** — 화면 전체 전환(Navigate). `from`/`to` 노드 ID.
- SMART_ANIMATE는 이름 공유 레이어만 morph; 없으면 `degradeTo`(기본 DISSOLVE). 공간감은 방향성(PUSH/MOVE_IN/MOVE_OUT).
- 위에 뜨는 모달/팝업/시트는 → `proto_overlay`.

**`proto_overlay`** — `mode = open | swap | close`. open/swap은 `overlay` frameId 필요.
- 오버레이 위 '돌아가/뒤로'는 close vs `proto_back` 모호 → **질문**.
- ⚠️ Figma가 overlay에 SMART_ANIMATE 거부 → DISSOLVE로 자동 재작성(duration/easing 보존).

**`proto_scroll`** — 같은 스크롤 프레임 내부 타깃 노드로 점프(SCROLL_TO). 타깃 프레임에 overflowDirection 필요.
- 페이지 간 '스크롤 느낌'은 → `proto_wire` 방향성 트랜지션.

**`proto_back`** — Back(히스토리 pop, 목적지 없음). 특정 이전 프레임이면 `proto_wire`.
- 추상 요청이면 back affordance(좌상단 아이콘/이름 back·arrow·chevron/'<')를 ON_CLICK으로. 제스처 명시 시만 ON_DRAG. 없으면 **질문**.

**`proto_url`** — 입력 `{ urls: [{ from, url, openInNewTab? }] }`. `motion` 없음(INSTANT).

**`proto_change_to`** — 인스턴스 → 형제 variant **일회성** 전환. `from`=인스턴스 ID, `to`=목표 variant ID(현재 variant 아님).
- 화면 전환→wire · 데이터값→set_variable · 반복 on/off→toggle_variable.

**`proto_set_variable`** — `{ sets: [{ from, variable, value }] }`. value 타입 일치(COLOR는 hex). `motion` 없음.

**`proto_toggle_variable`** — `{ toggles: [{ from, variable }] }`. resolvedType **반드시 BOOLEAN**. 반복 on/off용.

**`proto_set_variable_mode`** — `mode`=모드 이름(예 "Dark"); `collection`=같은 이름 모드 여럿일 때만. 먼저 `list_variables`. **로컬 컬렉션만.**

**`proto_conditional`** — `{ conditions: [{ from, if, then, else? }] }`.
- `if` = 단일 `{variable, operator?, value}` 또는 1단계 `{all:[…]}`(AND, ≥2) / `{any:[…]}`(OR, ≥2). 혼용·중첩 불가.
- `operator` 기본 `==`. 분기 sugar: navigate/scroll/overlay/swap/close/back/url/set. 다중 액션은 `create_reactions`.

**`proto_media`** — `{ medias: [{ from, action, target, amountToSkip?, newTimestamp? }] }`.
- `action`: PLAY / PAUSE / TOGGLE_PLAY_PAUSE / MUTE / UNMUTE / TOGGLE_MUTE_UNMUTE / SKIP_FORWARD / SKIP_BACKWARD / SKIP_TO.
- `target`(NAME 또는 ID) **필수** — 다른 유효한 미디어 노드(영상/GIF fill). Figma가 null/self destination을 거부하므로 컨트롤러와 미디어 노드는 서로 달라야 함(live-verified).
- `amountToSkip`(초): SKIP_FORWARD / SKIP_BACKWARD 전용. `newTimestamp`(초): SKIP_TO 전용.
- 조건부 분기(`proto_conditional`) 안에는 사용 불가. `motion` 없음(INSTANT).
- ⚠️ 플러그인 변경 → Figma Community 재배포 필요.

**`proto_get_last_history`** — 최근 proto_* 호출 배열(newest-last). "방금 만든 거" → ID·모션 복구 후 `replaceExisting=true`로 수정.

---

## 🛠 상세 — 저수준

**`create_reactions`** — 리액션 배치 저수준 생성. action: navigate(`targetFrameId`) / scroll(`targetNodeId`) / media(`mediaAction`, `target?`, `amountToSkip?`, `newTimestamp?`). 각 독립 성공/실패. **escape hatch.**

**`clear_reactions`** — 리액션 제거. `indices` 주면 nodeId 하나만.

**`set_frame_scroll`** — `{ frameId, direction }` 배치. direction: NONE/HORIZONTAL/VERTICAL/BOTH. *(per-layer sticky는 Figma 미지원)*

**`create_variable`** — find-or-create(같은 이름 재사용 `reused:true`). `type` 필수, 신규는 `forProto` 컬렉션. 먼저 `list_variables`.

---

## ✅ 상세 — 검증 / 내보내기 (전부 서버 전용, create_variable 제외)

**`validate_prototype`** — 정적 린트 4규칙: `broken-reference`(E) / `unreachable`(E, 시작 프레임 없으면 skip) / `dead-end`(W) / `start-frame`(W). 반환 `{ ok, issues[], summary }`, `ok=(errors===0)`.

**`export_interactions`** — `{ screens: 프레임ID[], pageId? }` → 정규 JSON. action 타입 navigate/scrollTo/openOverlay/…/conditional. READ/핸드오프(코드 생성 안 함).

**`generate_interaction_code`** — `{ screens, target, pageId? }`. target: react / react-native / swiftui / compose / flutter. **인터랙션 레이어만** 생성(routes/store/훅/트랜지션/README), 화면 UI 아님.

---

## 🔄 업데이트 내역 (도입 이후 변경된 도구만)

| 도구 | 변경 이력 |
|---|---|
| `proto_wire` | v0.19.0 도입 → **v0.26.0** auto-degrade→DISSOLVE + 계층 매칭 + `degradeTo` → **v0.35.0** 이름 수용(name + fromScreen) |
| `proto_overlay` | v0.19.0 도입 → **v0.25.1** '돌아가' close↔back 모호성 질문 → **v0.35.0** 이름 수용 |
| `proto_scroll` | v0.19.0 도입 → **v0.21.1** 설명 정리 → **v0.25.1** KO 큐 → **v0.37.1** 🐛 SCROLL_TO 트랜지션 버그픽스(`rewriteForScroll`) |
| `proto_conditional` | v0.23.0 단일 비교 → **v0.28.0** 복합 조건(all/any, 1단계) |
| `proto_change_to` | v0.27.0 도입 → **v0.27.1** NL 스티어링 polish |
| `proto_set_variable` / `toggle` | v0.22.0 도입 → **v0.25.0** 이름 충돌 디스앰비규에이션(`collection`) |
| `list_variables` | v0.24.0 도입 → **v0.25.0** 충돌 해소 → **v0.39.0** 컬렉션 모드(`collections[]`) |
| `get_canvas_overview` | (초기) → **v0.35.0** 🐛 Section 중첩 프레임 포함 → **v0.38.0** `includeElements` ⚠️ |
| `export_interactions` | v0.31.0 도입 → **v0.32.0** `action`→`actions[]` (출력 형태 BREAKING) |
| `generate_interaction_code` | v0.34.0 React → **v0.35.0** 5타깃 → **v0.36.0** overlay 1급화 + 전체 타입 커버 |
| `proto_media` | v0.40.0 도입 ⚠️ |
| `create_reactions` | v0.1.0 Navigate → 액션 타입이 계속 누적된 곳: scroll(v0.2) · overlay(v0.3~5) · 트리거/트랜지션(v0.9~12) · 조건·변수(v0.15~17) · change_to(v0.27) · 복합조건(v0.28) · set_variable_mode(v0.39) · **media(v0.40)** |

> **진화 패턴:** 핵심 `proto_*` = NL 스티어링 + 이름 수용 + 모션 강등 / 조건·변수 = 충돌 해소 + 모드 / 코드젠·내보내기 = 타깃·커버리지 확장.
> 전체 버전 연대기는 [version-history.md](version-history.md) 참조.
