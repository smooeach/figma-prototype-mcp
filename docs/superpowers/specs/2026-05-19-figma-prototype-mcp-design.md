# figma-prototype-mcp — 설계 문서 (v1)

- 작성일: 2026-05-19
- 상태: 초안 (사용자 리뷰 대기)

## 1. 목적

자연어 프롬프트만으로 Figma 프로토타입 인터랙션(On click → Navigate to)을 자동 생성하는 MCP 서버를 만든다. 공식 Figma MCP는 디자인 생성·읽기 중심이며 프로토타입 wiring 쓰기 API를 노출하지 않으므로, 별도 MCP로 보완한다.

사용 예: 사용자가 Figma에서 버튼들을 선택한 상태로 "이거 Home 프레임에 연결해줘"라고 입력하면 Claude가 본 MCP를 호출하여 실제 Figma 프로토타입 reactions를 생성한다.

## 2. 스코프

### v1 포함
- 프레임 ↔ 프레임 Navigate To 인터랙션 생성
- 노드 식별: 현재 선택 + 이름 기반 검색
- 기본 트랜지션: Instant (옵션으로 다른 값 허용)
- 단일 페이지 작업 위주, localhost 환경

### v1 비-목표
- Open overlay, Set variable, Scroll to 등 그 외 prototype action 타입
- 컴포넌트 변형(variant) 자동 매핑
- 프로토타입 시작 프레임 자동 지정, 디바이스 프레임/배경색 설정
- 다중 사용자 동시 편집 충돌 처리
- 클라우드 호스팅 / 헤드리스 실행

## 3. 출발점 / 기반 코드

[grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp)(MIT)에서 다음만 재사용한다:

| 가져옴 | 용도 |
|---|---|
| `src/socket.ts` | WebSocket relay 서버 (거의 그대로) |
| `manifest.json` 패턴 | Figma 플러그인 매니페스트 구조 참고 |
| 채널 시스템 패턴 | 작업 공간별 격리 |

`server.ts`(93KB)와 `code.js`(119KB)는 우리 시나리오 대비 95% 이상이 불필요하므로 트리밍 대신 처음부터 작성한다.

라이선스: 본 레포는 MIT. `LICENSE`에 grab 카피라이트 표기 + `README.md`에 출처 명시.

## 4. 아키텍처

3계층 구조 (grab과 동일):

```
   ┌─────────┐   stdio    ┌──────────────┐  WebSocket  ┌────────────┐  Plugin API  ┌───────┐
   │ Claude  │ ◀────────▶ │  MCP Server  │ ◀─────────▶ │  socket.ts │ ◀─────────▶ │Figma  │
   │  Code   │            │              │             │  (relay)   │             │Plugin │
   └─────────┘            └──────────────┘             └────────────┘              └───────┘
```

- **Claude ↔ MCP Server**: 표준 MCP (stdio)
- **MCP Server ↔ Relay**: WebSocket, JSON 메시지 봉투, 채널 기반 격리
- **Relay ↔ Plugin**: 동일 WebSocket. 플러그인이 Figma 안에서 실행되며 Plugin API로 reactions 쓰기

### 4.1 런타임 선택

- **MCP Server**: Node.js + TypeScript (Bun 의존성 회피, 일반 사용자 친화)
- **Relay (`socket.ts`)**: grab의 코드를 거의 그대로 두되 Node에서도 동작하도록 살짝 손봄
- **Plugin**: TypeScript, `tsup`으로 번들

### 4.2 디렉토리 구조

```
figma-prototype-mcp/
├── src/
│   ├── socket.ts                       # grab에서 가져옴 (거의 그대로)
│   ├── mcp-server/
│   │   ├── index.ts                    # MCP server entry, stdio
│   │   ├── tools.ts                    # 5개 툴 정의 (Zod 스키마 + 핸들러)
│   │   ├── plugin-bridge.ts            # WebSocket 클라이언트, plugin과 통신
│   │   └── types.ts                    # 공유 타입
│   └── figma-plugin/
│       ├── manifest.json
│       ├── code.ts                     # plugin main thread, 5개 커맨드 핸들러
│       ├── ui.html                     # 채널 입력 + 연결 상태만
│       └── ui.ts                       # UI 로직
├── docs/
│   └── README.md                       # 설치/사용 가이드
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── LICENSE
```

## 5. MCP 툴 5개 명세

툴 입자도는 **하이브리드** 접근: 읽기 1회 + 배치 쓰기 1회로 일반 시나리오를 종결한다.

### 5.1 `get_canvas_overview`

현재 작업 컨텍스트를 한 번에 가져온다. 모든 시나리오의 첫 호출.

```ts
// Input
{ pageId?: string }  // 생략 시 현재 활성 페이지

// Output
{
  page: { id: string, name: string },
  frames: [
    { id: string, name: string, width: number, height: number,
      isStartFrame: boolean }
  ],
  selection: [
    { id: string, name: string, type: string,
      parentFrameId: string | null,
      hasExistingReactions: boolean }
  ]
}
```

### 5.2 `find_nodes`

선택이 없을 때 이름·타입 패턴으로 노드 검색.

```ts
// Input
{
  query: string,                         // 부분 일치, 대소문자 무시
  nodeTypes?: string[],                  // ["INSTANCE", "FRAME", "TEXT"] 등 필터
  scope?: 'page' | 'document',           // 기본 'page'
  limit?: number                         // 기본 50
}

// Output
{
  nodes: [
    { id: string, name: string, type: string,
      parentFrameId: string | null,
      path: string }                     // "Page1 > Login Screen > CTA Button"
  ],
  truncated: boolean
}
```

### 5.3 `create_navigate_reactions`  ★ 핵심 쓰기 툴

배치로 여러 연결을 한 번에 생성.

```ts
// Input
{
  connections: [
    {
      sourceNodeId: string,
      targetFrameId: string,
      trigger?: 'ON_CLICK' | 'ON_HOVER' | 'ON_PRESS',   // 기본 ON_CLICK
      transition?: 'INSTANT' | 'DISSOLVE' | 'SMART_ANIMATE'  // 기본 INSTANT
    }
  ],
  replaceExisting?: boolean              // true면 기존 reactions 덮어쓰기. 기본 false (append)
}

// Output
{
  results: [
    { sourceNodeId: string,
      status: 'success' | 'error',
      error?: string,
      reactionIndex?: number }
  ],
  successCount: number,
  errorCount: number
}
```

배열 안 각 항목은 try/catch로 독립 처리. 전체 트랜잭션 X — 일부 성공해도 결과 반환.

### 5.4 `list_reactions`

특정 노드의 현재 reactions 조회 (디버깅·확인용).

```ts
// Input
{ nodeId: string }

// Output
{
  nodeId: string,
  nodeName: string,
  reactions: [
    { index: number,
      trigger: { type: string },
      action: {
        type: string,                                  // "NODE" (Navigate to) 등
        destinationId?: string,
        destinationName?: string,
        transition?: { type: string, duration?: number } }
    }
  ]
}
```

### 5.5 `clear_reactions`

특정 노드(들)의 reactions 제거 (재시도·실수 정리용).

```ts
// Input
{
  nodeIds: string[],
  indices?: number[]                     // 생략 시 전체 제거. 지정 시 단일 노드에만 적용
}

// Output
{
  results: [
    { nodeId: string,
      removedCount: number,
      status: 'success' | 'error',
      error?: string }
  ]
}
```

### 5.6 시나리오별 호출 패턴

| 사용자 발화 | Claude 호출 시퀀스 |
|---|---|
| "현재 선택한 거 Home에 연결해줘" | `get_canvas_overview` → `create_navigate_reactions` |
| "모든 Continue 버튼을 다음 화면으로" | `get_canvas_overview` → `find_nodes` (query="Continue") → `create_navigate_reactions` |
| "방금 거 취소" | `clear_reactions` |
| "이 버튼 어디로 연결돼?" | `list_reactions` |

## 6. 플러그인 커맨드 표면

MCP 툴마다 플러그인 커맨드 1:1 매핑:

| MCP 툴 | 플러그인 커맨드 | Figma Plugin API |
|---|---|---|
| `get_canvas_overview` | `GET_CANVAS_OVERVIEW` | `figma.currentPage`, `figma.currentPage.children.filter(...)`, `figma.currentPage.selection` |
| `find_nodes` | `FIND_NODES` | `figma.currentPage.findAll(predicate)` |
| `create_navigate_reactions` | `CREATE_NAVIGATE_REACTIONS` | `node.setReactionsAsync([...])` |
| `list_reactions` | `LIST_REACTIONS` | `node.reactions` 읽기 |
| `clear_reactions` | `CLEAR_REACTIONS` | `node.setReactionsAsync([])` |

### 6.1 메시지 봉투

```ts
// MCP server → relay → plugin
{
  id: "req-uuid",
  type: "command",
  channel: "abc123",
  command: "CREATE_NAVIGATE_REACTIONS",
  params: { connections: [...] }
}

// plugin → relay → MCP server
{
  id: "req-uuid",
  type: "response",
  channel: "abc123",
  status: "ok" | "error",
  result?: { ... },
  error?: { code: string, message: string }
}
```

### 6.2 Figma Reaction 객체 (플러그인 내부 빌더)

```ts
const reaction: Reaction = {
  trigger: { type: "ON_CLICK" },
  actions: [{
    type: "NODE",
    destinationId: targetFrameId,
    navigation: "NAVIGATE",
    transition: { type: "INSTANT" },
    preserveScrollPosition: false,
  }]
}
await node.setReactionsAsync([...node.reactions, reaction])
```

### 6.3 채널 시스템

- 사용자가 plugin UI에서 임의의 채널 문자열(예: `my-session`) 입력
- MCP server도 같은 채널로 연결
- relay가 채널별로 메시지 격리
- 결과: 여러 Figma 파일 작업 동시 가능, 멀티유저 환경 안전

### 6.4 manifest.json (핵심 부분)

```json
{
  "name": "Figma Prototype MCP",
  "id": "figma-prototype-mcp",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["ws://localhost:3055"]
  }
}
```

## 7. 에러 처리 정책

3단 방어:

### 7.1 MCP 서버 단
Zod 스키마로 입력 검증. 잘못된 타입·필수 필드 누락 시 즉시 JSON-RPC error 반환, 플러그인까지 가지 않음.

### 7.2 플러그인 단

| 케이스 | 처리 |
|---|---|
| 소스 노드 ID 없음 | `error: "Source node not found: <id>"` |
| 타겟 프레임 ID 없음 또는 FRAME 타입 아님 | `error: "Target must be a frame: <id>"` |
| 소스 노드가 reaction 지원 안 함 | `error: "Node cannot have reactions: <name>"` |
| `setReactionsAsync` 예외 | 원본 에러 메시지를 `error` 필드로 |
| 채널 미연결 | MCP 서버에서 즉시 에러 |

### 7.3 배치 격리
`create_navigate_reactions`의 connections 배열 각 항목은 try/catch로 독립 처리.

### 7.4 타임아웃
WebSocket 응답 30초 미수신 시 MCP server가 timeout error.

## 8. 테스트 전략

| 레벨 | 무엇을 | 도구 |
|---|---|---|
| 유닛 | Zod 스키마 검증 | vitest |
| 유닛 | reaction 객체 빌더 함수 | vitest |
| 통합 | MCP server ↔ relay ↔ mock plugin (WebSocket echo) — 봉투 형식 검증 | vitest + ws |
| 수동 E2E | 실제 Figma에 플러그인 로드, 5개 시나리오 실행 | 체크리스트 |

자동화된 Figma E2E는 v1 범위 밖. 수동 테스트 체크리스트를 README에 포함.

### 8.1 수동 테스트 체크리스트 (v1 완료 기준)

1. "현재 선택한 버튼 N개를 [프레임 이름]에 연결" → Present 모드에서 클릭 시 이동 확인
2. "모든 [텍스트] 버튼을 다음 화면으로" — 이름 패턴 매칭으로 연결
3. "이 버튼 어디로 연결돼?" → `list_reactions` 결과가 Figma UI와 일치
4. "방금 만든 연결 다 지워줘" → reactions 제거 확인
5. 에러 케이스: 존재하지 않는 프레임 이름 → 사용자 친화적 에러 메시지

## 9. 산출물 (Definition of Done)

**코드**:
- [ ] `src/socket.ts` — grab에서 복사, 라이선스 표기
- [ ] `src/mcp-server/` — index.ts, tools.ts, plugin-bridge.ts, types.ts
- [ ] `src/figma-plugin/` — manifest.json, code.ts, ui.html
- [ ] `package.json`, `tsconfig.json`, `tsup.config.ts`
- [ ] `LICENSE` (MIT, grab 카피라이트 포함)

**문서**:
- [ ] `README.md` — 설치, 플러그인 로드 방법, 채널 설정, 5개 툴 사용법, 알려진 한계
- [x] 본 설계 문서 (`docs/superpowers/specs/2026-05-19-figma-prototype-mcp-design.md`)

**검증**:
- [ ] 유닛 테스트 통과
- [ ] 수동 E2E 체크리스트 5개 시나리오 통과

## 10. 알려진 한계 (README에 명시)

- v1은 Navigate To만. Open overlay, Set variable, Scroll to 등 미지원
- 기본 트랜지션은 Instant. Smart Animate는 옵션이지만 디자인이 맞아야 동작
- Figma 데스크탑/웹 앱 열려있고 플러그인 실행 중이어야 함 (헤드리스 불가)
- 단일 페이지 내 작업 위주
- relay·MCP server·플러그인 모두 같은 머신 (localhost WebSocket)
