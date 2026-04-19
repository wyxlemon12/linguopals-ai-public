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
      missions: [],
    },
  ],
  generateCustomCharacter: vi.fn(),
  generateTargetedCharacter: vi.fn(),
  refreshMissions: vi.fn().mockResolvedValue({
    missions: [],
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
      missions: [],
      greeting:
        "哈利你好呀！我是超能面点大侠！欢迎来到亮晶晶的月亮厨房，哇，这里到处都是香喷喷的味道，我正准备做圆圆的月饼呢！你看，案板上有很多好玩的东西，快快进来，跟我一起当小小面点师吧！",
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    await waitFor(() => {
      expect(screen.getByText("哈利你好呀！我是超能面点大侠！你想先说你看到什么吗？")).toBeTruthy();
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

  it("plays the standard spoken model sentence independently", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      text: "[对话内容]你好呀[标准示范]我想做月饼。[思考时刻]你想放什么馅？",
      updatedMissions: [],
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    vi.mocked(textToSpeech).mockClear();
    await userEvent.type(screen.getByRole("textbox"), "我也想做{enter}");

    const modelAudioButton = await screen.findByLabelText("播放标准普通话表达");
    await userEvent.click(modelAudioButton);

    await waitFor(() => {
      expect(textToSpeech).toHaveBeenCalledWith("我想做月饼。", "Charon");
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
      avatar: "🌕",
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

  it("shows mission text as information the child should ask about", async () => {
    vi.mocked(refreshMissions).mockResolvedValueOnce({
      greeting: "Fresh greeting from the guide",
      missions: [
        {
          id: "m1",
          title: "月饼口味",
          description: "说说你想做什么口味的月饼。",
          completed: false,
        },
      ],
    });

    render(<App />);
    await userEvent.click(screen.getByText(/Zhu Rong/));

    await waitFor(() => {
      expect(screen.getByText("问问我想做什么口味的月饼。")).toBeTruthy();
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
      screen.getByPlaceholderText(/森林里找宝藏|和小朋友一起在森林里找宝藏|描述你想生成的场景/i),
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
    vi.mocked(refreshMissions).mockResolvedValueOnce({
      greeting: "Fresh greeting from the guide",
      missions: [
        {
          id: "m1",
          title: "链堥ゼ鍙ｅ懗",
          description: "璇磋浣犳兂鍋氫粈涔堝彛鍛崇殑鏈堥ゼ銆?",
          completed: false,
        },
      ],
    });

    render(<App />);

    await userEvent.click(screen.getByText(/Zhu Rong/));

    const openDrawerButton = await screen.findByLabelText("打开任务抽屉");
    await userEvent.click(openDrawerButton);

    const missionDrawer = screen.getByLabelText("移动端任务抽屉");
    expect(missionDrawer).toBeTruthy();
    expect(within(missionDrawer).getByText("链堥ゼ鍙ｅ懗")).toBeTruthy();

    await userEvent.click(within(missionDrawer).getByLabelText("关闭任务抽屉"));

    await waitFor(() => {
      expect(screen.queryByLabelText("移动端任务抽屉")).toBeNull();
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
