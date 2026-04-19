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

  it("uses the CSL core prompt structure and does not leak tasks into the NPC layer", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        tasks: {
          general_task_A: {
            description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
            status: "未完成",
            just_unlocked: false,
          },
          general_task_B: {
            description: "用户需要使用选择句型做出选择",
            status: "未完成",
            just_unlocked: false,
          },
          challenge_task_C: {
            description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
            status: "未完成",
            just_unlocked: false,
          },
        },
        npc_reply: "我们一起做月饼吧。",
      }),
    });

    const { sendMessageData } = await import("./ai");

    await sendMessageData({
      history: [{ role: "user", text: "我喜欢月饼" }],
      missions: [],
      childReport: "需要多练习动宾结构和完整句表达。",
      customInstruction: "你是月亮厨房的小老师。",
      student: {
        name: "Harry",
        info: {
          grade: "G3",
          enrollmentDate: "2024-03-12",
          firstLanguage: "中文",
          customField: "喜欢超级英雄",
        },
      },
    });

    const config = generateContentMock.mock.calls[0][0].config;
    expect(config.systemInstruction).toContain("# Role: 中文场景对话智能体 (CSL Scenario Dialogue Agent)");
    expect(config.systemInstruction).toContain("## Rules & Constraints (核心规则)");
    expect(config.systemInstruction).toContain("## Output Format (严格的JSON输出)");
    expect(config.systemInstruction).toContain("**用户信息**");
    expect(config.systemInstruction).toContain("**语言薄弱环节**");
    expect(config.systemInstruction).toContain("**当前设定场景**");
    expect(config.systemInstruction).toContain("**AI扮演角色**");
    expect(config.systemInstruction).toContain("绝对不知道任何关于“任务”的信息");
    expect(config.systemInstruction).toContain("绝对不要问只能回答“好/不好”");
    expect(config.systemInstruction).toContain("不要输出其他多余文字");
    expect(config.systemInstruction).not.toContain("Mission tracking");
  });

  it("translates initialization JSON into the current greeting plus mission list contract", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        tasks: {
          general_task_A: {
            description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
            status: "未完成",
            just_unlocked: false,
          },
          general_task_B: {
            description: "用户需要使用选择句型做出选择",
            status: "未完成",
            just_unlocked: false,
          },
          challenge_task_C: {
            description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
            status: "未完成",
            just_unlocked: false,
          },
        },
        npc_reply: "哈利你好呀！我是月亮厨房的小帮手。今天你想先揉面团，还是先看月饼模具？",
      }),
    });

    const { generateRefreshMissions } = await import("./ai");

    const result = await generateRefreshMissions(
      {
        name: "嫦娥姐姐",
        roleTitle: "中秋耐心引导员",
        description: "中秋节一起做月饼",
        tags: ["中秋", "做月饼"],
        initialMessage: "你好呀！",
        systemInstruction: "热情耐心的中国朋友",
      },
      "需要多练习动宾结构和完整句表达。",
      {
        name: "Harry",
        info: {
          grade: "G3",
          enrollmentDate: "2024-03-12",
          firstLanguage: "中文",
          customField: "喜欢超级英雄",
        },
      },
    );

    expect(result.greeting).toContain("哈利你好呀");
    expect(result.missions).toHaveLength(3);
    expect(result.missions[0]).toMatchObject({
      id: "general_task_A",
      type: "general",
      title: "一般任务 A",
      status: "未完成",
      completed: false,
      justUnlocked: false,
    });
    expect(result.missions[2]).toMatchObject({
      id: "challenge_task_C",
      type: "challenge",
      title: "挑战任务 C",
      status: "未完成",
      completed: false,
      justUnlocked: false,
    });
  });

  it("marks justUnlocked only on the turn where a task first becomes completed", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        tasks: {
          general_task_A: {
            description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
            status: "已完成",
            just_unlocked: false,
          },
          general_task_B: {
            description: "用户需要使用选择句型做出选择",
            status: "未完成",
            just_unlocked: false,
          },
          challenge_task_C: {
            description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
            status: "未完成",
            just_unlocked: false,
          },
        },
        npc_reply: "好呀，我先把面团放在这里。",
      }),
    });

    const { sendMessageData } = await import("./ai");

    const firstResult = await sendMessageData({
      history: [{ role: "user", text: "把面团揉圆吧" }],
      missions: [
        {
          id: "general_task_A",
          type: "general",
          title: "一般任务 A",
          description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
          status: "未完成",
          completed: false,
          justUnlocked: false,
        },
        {
          id: "general_task_B",
          type: "general",
          title: "一般任务 B",
          description: "用户需要使用选择句型做出选择",
          status: "未完成",
          completed: false,
          justUnlocked: false,
        },
        {
          id: "challenge_task_C",
          type: "challenge",
          title: "挑战任务 C",
          description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
          status: "未完成",
          completed: false,
          justUnlocked: false,
        },
      ],
      childReport: "需要多练习动宾结构和完整句表达。",
      customInstruction: "你是月亮厨房的小老师。",
      student: {
        name: "Harry",
        info: {
          grade: "G3",
          enrollmentDate: "2024-03-12",
          firstLanguage: "中文",
          customField: "喜欢超级英雄",
        },
      },
    });

    expect(firstResult.text).toBe("好呀，我先把面团放在这里。");
    expect(firstResult.updatedMissions[0]).toMatchObject({
      status: "已完成",
      completed: true,
      justUnlocked: true,
    });
    expect(firstResult.updatedMissions[1].justUnlocked).toBe(false);
  });

  it("clears justUnlocked on later turns once a task is already completed", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        tasks: {
          general_task_A: {
            description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
            status: "已完成",
            just_unlocked: true,
          },
          general_task_B: {
            description: "用户需要使用选择句型做出选择",
            status: "未完成",
            just_unlocked: false,
          },
          challenge_task_C: {
            description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
            status: "未完成",
            just_unlocked: false,
          },
        },
        npc_reply: "我已经把面团揉好了，我们接着包馅吧。",
      }),
    });

    const { sendMessageData } = await import("./ai");

    const result = await sendMessageData({
      history: [{ role: "user", text: "那我们接下来包豆沙吧" }],
      missions: [
        {
          id: "general_task_A",
          type: "general",
          title: "一般任务 A",
          description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
          status: "已完成",
          completed: true,
          justUnlocked: true,
        },
        {
          id: "general_task_B",
          type: "general",
          title: "一般任务 B",
          description: "用户需要使用选择句型做出选择",
          status: "未完成",
          completed: false,
          justUnlocked: false,
        },
        {
          id: "challenge_task_C",
          type: "challenge",
          title: "挑战任务 C",
          description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
          status: "未完成",
          completed: false,
          justUnlocked: false,
        },
      ],
      childReport: "需要多练习动宾结构和完整句表达。",
      customInstruction: "你是月亮厨房的小老师。",
      student: {
        name: "Harry",
        info: {
          grade: "G3",
          enrollmentDate: "2024-03-12",
          firstLanguage: "中文",
          customField: "喜欢超级英雄",
        },
      },
    });

    expect(result.updatedMissions[0]).toMatchObject({
      status: "已完成",
      completed: true,
      justUnlocked: false,
    });
  });
});
