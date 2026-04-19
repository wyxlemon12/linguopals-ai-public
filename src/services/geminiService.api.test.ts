import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: vi.fn(),
    };
  },
  Modality: { AUDIO: "AUDIO" },
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING",
    BOOLEAN: "BOOLEAN",
  },
}));

vi.mock("s2t-chinese", () => ({
  default: {
    s2t: (text: string) => text,
  },
}));

describe("geminiService client API bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("uses the internal refresh-missions API", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ greeting: "hello", missions: [] }),
    } as Response);

    const { refreshMissions } = await import("./geminiService");

    await refreshMissions(
      {
        id: "astronaut",
        name: "Astronaut",
        roleTitle: "Explorer",
        avatar: "🚀",
        description: "Explore",
        systemInstruction: "Stay in character",
        initialMessage: "hi",
        voice: "Charon",
      },
      "report text",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/refresh-missions",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("uses the internal targeted-character API and forwards student profile data", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "Guide",
        roleTitle: "Coach",
        avatar: "🌙",
        description: "desc",
        tags: [],
        initialMessage: "hi",
        systemInstruction: "rules",
        missions: [],
      }),
    } as Response);

    const { generateTargetedCharacter } = await import("./geminiService");

    await generateTargetedCharacter("report text", {
      id: "student_1",
      name: "Harry",
      report: "report text",
      info: {
        grade: "G3",
        enrollmentDate: "2024-01-01",
        firstLanguage: "English",
        customField: "Needs short prompts",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/generate-targeted-character",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"grade":"G3"'),
      }),
    );
  });

  it("uses the internal text-to-speech API", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audio: "ZmFrZS1hdWRpbw==" }),
    } as Response);

    const { textToSpeech } = await import("./geminiService");

    await textToSpeech("hello there", "Kore");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/text-to-speech",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
