import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: generateContentMock,
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

describe("server ai helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("keeps post-greeting dialogue natural instead of pushing tasks directly", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: "[对话内容]我们一起做月饼吧。[标准示范]我想做月饼。[思考时刻]你喜欢甜的吗？",
    });

    const { sendMessageData } = await import("./ai");

    await sendMessageData({
      history: [{ role: "user", text: "我喜欢月饼" }],
      missions: [],
      childReport: "孩子喜欢美食",
      customInstruction: "你是月亮厨房点心师。",
      student: {
        name: "Harry",
        info: {
          grade: "G3",
          enrollmentDate: "2024-03-12",
          firstLanguage: "中文",
          customField: "",
        },
      },
    });

    const config = generateContentMock.mock.calls[0][0].config;
    expect(config.systemInstruction).toContain("After the greeting, keep the conversation natural");
    expect(config.systemInstruction).toContain("Do not explicitly tell the child to ask mission questions");
  });

  it("updates missions when the child response fulfills a mission", async () => {
    generateContentMock
      .mockResolvedValueOnce({
        text: "[对话内容]太好了。[标准示范]我想做豆沙月饼。[思考时刻]你喜欢甜的吗？",
      })
      .mockResolvedValueOnce({
        text: JSON.stringify([
          {
            id: "chef_1",
            title: "做月饼",
            description: "问问我想做什么口味的月饼。",
            completed: true,
          },
        ]),
      });

    const { sendMessageData } = await import("./ai");

    const result = await sendMessageData({
      history: [{ role: "user", text: "你想做什么口味的月饼？" }],
      missions: [
        {
          id: "chef_1",
          title: "做月饼",
          description: "问问我想做什么口味的月饼。",
          completed: false,
        },
      ],
      childReport: "",
      customInstruction: "你是月亮厨房点心师。",
      student: {
        name: "Harry",
        info: {
          grade: "G3",
          enrollmentDate: "2024-03-12",
          firstLanguage: "中文",
          customField: "",
        },
      },
    });

    expect(result.updatedMissions[0].completed).toBe(true);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });
});
