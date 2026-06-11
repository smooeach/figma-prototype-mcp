# Claude Code Skills 가이드 — 디자이너용

> 디자이너 관점에서 정리한 설치된 모든 Skills 요약.
> 시각 작업·기획·핸드오프·개발 협업 순서로 우선순위를 매겼습니다.
>
> 작성일: 2026-05-19

---

## 🎨 1. 디자인 작업에 직접 쓰는 것들 (최우선)

### Figma 통합 (MCP 서버)
Figma 파일을 읽고/쓰고/연결하는 **공식 Figma MCP**입니다. `figma.com` URL을 붙여 넣거나 "이걸 Figma로 만들어줘"만 말해도 자동 발동.

| 기능 | 무엇을 하나 |
|---|---|
| `get_design_context` | Figma 디자인을 코드 작업용 컨텍스트로 가져오기 |
| `get_screenshot` | Figma 프레임의 스크린샷 추출 |
| `get_metadata` / `get_variable_defs` | 디자인 토큰·변수 정의 가져오기 |
| `use_figma` | 코드/의도/기존 컴포넌트를 Figma 안으로 **밀어넣기** (design ← code) |
| `create_new_file` | 새 Figma 파일 생성 |
| `generate_diagram` / `get_figjam` | FigJam에서 다이어그램·아이디에이션 작업 |
| `get_libraries` / `search_design_system` | 디자인 시스템·라이브러리 탐색 |
| `add_code_connect_map` / `get_code_connect_map` | Figma 컴포넌트 ↔ 코드 컴포넌트 매핑 (Code Connect) |
| `upload_assets` | 에셋 업로드 |

**연관 Skills** (Figma 작업 전 필수 로드)
- `/figma-use` — `use_figma` 호출 전 **필수**
- `/figma-generate-design` — 앱 화면/레이아웃 → Figma로 변환
- `/figma-generate-library` — 코드로부터 디자인 시스템 빌드
- `/figma-code-connect` — 컴포넌트 매핑 설정
- `/figma-use-figjam` — FigJam 전용 흐름
- `/figma-generate-diagram` — `generate_diagram` 호출 전 **필수**

---

### 프로토타입 연결 (figma-prototype MCP)
공식 Figma MCP가 화면을 **만든다면**, 이건 그 화면들을 **말로 이어 붙여** 살아있는 프로토타입으로 만드는 동반 도구입니다. "screen1에서 screen2로 부드럽게 넘어가게 / 메뉴 버튼 누르면 팝업 뜨게 / 이 화면에 뒤로가기 달아줘" 식으로 화면 전환·오버레이·스크롤·뒤로가기·변수·조건분기를 연결합니다. 화면 **생성은 공식 Figma MCP**, **연결은 이 도구** — 둘을 함께 쓰는 역할 분담.

👉 사용법 한 장 요약: **[프로토타입 연결 — 디자이너용 치트시트](prototype-wiring-for-designers.md)**

---

### `prototype` — 빠른 프로토타입 만들기
디자인을 확정하기 전에 **버려도 되는 프로토타입**을 만듭니다. 두 갈래로 자동 분기:
- **터미널 앱** — 데이터/상태 머신/비즈니스 로직 검증용
- **UI 변형 여러 개** — 한 라우트에서 토글 가능한 급진적으로 다른 UI 시안들

> 트리거: "프로토타입 해줘", "여러 디자인 시도해줘", "가지고 놀게 해줘"

---

### `superpowers:brainstorming` — 본격 작업 전 발상 단계
**창의적 작업 시작 전 반드시 거치는 단계**. 사용자 의도·요구사항·디자인 옵션을 먼저 정리한 뒤 구현으로 넘어갑니다. 새 기능·새 화면·새 컴포넌트 만들기 전에 작동.

---

## 📝 2. 기획·문서·핸드오프

| Skill | 용도 |
|---|---|
| `to-prd` | 지금까지의 대화를 **PRD** 문서로 변환해 이슈 트래커에 발행 |
| `to-issues` | 계획/PRD/스펙을 **독립 실행 가능한 이슈들**로 분해 (수직 슬라이스 단위) |
| `handoff` | 현재 대화를 **다음 에이전트가 이어받을 핸드오프 문서**로 압축 |
| `triage` | 들어온 버그/요청을 상태 머신 기반으로 **분류·정리** |
| `superpowers:writing-plans` | 멀티스텝 작업의 **구현 계획서** 작성 |
| `grill-me` | 본인이 짠 계획/디자인을 **인터뷰 형식으로 압박 검증** |
| `grill-with-docs` | 위의 강화판 — 프로젝트 문서(CONTEXT.md, ADR)와 대조하며 검증 |

---

## 🔗 3. 개발자와 협업할 때 알아두면 좋은 것들

### 리뷰
- `review` — PR 리뷰
- `security-review` — 현재 브랜치 변경분 보안 리뷰
- `superpowers:requesting-code-review` — 작업 끝나고 리뷰 요청하는 방식
- `superpowers:receiving-code-review` — 리뷰 받았을 때 처리하는 방식

### 검증·완료
- `superpowers:verification-before-completion` — "다 됐어요" 말하기 전 **반드시 검증** 거치기
- `superpowers:finishing-a-development-branch` — 작업 끝났을 때 merge/PR/정리 옵션 안내

### 디버깅
- `diagnose` — 어려운 버그·성능 회귀 진단 루프
- `superpowers:systematic-debugging` — 버그/테스트 실패 시 체계적 접근

### 테스트
- `superpowers:test-driven-development` / `tdd` — TDD (Red-Green-Refactor)
- `migrate-to-shoehorn` — 테스트 파일 타입 단언 마이그레이션 (실무 도구)

> 💡 디자이너 입장에서 직접 쓸 일은 적지만, 개발자에게 "이런 절차로 가요"라고 안내할 때 참조용으로 유용.

---

## 🌳 4. Git·브랜치·안전장치

| Skill | 용도 |
|---|---|
| `superpowers:using-git-worktrees` | 작업 격리용 **워크트리** 자동 생성 |
| `git-guardrails-claude-code` | `git push`, `reset --hard` 같은 **위험한 명령 차단** 훅 설치 |
| `setup-pre-commit` | Husky + lint-staged (Prettier·타입체크·테스트) 자동 설정 |

---

## ⚙️ 5. 워크플로우·자동화

| Skill | 용도 |
|---|---|
| `superpowers:executing-plans` | 작성된 계획을 **체크포인트와 함께 실행** |
| `superpowers:subagent-driven-development` | 독립 작업들을 서브에이전트에 분배 |
| `superpowers:dispatching-parallel-agents` | 2개 이상의 독립 작업 **병렬 실행** |
| `loop` | 프롬프트/명령을 **주기적으로 반복** (5분마다, 등) |
| `schedule` | 크론 스케줄로 **원격 에이전트** 자동 실행 |
| `caveman` | 토큰 75% 절약 — 짧고 압축된 응답 모드 ("동굴인 모드") |

---

## 🛠️ 6. 환경·설정

| Skill | 용도 |
|---|---|
| `update-config` | `settings.json` 설정 (권한·환경변수·훅) |
| `keybindings-help` | 키보드 단축키 커스터마이징 |
| `fewer-permission-prompts` | 자주 쓰는 명령을 allowlist에 추가해 **권한 팝업 줄이기** |
| `init` | 프로젝트에 `CLAUDE.md` 초기화 |
| `claude-api` | Claude API/SDK 앱 빌드·디버깅 (프롬프트 캐싱 포함) |

---

## 🧩 7. 메타·기타

- `write-a-skill` / `superpowers:writing-skills` — **새 Skill 직접 만들기**
- `superpowers:using-superpowers` — Skill 시스템 사용법 (시작 시 자동 발동)
- `improve-codebase-architecture` — 아키텍처 개선 기회 탐색
- `scaffold-exercises` — 강의/연습 자료 디렉토리 스캐폴딩
- `simplify` — 변경된 코드 품질·재사용성 리뷰

---

## 🚀 디자이너용 추천 워크플로우

### 시나리오 A: 아이디어 → Figma 시안 → 코드 전달
```
brainstorming → prototype (UI 변형) → /figma-generate-design
   → use_figma → /figma-code-connect → to-issues
```

### 시나리오 B: 기존 코드 → 디자인 시스템 정비
```
get_design_context → search_design_system
   → /figma-generate-library → add_code_connect_map
```

### 시나리오 C: 기획서 작성·핸드오프
```
brainstorming → grill-with-docs → to-prd → to-issues → handoff
```

### 시나리오 D: 다이어그램·플로우 시각화
```
/figma-generate-diagram → generate_diagram (FigJam)
```

---

## 📌 디자이너 입장 체크리스트

- [ ] **새 화면/기능 작업 전** `brainstorming` 먼저 돌리기
- [ ] **Figma 작업 시작 전** `/figma-use` 또는 관련 figma skill 로드
- [ ] **빠른 시안이 필요할 때** `prototype` 사용 — 본 코드 건드리지 않음
- [ ] **개발팀에 넘기기 전** `to-prd` + `to-issues`로 정돈
- [ ] **위험한 작업 자동 차단**은 `git-guardrails-claude-code`로 미리 설정
- [ ] **토큰 절약하고 싶을 때** `/caveman` 호출
