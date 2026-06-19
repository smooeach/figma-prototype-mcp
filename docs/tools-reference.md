# 도구 레퍼런스 — figma-prototype-mcp

이 문서는 figma-prototype-mcp가 제공하는 **23개 도구**를 그룹별로, 입력 파라미터·기본값·주의점까지 정리한 레퍼런스입니다. (v0.39.0 기준)

> 큰 그림: 공식 Figma MCP가 **화면을 만들면**, 이 도구는 그 화면들을 **엮습니다(wiring)**. 노드/스크린 생성은 설계상 범위 밖.
>
> - **고수준 `proto_*`** = 의도 기반 표면 (LLM이 자연어에서 바로 고르기 쉬움). 내부적으로 `create_reactions`로 컴파일됨.
> - **저수준 기본기** = `proto_*`가 내부적으로 쓰는 원초적 도구. 세밀한 제어가 필요할 때 직접 사용.

도구 분포: **읽기 5 + 고수준 엮기 11 + 저수준 엮기 4 + 검증·내보내기 3 = 23**

---

## 📖 ① 읽기 / 이해 (5)

작업 전 "지금 뭐가 있나"를 파악하는 도구들.

### 1. `get_canvas_overview`
현재 페이지 + 최상위 프레임 + 선택된 노드를 반환.
- **옵션** `includeElements: true` → 화면별 **와이어 가능한 내부 요소**(버튼/인스턴스/명명된 컨테이너, id+name)까지 한 번에 반환. "모든 화면의 back 버튼" 같은 추상 참조를 화면별 `find_nodes` 없이 한 번에 해소 (v0.38, 라운드트립 절감 레버 #3).
- 화면에 `elementsTruncated:true`가 붙으면 cap 초과 → 나머지는 `find_nodes`로.
- **언제:** 요청이 추상적이거나(화면 목록/시작 프레임 필요), 모호한/못 찾은 이름을 복구할 때. 사용자가 화면 이름을 직접 대면 이 단계를 건너뛰고 바로 `proto_*` 와이어 가능.

### 2. `get_prototype_flow`
페이지의 **프로토타입 인터랙션 그래프 전체**를 한 번에. 각 프레임(`isStartFrame` 포함)과 모든 와이어된 인터랙션 `{ frameId, frameName, sourceNodeId, sourceNodeName, trigger, actions }`.
- `actions`는 `list_reactions`와 동일하게 디코드(navigate/scroll/overlay/swap/close/back/url/change_to/set_variable/toggle_variable/conditional 복합 all·any 포함).
- **파라미터:** `pageId?`(기본 현재 페이지), `limit`(기본 500, 초과 시 `truncated`).
- **언제:** 더 추가하기 전에 **이미 뭐가 엮여 있나** 확인(중복 방지). 단일 노드만이면 `list_reactions`.

### 3. `find_nodes`
현재 페이지(또는 문서)에서 **이름 부분일치 + 선택적 타입 필터**로 노드 검색.
- **언제:** 특정 버튼/노드의 ID를 찾을 때.

### 4. `list_reactions`
**단일 노드**에 걸린 기존 리액션 목록.
- **언제:** "이 버튼 어디로 연결돼 있어?" 한 노드 검사.

### 5. `list_variables`
set/toggle/conditional에서 이름으로 쓸 수 있는 변수 목록.
- `local`(이 파일) + `library`(연결된 라이브러리, 첫 사용 시 자동 import) 반환.
- `remoteEnumerated:false` = 라이브러리 열거 불가(로컬 목록은 유효).
- 각 컬렉션의 모드가 `collections` 필드에 → `proto_set_variable_mode`에 사용.
- **언제:** `proto_set_variable` / `proto_toggle_variable` / `proto_conditional` **전에** 이름을 추측하지 말고 먼저 호출.

---

## 🔗 ② 엮기 — 고수준 `proto_*` (11)

의도 기반 표면. 공통 기본값: `trigger=ON_CLICK`. 모션이 있는 도구는 `motion=M3_EMPHASIZED`(SMART_ANIMATE 프리셋)가 기본. 전부 `create_reactions`로 컴파일.

> **이름 직접 수용:** 사용자가 노드/화면 이름을 대면 `get_canvas_overview`/`find_nodes` 없이 이름을 바로 넘겨도 됨(plugin이 resolve, 이름 중복 시 `fromScreen`으로 스코핑). 추상 요청('모든 화면', 'back 버튼')이나 이름이 모호/없을 때만 먼저 orient.

### 6. `proto_wire`
소스 노드 → 목적 프레임 **Navigate To**(화면 전체 전환).
- **`from`/`to`는 노드 ID** (예 `"1404:1947"`), 프레임 이름 아님 — 이름은 먼저 resolve. *(단, 위 "이름 직접 수용" 규칙 적용)*
- `motion`은 프리셋 이름(`"M3_EMPHASIZED"`) 또는 전체 TransitionInput.
- SMART_ANIMATE는 두 프레임이 **이름으로 공유하는 레이어만** morph; 공유 레이어 없으면 연결의 `degradeTo`(기본 DISSOLVE)로 자동 강등. 화면 간 '밀려 들어오는' 공간감은 방향성 TransitionInput(PUSH/MOVE_IN/MOVE_OUT)을 `motion`으로.
- **경계:** 현재 화면 *위에* 뜨는 모달/팝업/시트는 `proto_overlay`(open).

### 7. `proto_change_to`
컴포넌트 **인스턴스 → 형제 variant 전환** (Figma 'Change to').
- **일회성 전환**(→selected, →on)이지, 매번 뒤집는 토글 아님.
- `from` = 컴포넌트 인스턴스 노드 ID(또는 그 안의 노드); `to` = 목표 variant 노드 ID(같은 component set 내 COMPONENT, **현재 variant가 아니어야** 함). 둘 다 ID.
- **경계:** 화면 전체 전환→`proto_wire`; 데이터 값→`proto_set_variable`; 매 탭마다 도로 꺼지는 on/off→BOOLEAN 변수 기반 `proto_toggle_variable`.
- **KO 큐:** '선택 상태로', 'highlight 상태로 바꿔', 'variant 바꿔', '~상태로 바꿔'.

### 8. `proto_overlay`
오버레이 리액션 배치 생성. 각 항목 `mode = "open" | "swap" | "close"`.
- open/swap은 `overlay` frameId 필요; close는 없음.
- open = 현재 화면 위에 뜨는 모달/팝업/다이얼로그/토스트/바텀시트; close = 열린 오버레이 닫고 아래 화면 노출.
- **모호성:** 오버레이 위에서 '돌아가/뒤로'는 close(아래 화면)인지 `proto_back`(히스토리 pop)인지 모호 → **사용자에게 질문**.
- **제약:** Figma 런타임이 overlay/swap/close에 SMART_ANIMATE 거부 → SMART_ANIMATE 기반 모션(M3/HIG 프리셋 전부)은 duration+easing 보존하며 **DISSOLVE로 자동 재작성**.

### 9. `proto_scroll`
소스 → 스크롤 타깃(Figma SCROLL_TO): 클릭 시 **같은 스크롤 프레임 내부의 타깃 노드**로 뷰 점프(타깃 프레임에 overflowDirection 필요 — `set_frame_scroll` 참고).
- **아님:** 페이지 간 '스크롤 느낌' 전환이 아님 — 그건 `proto_wire`의 방향성 트랜지션(PUSH/SLIDE_*).

### 10. `proto_back`
소스 → **Back 내비게이션**(프로토타입 히스토리 stack pop, 목적지 없음).
- 'go back/뒤로' = 사용자가 온 화면으로 동적 복귀. 특정 이전 프레임이면 `proto_wire`.
- **소스 선택:** 추상 요청('뒤로가기 달아줘')이면 먼저 각 프레임에서 back affordance(좌상단 아이콘, 이름에 back/arrow/chevron/prev, '<'/'‹' 글리프)를 찾아 ON_CLICK으로 와이어. 제스처를 명시('스와이프/밀어서 뒤로')할 때만 프레임 레벨 ON_DRAG. affordance 노드가 없으면 **노드를 만들지 말고 질문**.
- **⚠️ 오버레이 위 모호성:** '돌아가/뒤로'가 overlay close인지 Back인지 모호 → 질문.

### 11. `proto_url`
소스 → **Open URL**. 입력 `{ urls: [{ from, url, openInNewTab? }] }`.
- 기본 `openInNewTab=false`. **`motion` 필드 없음** — URL은 종료 이벤트, 트랜지션 기본 INSTANT.

### 12. `proto_set_variable`
소스 → **Set Variable**: 클릭 시 변수에 리터럴 값 할당(이름으로 resolve, 로컬/라이브러리, 자동 import).
- 입력 `{ sets: [{ from, variable, value }] }`. `value`는 boolean/number/string이며 변수 resolvedType과 일치해야 함; COLOR는 hex 문자열(`"#RRGGBB"`/`"#RRGGBBAA"`).
- **경계:** BOOLEAN을 값 지정 없이 뒤집기('토글/켜고 끄기')는 `proto_toggle_variable`. 이건 **특정 값** 할당.
- `motion` 없음(변수 변경은 즉시, INSTANT).

### 13. `proto_set_variable_mode`
변수 **컬렉션의 활성 모드 전환**(예: Light↔Dark, density) — Figma SET_VARIABLE_MODE. *(v0.39, 23번째 도구)*
- `mode` = 모드 이름(예 `"Dark"`); `collection` = 선택(같은 이름 모드가 여러 컬렉션에 있을 때만 디스앰비규에이션용).
- 먼저 `list_variables`로 각 컬렉션의 모드 확인. 모션 없음. **로컬 컬렉션만.**

### 14. `proto_toggle_variable`
소스 → **Toggle Variable**: 클릭 시 BOOLEAN 변수를 뒤집음(이름으로 resolve, 자동 import).
- 입력 `{ toggles: [{ from, variable }] }`. resolvedType이 **반드시 BOOLEAN**(아니면 플러그인 거부).
- **매 탭마다 도로 뒤집히는 on/off**에 적합. 특정 값 할당은 `proto_set_variable`; variant 기반 시각 컴포넌트의 일방향 전환은 `proto_change_to`.
- `motion` 없음. 내부적으로 CONDITIONAL + SET_VARIABLE 2개로 desugar(단, `list_reactions`는 toggle_variable 형태로 round-trip).

### 15. `proto_conditional`
소스에 **조건부 리액션(if/then/else)**, 변수 비교 기반. '~면 ~하고 아니면 ~'.
- 입력 `{ conditions: [{ from, if, then, else? }] }`. 변수는 **이름으로**, plugin이 런타임 resolve.
- `if` = 단일 비교 `{ variable, operator?, value }`, 또는 1단계 복합:
  - `{ all: [<비교>, …] }` (AND — 모두 참; 큐 '그리고/이고/둘 다/모두')
  - `{ any: [<비교>, …] }` (OR — 하나라도 참; 큐 '또는/거나/하나라도')
  - 각 배열 ≥2개 비교; all/any 혼용·중첩 불가(1단계). 다중 분기는 별도 리액션(Figma에 else-if 없음).
- `if.operator` 생략 시 `"=="`. 그 외 `!=, <, <=, >, >=`.
- `then`/`else`는 각각 **정확히 한 분기 액션**(sugar 키: `navigate`/`scroll`/`overlay`/`swap`/`close`/`back`/`url`/`set`). `toggle_variable`은 conditional 내부 불가. 다중 액션 분기는 `create_reactions`.
- overlay/swap 분기는 SMART_ANIMATE→DISSOLVE 자동 재작성(duration/easing 보존). COLOR 변수는 비교 불가.
- `trigger`/`motion`은 conditional 레벨(분기 공유); 분기 sugar는 안 받음.

### 16. `proto_get_last_history`
가장 최근 성공한 `proto_*` 호출들을 HistoryEntry 배열로 반환(newest-last).
- **언제:** "방금 만든 거" 참조 시 source/target ID·모션 프리셋 복구 → 해당 `proto_*`를 `replaceExisting=true`로 재호출해 수정.

---

## 🛠 ③ 엮기 — 저수준 기본기 (4)

`proto_*`가 내부적으로 쓰는 원초적 도구. 세밀한 직접 제어용.

### 17. `create_reactions`
프로토타입 리액션 **배치 저수준 생성**. 각 연결의 action은 Navigate To(`action.type=navigate`, `targetFrameId`) 또는 Scroll To(`action.type=scroll`, `targetNodeId`).
- 각 연결 독립 성공/실패. **escape hatch** — 흔한 경우는 `proto_wire`/`overlay`/`scroll`이 명명된 모션 프리셋으로 커버.

### 18. `clear_reactions`
하나 이상 노드에서 리액션 제거.
- `indices`를 주면 nodeId는 **정확히 하나**만 허용.

### 19. `set_frame_scroll`
프로토타입 모드용 프레임 **스크롤 동작(overflowDirection) 설정**. 인터랙션이 아닌 프레임 속성.
- 입력: `{ frameId, direction }` 배치, 각 독립 성공/실패.
- `direction`: `NONE`(스크롤 없음) / `HORIZONTAL` / `VERTICAL` / `BOTH`.
- *참고: per-layer sticky(scrollBehavior)는 Figma 플랫폼 미지원. 줄 수 있는 건 스크롤 방향 + (set_frame_scroll 계열로) 위쪽 고정 자식 수까지.*

### 20. `create_variable`
**find-or-create** Figma 변수. 같은 이름이 있으면 **재사용**(`reused:true`, 중복 생성 안 함).
- 신규 변수는 기본적으로 전용 `forProto` 컬렉션에(`collection`으로 override).
- `type`(BOOLEAN/FLOAT/STRING/COLOR) 필수; `value` 선택(생략 시 타입 중립값, COLOR는 hex).
- 먼저 `list_variables`로 기존 변수 선호. 생성 후 이름으로 `proto_set_variable`/`proto_toggle_variable`/`proto_conditional`에서 참조.

---

## ✅ ④ 검증 / 내보내기 (3)

작업을 끝낸 뒤 점검·전달. **서버 전용**(플러그인 변경 없음).

### 21. `validate_prototype`
페이지 프로토타입 흐름 **정적 린트**, 한 번에 문제 반환. 내부적으로 전체 그래프를 읽고 4규칙 검사:
- `broken-reference`(error — navigate/overlay가 이 페이지에 없는 프레임 가리킴)
- `unreachable`(error — 어떤 시작 프레임에서도 도달 불가; 시작 프레임 없으면 skip)
- `dead-end`(warning — 나가는 내비게이션 없는 프레임; 최종 화면일 수 있음)
- `start-frame`(warning — 시작 프레임 0개 또는 여러 개)
- 반환 `{ ok, page, issues:[{severity, rule, frameId, frameName, sourceNodeId?, sourceNodeName?, message}], summary:{errors,warnings,frames,interactions}, truncated }`, `ok = (errors === 0)`. `pageId?`(기본 현재 페이지).

### 22. `export_interactions`
완성된 화면들의 와이어된 인터랙션을 **정규·프레임워크 무관 JSON 스펙**으로 내보내기(개발자 핸드오프).
- 입력 `{ screens: string[] (프레임 노드 ID), pageId? }`.
- 반환 `{ schemaVersion, page, screens:[{id,name,interactions:[{source,trigger,actions}]}], requestedScreens, missingScreens, unsupported, truncated }`. 각 action은 타입 엔트리(navigate/scrollTo/openOverlay/swapOverlay/closeOverlay/back/openUrl/setVariable/toggleVariable/changeVariant/conditional).
- **READ/핸드오프 도구** — 프레임워크/UI 코드를 생성하지 않음(JSON에서 파생).

### 23. `generate_interaction_code`
화면들의 와이어된 인터랙션에서 **프레임워크 코드 생성**.
- 입력 `{ screens: string[], target: "react" | "react-native" | "swiftui" | "compose" | "flutter", pageId? }`.
- 반환 `{ schemaVersion, target, files: [{ path, content }], unsupported, missingScreens, truncated }`.
- **인터랙션 레이어만** 생성(routes / 변수 store / 화면별 인터랙션 훅 / 트랜지션 / README) — 화면 UI 아님(design→UI 코드와 페어링). 결정적이며 `export_interactions`와 같은 스펙 기반.

---

## 빠른 흐름 요약

```
읽기(get_canvas_overview / find_nodes)
   → 엮기(proto_wire / overlay / conditional …)   ← 흔한 경우는 proto_*, 세밀 제어는 create_reactions
   → 점검(validate_prototype)
   → 전달(export_interactions / generate_interaction_code)
```

- `proto_*`(고수준)와 `create_reactions`(저수준)는 같은 일을 추상화 높이만 다르게.
- 변수는 **읽기(list_variables) · 생성(create_variable) · 설정(proto_set_variable / toggle / mode)** 3단.
- 검증/내보내기 3종은 서버 전용 → npm 업데이트로 충분, 플러그인 변경이 아니라 Figma 재배포 불필요.
