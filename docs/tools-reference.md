# 도구 레퍼런스 — figma-prototype-mcp (배포 전 / 배포 후)

이 문서는 figma-prototype-mcp의 **23개 도구**를 **배포 경계(v0.30.0)** 기준으로 나눠, 입력 파라미터·기본값·주의점까지 정리한 레퍼런스입니다. (v0.39.0 기준)

> 큰 그림: 공식 Figma MCP가 **화면을 만들면**, 이 도구는 그 화면들을 **엮습니다(wiring)**. 노드/스크린 생성은 설계상 범위 밖.

## 배포 경계가 v0.30.0인 이유
- **v0.30.0** = 제품이 처음으로 **실제 설치·배포 가능**해진 릴리스 (npm bin + tsup 서버 번들 + 플러그인 동봉, 리포 PUBLIC 전환).
- v0.30.1~v0.30.3, v0.33.0 = **배포 인프라**(Figma Community 준비 / 연결 안내 / `--stdio` 모드 / DXT) — **새 도구 없음**.
- 따라서 **배포 이전 = v0.29.0까지 만들어진 18개**, **배포 이후 = v0.31.0부터 추가된 5개**.

| 구분 | 도구 수 | 성격 |
|---|---|---|
| **배포 이전** (~v0.29.0) | 18 | 핵심 와이어링 표면 — `proto_*` + 읽기 + 저수준 |
| **배포 이후** (v0.31.0~) | 5 | 성숙 레이어 — 개발자 핸드오프 / 코드젠 / 정적 검증 / 변수 모드 |
| **합계** | **23** | |

---

# 🟦 PART A — 배포 이전 (v0.1.0 ~ v0.29.0) · 18개

제품이 배포되기 전까지 만들어진, **프로토타입을 엮는 핵심 표면**. 고수준 `proto_*`는 의도 기반(LLM이 자연어에서 바로 선택)이며 내부적으로 `create_reactions`로 컴파일됨.

## 📖 읽기 / 이해 (4)

### `find_nodes` · 초기(MVP)
현재 페이지(또는 문서)에서 **이름 부분일치 + 선택적 타입 필터**로 노드 검색. 특정 버튼/노드의 ID를 찾을 때.

### `list_reactions` · v0.1.0
**단일 노드**에 걸린 기존 리액션 목록. "이 버튼 어디로 연결돼 있어?" 한 노드 검사.

### `list_variables` · v0.24.0
set/toggle/conditional에서 이름으로 쓸 수 있는 변수 목록. `local`(이 파일) + `library`(연결 라이브러리, 첫 사용 시 자동 import) 반환.
- `remoteEnumerated:false` = 라이브러리 열거 불가(로컬 목록은 유효). 각 컬렉션의 모드는 `collections` 필드 → `proto_set_variable_mode`에 사용.
- **언제:** set/toggle/conditional **전에** 이름 추측 말고 먼저 호출.

### `get_prototype_flow` · v0.29.0
페이지의 **프로토타입 인터랙션 그래프 전체**를 한 번에. 각 프레임(`isStartFrame` 포함)과 모든 인터랙션 `{ frameId, frameName, sourceNodeId, sourceNodeName, trigger, actions }`.
- `actions`는 `list_reactions`와 동일 디코드. `pageId?`(기본 현재), `limit`(기본 500, 초과 시 `truncated`).
- **언제:** 더 추가하기 전에 **이미 뭐가 엮였나** 확인(중복 방지). 단일 노드면 `list_reactions`.

## 🔗 엮기 — 고수준 `proto_*` (10)

공통 기본값: `trigger=ON_CLICK`. 모션 있는 도구는 `motion=M3_EMPHASIZED`(SMART_ANIMATE 프리셋) 기본. 전부 `create_reactions`로 컴파일.
> **이름 직접 수용:** 사용자가 노드/화면 이름을 대면 orient(get_canvas_overview/find_nodes) 없이 이름을 바로 넘겨도 됨(plugin resolve, 중복 시 `fromScreen` 스코핑). 추상 요청·이름 모호/없을 때만 먼저 orient.

### `proto_wire` · v0.19.0
소스 노드 → 목적 프레임 **Navigate To**(화면 전체 전환). `from`/`to`는 노드 ID.
- `motion`은 프리셋 이름 또는 전체 TransitionInput. SMART_ANIMATE는 두 프레임이 이름으로 공유하는 레이어만 morph; 없으면 `degradeTo`(기본 DISSOLVE)로 자동 강등. 공간감은 방향성(PUSH/MOVE_IN/MOVE_OUT).
- **경계:** 현재 화면 *위에* 뜨는 모달/팝업/시트는 `proto_overlay`(open).

### `proto_overlay` · v0.19.0
오버레이 리액션 배치. `mode = "open" | "swap" | "close"`. open/swap은 `overlay` frameId 필요, close는 없음.
- open = 위에 뜨는 모달/팝업/토스트/바텀시트; close = 닫고 아래 화면 노출.
- **모호성:** 오버레이 위 '돌아가/뒤로'는 close vs `proto_back` → **질문**.
- **제약:** Figma가 overlay/swap/close에 SMART_ANIMATE 거부 → 해당 모션은 duration+easing 보존하며 **DISSOLVE로 자동 재작성**.

### `proto_scroll` · v0.19.0
소스 → SCROLL_TO: 클릭 시 **같은 스크롤 프레임 내부의 타깃 노드**로 뷰 점프(타깃 프레임에 overflowDirection 필요 → `set_frame_scroll`).
- **아님:** 페이지 간 '스크롤 느낌' 전환은 `proto_wire`의 방향성 트랜지션.

### `proto_get_last_history` · v0.20.0
최근 성공한 `proto_*` 호출들을 HistoryEntry 배열로 반환(newest-last). "방금 만든 거" 참조 시 ID·모션 복구 → `replaceExisting=true`로 재호출해 수정. (FIFO ring cap 10, `proto_*`만 기록)

### `proto_back` · v0.21.0
소스 → **Back 내비게이션**(히스토리 stack pop, 목적지 없음). 특정 이전 프레임이면 `proto_wire`.
- **소스 선택:** 추상 요청이면 먼저 각 프레임의 back affordance(좌상단 아이콘, 이름 back/arrow/chevron/prev, '<'/'‹')를 ON_CLICK으로 와이어. 제스처 명시 시만 ON_DRAG. affordance 없으면 노드 만들지 말고 **질문**.
- **⚠️ 오버레이 위:** '돌아가/뒤로'가 overlay close vs Back 모호 → 질문.

### `proto_url` · v0.21.0
소스 → **Open URL**. 입력 `{ urls: [{ from, url, openInNewTab? }] }`. 기본 `openInNewTab=false`. **`motion` 없음**(종료 이벤트, INSTANT).

### `proto_set_variable` · v0.22.0
소스 → **Set Variable**: 변수에 리터럴 값 할당(이름 resolve, 로컬/라이브러리 자동 import). 입력 `{ sets: [{ from, variable, value }] }`.
- `value`는 boolean/number/string(타입 일치); COLOR는 hex(`"#RRGGBB"`/`"#RRGGBBAA"`).
- **경계:** 값 지정 없이 BOOLEAN 뒤집기는 `proto_toggle_variable`. 이건 **특정 값**. `motion` 없음.

### `proto_toggle_variable` · v0.22.0
소스 → **Toggle Variable**: BOOLEAN 변수 뒤집기. 입력 `{ toggles: [{ from, variable }] }`. resolvedType 반드시 BOOLEAN.
- **매 탭마다 도로 뒤집히는 on/off**에 적합. 특정 값은 `proto_set_variable`; variant 시각 컴포넌트 일방향 전환은 `proto_change_to`.
- `motion` 없음. 내부적으로 CONDITIONAL+SET_VARIABLE 2개로 desugar(단, list_reactions는 toggle 형태로 round-trip).

### `proto_conditional` · v0.23.0
소스에 **조건부 리액션(if/then/else)**, 변수 비교 기반. 입력 `{ conditions: [{ from, if, then, else? }] }`.
- `if` = 단일 비교 `{ variable, operator?, value }` 또는 1단계 복합 `{ all:[…] }`(AND, ≥2) / `{ any:[…] }`(OR, ≥2). 혼용·중첩 불가(Figma else-if 없음).
- `operator` 생략 시 `"=="`. 그 외 `!=,<,<=,>,>=`. `then`/`else`는 각각 한 분기 액션(sugar: navigate/scroll/overlay/swap/close/back/url/set). 다중 액션은 `create_reactions`.
- overlay/swap 분기는 SMART_ANIMATE→DISSOLVE 재작성. COLOR 비교 불가. `trigger`/`motion`은 conditional 레벨 공유.
> *복합 조건(all/any)은 v0.28.0에서 추가됨 — 단일 비교 MVP는 v0.23.0.*

### `proto_change_to` · v0.27.0
컴포넌트 **인스턴스 → 형제 variant 전환**(Figma 'Change to'). 일회성 전환(→on)이지 토글 아님.
- `from` = 인스턴스 노드 ID; `to` = 목표 variant 노드 ID(같은 set 내 COMPONENT, 현재 variant 아님). 둘 다 ID.
- **경계:** 화면 전환→`proto_wire`; 데이터 값→`proto_set_variable`; 매 탭 도로 꺼지는 on/off→`proto_toggle_variable`.
- **KO 큐:** '선택 상태로', 'highlight 상태로 바꿔', '~상태로 바꿔'.

## 🛠 엮기 — 저수준 기본기 (4)

### `create_reactions` · v0.1.0
프로토타입 리액션 **배치 저수준 생성**. action은 Navigate To(`navigate`, `targetFrameId`) 또는 Scroll To(`scroll`, `targetNodeId`). 각 연결 독립 성공/실패. **escape hatch** — 흔한 경우는 proto_*가 커버.

### `clear_reactions` · v0.1.0
하나 이상 노드에서 리액션 제거. `indices`를 주면 nodeId는 **정확히 하나**만 허용.

### `set_frame_scroll` · v0.13.0
프레임 **스크롤 동작(overflowDirection) 설정**(인터랙션 아닌 프레임 속성). `{ frameId, direction }` 배치. direction: `NONE`/`HORIZONTAL`/`VERTICAL`/`BOTH`.
- *per-layer sticky(scrollBehavior)는 Figma 플랫폼 미지원.*

### `create_variable` · ⚠️ 실제로는 배포 이후(v0.34.0)
> 분류상 "변수 저수준"이지만 도입 시점은 **배포 이후**. → PART B 참조.

---

# 🟩 PART B — 배포 이후 (v0.31.0 ~ v0.39.0) · 5개

3채널 배포 체계(npm·GitHub·Figma Community)가 선 뒤 추가된 **성숙 레이어**. 대부분 **서버 전용**(플러그인 변경 없음 → Figma 재배포 불필요)이며, 예외는 명시.

### `export_interactions` · v0.31.0 · 서버 전용
완성 화면들의 인터랙션을 **정규·프레임워크 무관 JSON 스펙**으로 내보내기(개발자 핸드오프).
- 입력 `{ screens: string[] (프레임 노드 ID), pageId? }`.
- 반환 `{ schemaVersion, page, screens:[{id,name,interactions:[{source,trigger,actions}]}], requestedScreens, missingScreens, unsupported, truncated }`. action 타입: navigate/scrollTo/openOverlay/swapOverlay/closeOverlay/back/openUrl/setVariable/toggleVariable/changeVariant/conditional.
- **READ/핸드오프 도구** — 프레임워크/UI 코드 생성 안 함.
- *v0.32.0에서 `action`→`actions[]` 다중 액션 echo로 출력 형태 BREAKING.*

### `create_variable` · v0.34.0 · ⚠️ 플러그인 변경
**find-or-create** Figma 변수. 같은 이름 있으면 **재사용**(`reused:true`, 중복 생성 안 함).
- 신규는 기본 `forProto` 컬렉션(`collection`으로 override). `type`(BOOLEAN/FLOAT/STRING/COLOR) 필수; `value` 선택(COLOR는 hex).
- 먼저 `list_variables`로 기존 변수 선호. 생성 후 이름으로 set/toggle/conditional에서 참조.
- *plugin code 변경 → Figma Community 재배포 필요.*

### `generate_interaction_code` · v0.34.0 · 서버 전용
화면들의 인터랙션에서 **프레임워크 코드 생성**.
- 입력 `{ screens: string[], target: "react" | "react-native" | "swiftui" | "compose" | "flutter", pageId? }`.
- 반환 `{ schemaVersion, target, files: [{ path, content }], unsupported, missingScreens, truncated }`.
- **인터랙션 레이어만**(routes / 변수 store / 화면별 훅 / 트랜지션 / README) — 화면 UI 아님. 결정적, export_interactions와 같은 스펙 기반.
- *v0.35.0에서 5타깃으로 확장, v0.36.0에서 overlay 1급화 + 모든 인터랙션 타입 커버.*

### `validate_prototype` · v0.37.0 · 서버 전용
페이지 흐름 **정적 린트**, 한 번에 문제 반환. 내부적으로 전체 그래프를 읽고 4규칙:
- `broken-reference`(error), `unreachable`(error — 시작 프레임 없으면 skip), `dead-end`(warning), `start-frame`(warning — 0개/여러 개).
- 반환 `{ ok, page, issues:[{severity, rule, frameId, frameName, sourceNodeId?, sourceNodeName?, message}], summary:{errors,warnings,frames,interactions}, truncated }`, `ok = (errors===0)`. `pageId?`.
- **언제:** 와이어 후 연결이 올바른지 점검.

### `proto_set_variable_mode` · v0.39.0 · ⚠️ 플러그인 변경
변수 **컬렉션의 활성 모드 전환**(Light↔Dark 등) — Figma SET_VARIABLE_MODE. (23번째 도구)
- `mode` = 모드 이름(예 `"Dark"`); `collection` = 선택(같은 이름 모드가 여러 컬렉션일 때만). 먼저 `list_variables`로 모드 확인.
- 모션 없음, `trigger=ON_CLICK`. **로컬 컬렉션만.** plugin 변경 → Figma 재배포 필요.

---

## 한눈에 — 도입 시점 타임라인

```
배포 이전 (핵심 와이어링 18개)
  v0.1.0   create_reactions · list_reactions · clear_reactions · find_nodes
  v0.13.0  set_frame_scroll
  v0.19.0  proto_wire · proto_overlay · proto_scroll
  v0.20.0  proto_get_last_history
  v0.21.0  proto_back · proto_url
  v0.22.0  proto_set_variable · proto_toggle_variable
  v0.23.0  proto_conditional        (v0.28.0 복합 all/any)
  v0.24.0  list_variables
  v0.27.0  proto_change_to
  v0.29.0  get_prototype_flow
──────────── v0.30.0 배포 경계 (npm·PUBLIC; 새 도구 없음) ────────────
배포 이후 (성숙 레이어 5개)
  v0.31.0  export_interactions          (서버 전용)
  v0.34.0  create_variable              (⚠️ 플러그인) + generate_interaction_code (서버 전용)
  v0.37.0  validate_prototype           (서버 전용)
  v0.39.0  proto_set_variable_mode      (⚠️ 플러그인)
```

> **읽는 법:** 배포 이전 도구들은 "프로토타입을 어떻게 엮나"(인터랙션 표면), 배포 이후 도구들은 "엮은 걸 어떻게 점검·전달·재사용하나"(핸드오프·코드젠·검증) + 변수 표현력 확장에 해당. 서버 전용 변경은 npm+GitHub만으로 배포되고, 플러그인(code.ts) 변경(create_variable, proto_set_variable_mode)은 Figma Community 재배포까지 필요.
