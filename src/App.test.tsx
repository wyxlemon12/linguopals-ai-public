import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  generateCustomCharacter,
  generateTargetedCharacter,
  refreshMissions,
  sendMessage,
  textToSpeech,
} from "./services/geminiService";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({
          animate: _animate,
          children,
          exit: _exit,
          initial: _initial,
          transition: _transition,
          whileHover: _whileHover,
          whileTap: _whileTap,
          ...props
        }: {
          animate?: unknown;
          children?: React.ReactNode;
          exit?: unknown;
          initial?: unknown;
          transition?: unknown;
          whileHover?: unknown;
          whileTap?: unknown;
        }) => React.createElement(tag, props, children),
    },
  ),
}));

const { hiddenMissions } = vi.hoisted(() => ({
  hiddenMissions: [
    {
      id: "general_task_A",
      type: "general",
      title: "一般任务 A",
      description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
      status: "未完成",
      justUnlocked: false,
      completed: false,
    },
    {
      id: "general_task_B",
      type: "general",
      title: "一般任务 B",
      description: "用户需要使用选择句型做出选择",
      status: "未完成",
      justUnlocked: false,
      completed: false,
    },
    {
      id: "challenge_task_C",
      type: "challenge",
      title: "挑战任务 C",
      description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
      status: "未完成",
      justUnlocked: false,
      completed: false,
    },
  ] as any[],
}));

vi.mock("./services/geminiService", () => ({
  CHARACTERS: [
    {
      id: "astronaut",
      name: "Test Astronaut (Zhu Rong)",
      roleTitle: "Explorer",
      avatar: "🚀",
      description: "Explore the stars.",
      tags: ["space"],
      systemInstruction: "Stay in character.",
      initialMessage: "Initial greeting",
      voice: "Charon",
      missions: hiddenMissions,
    },
  ],
  generateCustomCharacter: vi.fn(),
  generateTargetedCharacter: vi.fn(),
  refreshMissions: vi.fn().mockResolvedValue({
    missions: hiddenMissions,
    greeting: "Fresh greeting from the guide",
  }),
  sendMessage: vi.fn(),
  textToSpeech: vi.fn().mockResolvedValue("ZmFrZS1hdWRpbw=="),
  toTraditional: (text: string) => text,
  updateMissionStatus: vi.fn(),
}));

describe("App interaction flow", () => {
  it("shows the simplified greeting text after a character is selected", async () => {
    vi.mocked(refreshMissions).mockResolvedValueOnce({
      missions: hiddenMissions,
      greeting:
        "哈利你好呀！我是超能面点大侠！欢迎来到亮晶晶的月亮厨房，哇，这里到处都是香喷喷的味道，我正准备做圆圆的月饼呢！你看，案板上有好多好玩的东西，快快进来，跟我一起当小小面点师吧？",
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    await waitFor(() => {
      expect(screen.getByText(/你想先说你看到什么吗/)).toBeTruthy();
    });
  });

  it("plays the simplified greeting the first time a character is selected", async () => {
    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    await waitFor(() => {
      expect(textToSpeech).toHaveBeenCalledWith(
        "Fresh greeting from the guide！你想先说你看到什么吗？",
        "Charon",
      );
    });
  });

  it("renders only the dialogue bubble even when legacy helper tags are returned", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      text: "[对话内容]月亮上住着玉兔。[思考时刻]你猜玉兔在做什么？[挑战参考]月亮上住着可爱的玉兔。",
      updatedMissions: hiddenMissions,
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));
    await userEvent.type(screen.getByRole("textbox"), "月亮上住着什么呢{enter}");

    await waitFor(() => {
      expect(screen.getByText("月亮上住着玉兔。")).toBeTruthy();
      expect(screen.queryByText("思考时刻")).toBeNull();
      expect(screen.queryByText("挑战参考")).toBeNull();
      expect(screen.queryByText("标准普通话表达")).toBeNull();
    });
  });

  it("hides unfinished task descriptions and only shows progress", async () => {
    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    await waitFor(() => {
      expect(screen.getByText("0/3")).toBeTruthy();
      expect(screen.queryByText("用户需要说出包含目标词的动宾短语：把面团揉圆")).toBeNull();
      expect(screen.queryByText("用户需要使用选择句型做出选择")).toBeNull();
    });
  });

  it("reveals a completed task description after it is unlocked", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      text: "好呀，我先把面团放在这里。",
      updatedMissions: [
        {
          id: "general_task_A",
          type: "general",
          title: "一般任务 A",
          description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
          status: "已完成",
          justUnlocked: true,
          completed: true,
        },
        hiddenMissions[1],
        hiddenMissions[2],
      ],
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));
    await userEvent.type(screen.getByRole("textbox"), "把面团揉圆吧{enter}");

    await waitFor(() => {
      expect(screen.getByText("1/3")).toBeTruthy();
      expect(screen.getByText("你需要说出包含目标词的动宾短语：把面团揉圆")).toBeTruthy();
    });
  });

  it("shows a thumbs-up celebration when all three tasks are completed", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      text: "太好了，我们都完成了！",
      updatedMissions: [
        {
          id: "general_task_A",
          type: "general",
          title: "一般任务 A",
          description: "用户需要说出包含目标词的动宾短语：把面团揉圆",
          status: "已完成",
          justUnlocked: false,
          completed: true,
        },
        {
          id: "general_task_B",
          type: "general",
          title: "一般任务 B",
          description: "用户需要使用选择句型做出选择",
          status: "已完成",
          justUnlocked: false,
          completed: true,
        },
        {
          id: "challenge_task_C",
          type: "challenge",
          title: "挑战任务 C",
          description: "用户需提问引导NPC透露隐藏信息：最喜欢的月饼口味",
          status: "已完成",
          justUnlocked: true,
          completed: true,
        },
      ],
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));
    await userEvent.type(screen.getByRole("textbox"), "我们都完成了{enter}");

    await waitFor(() => {
      expect(screen.getByText("太棒了！")).toBeTruthy();
      expect(screen.getByText("三个隐藏任务都完成啦")).toBeTruthy();
      expect(screen.getByText("3/3")).toBeTruthy();
    });
  });

  it("lets people add a child profile with the required fields", async () => {
    render(<App />);

    await userEvent.click(screen.getByText("增加儿童"));

    await userEvent.type(screen.getByLabelText("姓名"), "Mia");
    await userEvent.selectOptions(screen.getByLabelText("年级"), "G3");
    await userEvent.type(screen.getByLabelText("第一语言"), "English");
    await userEvent.type(screen.getByLabelText("自定义"), "Loves cooking games");
    await userEvent.click(screen.getByText("保存档案"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Mia")).toBeTruthy();
    });
  });

  it("passes the edited child profile into report scene generation", async () => {
    vi.mocked(generateTargetedCharacter).mockResolvedValue({
      id: "targeted_1",
      name: "Moon Chef",
      roleTitle: "Guide",
      avatar: "🌙",
      description: "A guided scene.",
      tags: ["report"],
      initialMessage: "Hello there",
      missions: [],
      systemInstruction: "Guide the child.",
      voice: "Kore",
      studentId: "student_1",
      isCustom: false,
    });

    render(<App />);

    await userEvent.click(screen.getByText("编辑儿童档案"));

    const nameInput = screen.getByLabelText("姓名");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Harry");
    await userEvent.selectOptions(screen.getByLabelText("年级"), "G5");

    const languageInput = screen.getByLabelText("第一语言");
    await userEvent.clear(languageInput);
    await userEvent.type(languageInput, "Spanish");

    const customInput = screen.getByLabelText("自定义");
    await userEvent.clear(customInput);
    await userEvent.type(customInput, "Needs short prompts");

    await userEvent.click(screen.getByText("保存档案"));
    await userEvent.click(screen.getByText("生成报告推荐场景"));

    await waitFor(() => {
      expect(generateTargetedCharacter).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: "Updated Harry",
          info: expect.objectContaining({
            grade: "G5",
            firstLanguage: "Spanish",
            customField: "Needs short prompts",
          }),
        }),
      );
    });
  });

  it("deletes a custom scene card from the home screen", async () => {
    vi.mocked(generateCustomCharacter).mockResolvedValueOnce({
      id: "custom_1",
      name: "Treasure Guide",
      roleTitle: "Guide",
      avatar: "🗺️",
      description: "A custom card.",
      tags: ["custom"],
      initialMessage: "Hello there",
      missions: [],
      systemInstruction: "Guide the child.",
      voice: "Kore",
      studentId: "student_1",
      isCustom: true,
    });

    render(<App />);

    await userEvent.type(
      screen.getByPlaceholderText(
        /描述你想生成的场景|和小朋友一起在森林里找宝藏/i,
      ),
      "Treasure hunt",
    );
    await userEvent.click(screen.getByText(/生成新场景|生成场景/i));

    await waitFor(() => {
      expect(screen.getByText("Treasure Guide")).toBeTruthy();
    });

    await userEvent.click(screen.getByLabelText("删除场景卡片"));

    await waitFor(() => {
      expect(screen.queryByText("Treasure Guide")).toBeNull();
    });
  });

  it("renders avatar urls as images instead of plain text", async () => {
    const avatarUrl = "https://api.dicebear.com/7.x/bottts/svg?seed=bunny-hero";
    vi.mocked(generateCustomCharacter).mockResolvedValueOnce({
      id: "custom_2",
      name: "Bunny Hero",
      roleTitle: "Guide",
      avatar: avatarUrl,
      description: "A custom card with image avatar.",
      tags: ["custom"],
      initialMessage: "Hello there",
      missions: [],
      systemInstruction: "Guide the child.",
      voice: "Kore",
      studentId: "student_1",
      isCustom: true,
    });

    render(<App />);

    const customPromptField = screen.getByRole("textbox");
    await userEvent.type(customPromptField, "Bunny hero");
    const customSection = customPromptField.closest("section");
    const customGenerateButton = customSection?.querySelector("button:last-of-type") as HTMLButtonElement;
    await userEvent.click(customGenerateButton);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Bunny Hero avatar" })).toBeTruthy();
    });

    expect(screen.queryByText(avatarUrl)).toBeNull();

    await userEvent.click(screen.getByText("Bunny Hero"));

    await waitFor(() => {
      const avatars = screen.getAllByRole("img", { name: "Bunny Hero avatar" });
      expect(avatars.length).toBeGreaterThan(0);
    });
  });

  it("opens and closes a mobile mission drawer", async () => {
    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    const openDrawerButton = await screen.findByLabelText("打开任务抽屉");
    await userEvent.click(openDrawerButton);

    const missionDrawer = screen.getByLabelText("移动端任务抽屉");
    expect(missionDrawer).toBeTruthy();
    expect(within(missionDrawer).getByText(/已揭晓\s*0\/3/)).toBeTruthy();
    expect(
      within(missionDrawer).queryByText("你需要说出包含目标词的动宾短语：把面团揉圆"),
    ).toBeNull();

    await userEvent.click(within(missionDrawer).getByLabelText("关闭任务抽屉"));

    await waitFor(() => {
      expect(screen.queryByLabelText("移动端任务抽屉")).toBeNull();
    });
  });

  it("shows loading on the mission button while missions are being generated", async () => {
    let resolveRefresh: ((value: { greeting: string; missions: typeof hiddenMissions }) => void) | null = null;
    vi.mocked(refreshMissions).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve as typeof resolveRefresh;
        }) as Promise<{ greeting: string; missions: typeof hiddenMissions }>,
    );

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    expect(await screen.findByText("生成中")).toBeTruthy();

    resolveRefresh?.({
      greeting: "Fresh greeting from the guide",
      missions: hiddenMissions,
    });

    await waitFor(() => {
      expect(screen.queryByText("生成中")).toBeNull();
      expect(screen.getAllByText("0/3").length).toBeGreaterThan(0);
    });
  });

  it("shows a bottom-centered mobile voice button in the chat view", async () => {
    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    const voiceButton = await screen.findByLabelText("toggle-voice-input");
    expect(voiceButton).toBeTruthy();
    expect(voiceButton.className).toContain("fixed");
  });

  it("moves the mobile voice button upward when the keyboard is open", async () => {
    const listeners: Record<string, () => void> = {};
    const viewport = {
      width: 390,
      height: 844,
      offsetTop: 0,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        listeners[event] = handler;
      }),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: viewport,
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    const voiceButton = await screen.findByLabelText("toggle-voice-input");
    expect((voiceButton as HTMLButtonElement).style.bottom).toBe("16px");

    viewport.height = 520;
    listeners.resize?.();

    await waitFor(() => {
      expect((voiceButton as HTMLButtonElement).style.bottom).toBe("340px");
    });
  });
});
