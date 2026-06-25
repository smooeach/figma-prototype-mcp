const COMMUNITY_URL =
  "https://www.figma.com/community/plugin/1647184714488719280";

export const PLUGIN_NOT_CONNECTED = [
  `Figma plugin not connected. The MCP server is running, but no Figma plugin has connected yet.`,
  `To connect: in Figma, open your file → Plugins → run "Prototype MCP".`,
  `If you haven't installed it, get it from Figma Community:`,
  COMMUNITY_URL,
  `The plugin auto-connects to ws://localhost:3939/ws — once it shows "Connected", retry your request.`,
  ``,
  `Figma 플러그인이 연결되지 않았습니다. MCP 서버는 실행 중이지만 플러그인이 아직 연결되지 않았어요.`,
  `연결 방법: Figma에서 파일을 열고 → Plugins → "Prototype MCP" 실행.`,
  `설치 전이라면 Figma Community에서 받으세요:`,
  COMMUNITY_URL,
  `플러그인은 ws://localhost:3939/ws에 자동 연결됩니다 — "Connected"가 뜨면 다시 시도하세요.`,
].join("\n");

export const PLUGIN_DISCONNECTED = [
  `The Figma plugin disconnected before the command finished. This usually means the Figma tab/file or the plugin window was closed.`,
  `Reopen "Prototype MCP" in Figma — it auto-reconnects — then retry.`,
  ``,
  `명령이 끝나기 전에 Figma 플러그인 연결이 끊겼습니다. 보통 Figma 탭/파일이나 플러그인 창을 닫았을 때 발생해요.`,
  `Figma에서 "Prototype MCP"를 다시 실행하면 자동 재연결됩니다 — 그 후 다시 시도하세요.`,
].join("\n");

export const PLUGIN_CONNECTION_REPLACED = [
  `Your plugin connection was replaced by a newer one. Only one Figma plugin can be active at a time (newest wins) — this usually means the plugin connected from a second Figma tab or file.`,
  `Use the most recently opened "Prototype MCP" plugin, then retry.`,
  ``,
  `플러그인 연결이 더 새로운 연결로 교체되었습니다. 한 번에 하나의 Figma 플러그인만 활성화됩니다(최신 우선) — 보통 두 번째 Figma 탭이나 파일에서 플러그인이 연결됐을 때 발생해요.`,
  `가장 최근에 연 "Prototype MCP" 플러그인을 사용한 뒤 재시도하세요.`,
].join("\n");

export const pluginCommandTimeout = (command: string, ms: number): string =>
  [
    `The Figma plugin is connected but didn't respond within ${ms}ms (command: ${command}).`,
    `Figma may be busy, or the plugin may be stuck. Try closing and relaunching "Prototype MCP" in Figma, then retry.`,
    ``,
    `Figma 플러그인이 연결돼 있지만 ${ms}ms 안에 응답하지 않았습니다 (명령: ${command}).`,
    `Figma가 바쁘거나 플러그인이 멈췄을 수 있어요. Figma에서 "Prototype MCP"를 닫았다가 다시 실행한 뒤 재시도하세요.`,
  ].join("\n");
