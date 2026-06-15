import { describe, it, expect } from "vitest";
import {
  PLUGIN_NOT_CONNECTED,
  PLUGIN_DISCONNECTED,
  PLUGIN_CONNECTION_REPLACED,
  pluginCommandTimeout,
} from "../src/server/messages.js";

// Korean text lives in the U+AC00–U+D7A3 Hangul syllable block.
const hasKorean = (s: string) => /[가-힣]/.test(s);
// A plain ASCII-letter run of length >= 4 stands in for "has English prose".
const hasEnglish = (s: string) => /[A-Za-z]{4,}/.test(s);

describe("connection guidance messages", () => {
  const statics = {
    PLUGIN_NOT_CONNECTED,
    PLUGIN_DISCONNECTED,
    PLUGIN_CONNECTION_REPLACED,
  };

  for (const [name, msg] of Object.entries(statics)) {
    it(`${name} is bilingual and names the plugin`, () => {
      expect(hasEnglish(msg)).toBe(true);
      expect(hasKorean(msg)).toBe(true);
      expect(msg).toContain("Prototype MCP");
    });
  }

  it("PLUGIN_NOT_CONNECTED includes the Community install link", () => {
    expect(PLUGIN_NOT_CONNECTED).toContain(
      "https://www.figma.com/community/plugin/1647184714488719280",
    );
  });

  it("pluginCommandTimeout interpolates command + ms and is bilingual", () => {
    const msg = pluginCommandTimeout("CREATE_REACTIONS", 30000);
    expect(msg).toContain("CREATE_REACTIONS");
    expect(msg).toContain("30000");
    expect(hasEnglish(msg)).toBe(true);
    expect(hasKorean(msg)).toBe(true);
  });
});
