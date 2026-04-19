import React from "react";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Loader2,
  Plus,
  Save,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  User,
  UserPlus,
  Volume2,
} from "lucide-react";
import {
  CHARACTERS,
  Character,
  ChatMessage,
  Mission,
  Student,
  StudentInfo,
  generateCustomCharacter,
  generateTargetedCharacter,
  refreshMissions,
  sendMessage,
  textToSpeech,
  toTraditional,
} from "./services/geminiService";

const DEFAULT_REPORT =
  "[活动场景]：中秋扮演游戏\n[情绪分析]：哈利词汇量有限，经常使用单字句。\n[需要跟进]：多引导孩子用完整词组回答。";

const DEFAULT_STUDENTS: Student[] = [
  {
    id: "student_1",
    name: "哈利 (Harry)",
    info: {
      firstLanguage: "中文",
      enrollmentDate: "2024-03-12",
      grade: "幼儿园大班",
      customField: "活泼好动，喜欢超级英雄。",
    },
    report: DEFAULT_REPORT,
  },
  {
    id: "student_2",
    name: "子慧 (Zi Hui)",
    info: {
      firstLanguage: "中文",
      enrollmentDate: "2024-04-01",
      grade: "幼儿园中班",
      customField: "性格偏内向，观察力强。",
    },
    report: "",
  },
];

const createDefaultStudentInfo = (): StudentInfo => ({
  firstLanguage: "中文",
  enrollmentDate: new Date().toISOString().split("T")[0],
  grade: "Pre-K",
  customField: "",
});

const GRADE_OPTIONS = [
  "Pre-K",
  "K",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
  "G12",
];

const parseAIResponse = (text: string) => {
  const parts = {
    content: "",
    model: "",
    thought: "",
    answer: "",
  };

  const contentMatch = text.match(/\[(?:对话内容|.*?的话)\]\s*[：:]?\s*([\s\S]*?)(?=\[|$)/);
  const modelMatch = text.match(/\[(?:标准示范|改写原句)\]\s*[：:]?\s*([\s\S]*?)(?=\[|$)/);
  const thoughtMatch = text.match(/\[(?:思考时刻|启发追问)\]\s*[：:]?\s*([\s\S]*?)(?=\[|$)/);
  const answerMatch = text.match(/\[(?:挑战参考|参考答案)\]\s*[：:]?\s*([\s\S]*?)(?=\[|$)/);

  if (contentMatch) {
    parts.content = contentMatch[1].trim();
  } else {
    const firstBracket = text.indexOf("[");
    parts.content = firstBracket === -1 ? text.trim() : text.slice(0, firstBracket).trim();
  }

  parts.model = modelMatch ? modelMatch[1].trim() : "";
  parts.thought = thoughtMatch ? thoughtMatch[1].trim() : "";
  parts.answer = answerMatch ? answerMatch[1].trim() : "";

  return parts;
};

const ensureSentenceEnding = (text: string, ending: string) => {
  if (!text) return "";
  const hasEnding = [".", "!", "?", "。", "！", "？"].some((mark) => text.endsWith(mark));
  return hasEnding ? text : text + ending;
};

const simplifyGreetingForConversation = (text: string) => {
  if (!text.trim()) return text;

  const segments = text
    .split(/(?<=[。！？!?])/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return text.trim();
  }

  const intro = ensureSentenceEnding(segments[0], "！");
  const roleLine =
    segments.find(
      (segment, index) =>
        index > 0 && (segment.includes("我是") || segment.includes("我叫")),
    ) ?? segments[1] ?? "";

  const questionSegment = segments.find((segment) => /[?？]/.test(segment));
  const simpleQuestion =
    questionSegment && questionSegment.replace(/\s+/g, "").length <= 18
      ? ensureSentenceEnding(questionSegment, "？")
      : "你想先说你看到什么吗？";

  const finalParts = [intro];
  if (roleLine && roleLine !== intro) {
    finalParts.push(ensureSentenceEnding(roleLine, "！"));
  }
  finalParts.push(simpleQuestion);

  return finalParts.join("");
};

const formatMissionPrompt = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return normalized;
  if (normalized.startsWith("问")) return normalized;

  const mappings: Array<[string, string]> = [
    ["说一说", "问问"],
    ["讲一讲", "问问"],
    ["说说", "问问"],
    ["讲讲", "问问"],
    ["学一学", "问问"],
    ["找找", "问问"],
    ["看看", "问问"],
    ["试试", "问问"],
  ];

  for (const [from, to] of mappings) {
    if (normalized.startsWith(from)) {
      const replaced = `${to}${normalized.slice(from.length)}`;
      return replaced.replace(/^问问你/, "问问我");
    }
  }

  if (normalized.startsWith("去")) {
    return `问问${normalized.slice(1)}`;
  }

  return normalized;
};

const isAvatarUrl = (avatar: string) => /^https?:\/\//i.test(avatar);

const renderAvatar = (
  avatar: string,
  alt: string,
  textClassName: string,
  imageClassName: string,
) => {
  if (isAvatarUrl(avatar)) {
    return <img src={avatar} alt={alt} className={imageClassName} />;
  }

  return <span className={textClassName}>{avatar}</span>;
};

const mergeCharacters = (savedCharacters: Character[]) => {
  const baseIds = CHARACTERS.map((character) => character.id);
  const customCharacters = savedCharacters.filter((character) => !baseIds.includes(character.id));
  return [...customCharacters, ...CHARACTERS];
};

export default function App() {
  const [characters, setCharacters] = React.useState<Character[]>(() => {
    const saved = localStorage.getItem("linguopal_characters");
    if (!saved) return CHARACTERS;

    try {
      return mergeCharacters(JSON.parse(saved));
    } catch {
      return CHARACTERS;
    }
  });
  const [students, setStudents] = React.useState<Student[]>(() => {
    const saved = localStorage.getItem("linguopal_students");
    if (!saved) return DEFAULT_STUDENTS;

    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_STUDENTS;
    }
  });
  const [activeStudentId, setActiveStudentId] = React.useState<string>(
    () => localStorage.getItem("linguopal_active_student") || DEFAULT_STUDENTS[0].id,
  );
  const [selectedCharacter, setSelectedCharacter] = React.useState<Character | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [missions, setMissions] = React.useState<Mission[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [editingReport, setEditingReport] = React.useState("");
  const [showReportInput, setShowReportInput] = React.useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = React.useState(false);
  const [studentModalMode, setStudentModalMode] = React.useState<"add" | "edit">("add");
  const [studentDraft, setStudentDraft] = React.useState<{
    name: string;
    info: StudentInfo;
  }>({
    name: "",
    info: createDefaultStudentInfo(),
  });
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isGeneratingTargeted, setIsGeneratingTargeted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isRefreshingMissions, setIsRefreshingMissions] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<{ type: "error" | "info"; text: string } | null>(
    null,
  );

  const activeStudent =
    students.find((student) => student.id === activeStudentId) ?? students[0] ?? DEFAULT_STUDENTS[0];

  const filteredCharacters = characters.filter(
    (character) => !character.studentId || character.studentId === activeStudent.id,
  );

  React.useEffect(() => {
    localStorage.setItem("linguopal_students", JSON.stringify(students));
  }, [students]);

  React.useEffect(() => {
    localStorage.setItem("linguopal_characters", JSON.stringify(characters));
  }, [characters]);

  React.useEffect(() => {
    localStorage.setItem("linguopal_active_student", activeStudentId);
  }, [activeStudentId]);

  React.useEffect(() => {
    setEditingReport(activeStudent.report || "");
  }, [activeStudent.id, activeStudent.report]);

  const updateStatus = (type: "error" | "info", text: string) => {
    setStatusMsg({ type, text });
    window.setTimeout(() => setStatusMsg(null), 3000);
  };

  const openStudentModal = (mode: "add" | "edit") => {
    setStudentModalMode(mode);
    setStudentDraft(
      mode === "edit"
        ? {
            name: activeStudent.name,
            info: { ...activeStudent.info },
          }
        : {
            name: "",
            info: createDefaultStudentInfo(),
          },
    );
    setIsStudentModalOpen(true);
  };

  const handleStudentDraftChange = (field: keyof StudentInfo, value: string) => {
    setStudentDraft((previous) => ({
      ...previous,
      info: {
        ...previous.info,
        [field]: value,
      },
    }));
  };

  const handleSaveStudentProfile = () => {
    const normalizedName = studentDraft.name.trim() || "新儿童";

    if (studentModalMode === "add") {
      const newStudent: Student = {
        id: `student_${Date.now()}`,
        name: normalizedName,
        info: { ...studentDraft.info },
        report: "",
      };

      setStudents((previous) => [...previous, newStudent]);
      setActiveStudentId(newStudent.id);
      setEditingReport("");
      updateStatus("info", "儿童档案已创建。");
    } else {
      setStudents((previous) =>
        previous.map((student) =>
          student.id === activeStudent.id
            ? {
                ...student,
                name: normalizedName,
                info: { ...studentDraft.info },
              }
            : student,
        ),
      );
      updateStatus("info", "儿童档案已更新。");
    }

    setIsStudentModalOpen(false);
  };

  const handleSaveReport = () => {
    setStudents((previous) =>
      previous.map((student) =>
        student.id === activeStudent.id ? { ...student, report: editingReport } : student,
      ),
    );
    setShowReportInput(false);
    updateStatus("info", "成长报告已保存。");
  };

  const playAudio = async (text: string, voice?: Character["voice"]) => {
    const chosenVoice = voice ?? selectedCharacter?.voice;
    if (!text || !chosenVoice) return;

    setIsPlaying(true);
    try {
      const audioData = await textToSpeech(text, chosenVoice);
      if (audioData) {
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        await audio.play();
        return;
      }
    } catch {
      // Fall through to browser TTS when remote audio is unavailable.
    }

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSelectCharacter = async (character: Character) => {
    const initialGreeting = simplifyGreetingForConversation(character.initialMessage);
    setSelectedCharacter(character);
    setMessages([{ role: "model", text: initialGreeting }]);
    setIsRefreshingMissions(true);

    try {
      const { missions: freshMissions, greeting } = await refreshMissions(character, activeStudent.report);
      const conciseGreeting = simplifyGreetingForConversation(greeting);

      setMissions(freshMissions);
      setMessages([{ role: "model", text: conciseGreeting }]);
      await playAudio(conciseGreeting, character.voice);
    } catch {
      setMissions(character.missions || []);
      updateStatus("error", "场景准备失败了，先用默认任务继续。");
    } finally {
      setIsRefreshingMissions(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!customPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const newCharacter = await generateCustomCharacter(customPrompt, activeStudent);
      setCharacters((previous) => [newCharacter, ...previous]);
      setCustomPrompt("");
      updateStatus("info", "新场景已生成。");
    } catch {
      updateStatus("error", "自定义场景生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTargeted = async () => {
    if (!activeStudent.report.trim() || isGeneratingTargeted) return;

    setIsGeneratingTargeted(true);
    try {
      const newCharacter = await generateTargetedCharacter(activeStudent.report, activeStudent);
      setCharacters((previous) => [newCharacter, ...previous]);
      updateStatus("info", "报告推荐场景已生成。");
    } catch (error: any) {
      updateStatus("error", error?.message || "报告推荐场景生成失败。");
    } finally {
      setIsGeneratingTargeted(false);
    }
  };

  const handleDeleteCharacter = (characterId: string) => {
    setCharacters((previous) => previous.filter((character) => character.id !== characterId));
    updateStatus("info", "场景卡片已删除。");
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedCharacter || isLoading) return;

    const userMessage: ChatMessage = { role: "user", text: inputValue.trim() };
    const newMessages = [...messages, userMessage];

    setInputValue("");
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await sendMessage(
        selectedCharacter.id,
        newMessages,
        missions,
        activeStudent.report,
        selectedCharacter.systemInstruction,
        activeStudent,
      );

      setMessages([...newMessages, { role: "model", text: response.text }]);
      setMissions(response.updatedMissions);

      const parsed = parseAIResponse(response.text);
      if (parsed.content) {
        playAudio(parsed.content);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "model", text: "刚才出了点小问题，你可以再试一次吗？" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedCharacter(null);
    setMessages([]);
    setMissions([]);
  };

  if (!selectedCharacter) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-6 md:p-10">
        {statusMsg && (
          <div
            className={`fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-medium shadow-lg ${
              statusMsg.type === "error"
                ? "border-red-100 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="mx-auto max-w-6xl space-y-8">
          {isStudentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-6 backdrop-blur-sm">
              <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">
                      {studentModalMode === "add" ? "增加儿童" : "编辑儿童档案"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      这些字段会作为参考信息注入报告推荐场景和相关分析提示词。
                    </p>
                  </div>
                  <button
                    onClick={() => setIsStudentModalOpen(false)}
                    className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600"
                  >
                    关闭
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-slate-700">
                    <span>姓名</span>
                    <input
                      value={studentDraft.name}
                      onChange={(event) =>
                        setStudentDraft((previous) => ({ ...previous, name: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300"
                      placeholder="例如：Mia"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-slate-700">
                    <span>年级</span>
                    <select
                      value={studentDraft.info.grade}
                      onChange={(event) => handleStudentDraftChange("grade", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300"
                    >
                      {GRADE_OPTIONS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-slate-700">
                    <span>入学时间</span>
                    <input
                      type="date"
                      value={studentDraft.info.enrollmentDate}
                      onChange={(event) =>
                        handleStudentDraftChange("enrollmentDate", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-slate-700">
                    <span>第一语言</span>
                    <input
                      value={studentDraft.info.firstLanguage}
                      onChange={(event) =>
                        handleStudentDraftChange("firstLanguage", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300"
                      placeholder="例如：English"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">
                    <span>自定义</span>
                    <textarea
                      value={studentDraft.info.customField}
                      onChange={(event) =>
                        handleStudentDraftChange("customField", event.target.value)
                      }
                      className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-300"
                      placeholder="补充性格、兴趣、注意事项等。"
                    />
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setIsStudentModalOpen(false)}
                    className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-600"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveStudentProfile}
                    className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white"
                  >
                    保存档案
                  </button>
                </div>
              </div>
            </div>
          )}

          <header className="flex flex-col gap-4 rounded-[32px] bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-[var(--color-primary)] p-3 text-white">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h1 className="text-4xl font-black">LinguoPals AI</h1>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  为 {toTraditional(activeStudent.name)} 准备更会引导孩子开口的互动场景。
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--color-bg)] p-3">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  当前学员
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    value={activeStudentId}
                    onChange={(event) => setActiveStudentId(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700"
                  >
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openStudentModal("add")}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      <UserPlus className="h-4 w-4" />
                      增加儿童
                    </button>
                    <button
                      onClick={() => openStudentModal("edit")}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
                    >
                      <Settings2 className="h-4 w-4" />
                      编辑儿童档案
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="rounded-[32px] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-blue-700">
                <Target className="h-5 w-5" />
                <h2 className="text-xl font-bold">成长报告</h2>
              </div>

              {showReportInput ? (
                <div className="space-y-3">
                  <textarea
                    value={editingReport}
                    onChange={(event) => setEditingReport(event.target.value)}
                    className="min-h-[220px] w-full rounded-3xl border border-blue-100 bg-blue-50/40 p-4 text-sm outline-none focus:border-blue-300"
                    placeholder="填入课堂观察、薄弱点或需要重点跟进的方向..."
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowReportInput(false)}
                      className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-500"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveReport}
                      className="flex-[2] rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        保存并更新
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowReportInput(true)}
                    className="w-full rounded-3xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-left"
                  >
                    {activeStudent.report ? (
                      <p className="whitespace-pre-wrap text-sm leading-7 text-blue-900/80">
                        {toTraditional(activeStudent.report)}
                      </p>
                    ) : (
                      <div className="space-y-2 text-center text-sm text-blue-500/70">
                        <p>点击填写成长报告。</p>
                        <p>AI 会根据报告内容推荐更合适的场景。</p>
                      </div>
                    )}
                  </button>

                  {activeStudent.report && (
                    <button
                      onClick={handleCreateTargeted}
                      disabled={isGeneratingTargeted}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-4 font-bold text-white"
                    >
                      <span className="inline-flex items-center gap-2">
                        {isGeneratingTargeted ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                        生成报告推荐场景
                      </span>
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-[32px] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-orange-600">
                <Plus className="h-5 w-5" />
                <h2 className="text-xl font-bold">自定义场景</h2>
              </div>

              <div className="space-y-4">
                <textarea
                  value={customPrompt}
                  onChange={(event) => setCustomPrompt(event.target.value)}
                  className="min-h-[220px] w-full rounded-3xl border border-orange-100 bg-orange-50/40 p-4 text-sm outline-none focus:border-orange-300"
                  placeholder="描述你想生成的场景，例如：和小朋友一起在森林里找宝藏。"
                />
                <button
                  onClick={handleCreateCustom}
                  disabled={!customPrompt.trim() || isGenerating}
                  className="w-full rounded-2xl bg-orange-500 px-4 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    生成新场景
                  </span>
                </button>
              </div>
            </section>
          </div>

          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredCharacters.map((character) => (
              <div
                key={character.id}
                onClick={() => handleSelectCharacter(character)}
                onKeyDown={(event) => event.key === "Enter" && handleSelectCharacter(character)}
                tabIndex={0}
                role="button"
                className="group relative rounded-[32px] border border-white bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                {(character.id.startsWith("custom_") || character.id.startsWith("targeted_")) && (
                  <button
                    aria-label="删除场景卡片"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteCharacter(character.id);
                    }}
                    className="absolute left-4 top-4 rounded-full bg-red-50 p-2 text-red-500 opacity-0 transition-opacity hover:bg-red-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-50">
                  {renderAvatar(
                    character.avatar,
                    `${character.name} avatar`,
                    "text-5xl",
                    "h-full w-full object-cover",
                  )}
                </div>
                <h3 className="mt-4 text-2xl font-black">{toTraditional(character.name)}</h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-[var(--color-primary)]">
                  {toTraditional(character.roleTitle)}
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
                  {toTraditional(character.description)}
                </p>
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#F8FAFC] text-[var(--color-text)]">
      {statusMsg && (
        <div
          className={`fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-medium shadow-lg ${
            statusMsg.type === "error"
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-blue-100 bg-blue-50 text-blue-700"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="rounded-2xl p-3 transition hover:bg-[var(--color-bg)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-50">
              {renderAvatar(
                selectedCharacter.avatar,
                `${selectedCharacter.name} avatar`,
                "text-3xl",
                "h-full w-full object-cover",
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{toTraditional(selectedCharacter.name)}</h2>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-600">
                {toTraditional(selectedCharacter.roleTitle)}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-2xl bg-[var(--color-bg)] px-4 py-2 md:flex">
          <User className="h-4 w-4 text-blue-600" />
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-muted)]">
              当前学员
            </p>
            <p className="text-sm font-bold text-blue-900">{toTraditional(activeStudent.name)}</p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 overflow-y-auto border-r border-gray-100 bg-white p-6 lg:block">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-muted)]">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            探险小任务
          </div>

          <div className="mt-4 space-y-3">
            {missions.map((mission) => (
              <div key={mission.id} className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-bold text-[var(--color-text)]">
                  {toTraditional(mission.title)}
                </p>
                <p className="mt-2 text-xs leading-6 text-[var(--color-muted)]">
                  {toTraditional(formatMissionPrompt(mission.description))}
                </p>
              </div>
            ))}

            {isRefreshingMissions && (
              <div className="flex items-center gap-3 rounded-3xl border border-dashed border-blue-100 bg-blue-50/40 p-4 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在准备场景任务...
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {messages.map((message, index) => {
              const parsed =
                message.role === "model"
                  ? parseAIResponse(message.text)
                  : { content: message.text, model: "", thought: "", answer: "" };

              return (
                <div
                  key={index}
                  className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl ${
                      message.role === "user"
                        ? "bg-[var(--color-primary)] text-white"
                        : "border border-gray-100 bg-white"
                    }`}
                  >
                    {message.role === "user"
                      ? "👦"
                      : renderAvatar(
                          selectedCharacter.avatar,
                          `${selectedCharacter.name} avatar`,
                          "text-xl",
                          "h-full w-full object-cover",
                        )}
                  </div>

                  <div className={`max-w-[80%] space-y-3 ${message.role === "user" ? "text-right" : ""}`}>
                    {message.role === "model" && parsed.content && (
                      <div className="rounded-3xl rounded-tl-none border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-base leading-8 text-[var(--color-text)]">
                            {toTraditional(parsed.content)}
                          </p>
                          <button
                            onClick={() => playAudio(parsed.content)}
                            disabled={isPlaying}
                            className={`shrink-0 rounded-2xl p-3 ${
                              isPlaying
                                ? "bg-blue-500 text-white"
                                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            }`}
                          >
                            <Volume2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {message.role === "user" && (
                      <div className="rounded-3xl rounded-tr-none bg-[var(--color-primary)] p-4 text-white shadow-sm">
                        {message.text}
                      </div>
                    )}

                    {message.role === "model" && (parsed.model || parsed.thought) && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {parsed.model && (
                          <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-green-700">
                                <BookOpen className="h-3 w-3" />
                                标准普通话表达
                              </div>
                              <button
                                aria-label="播放标准普通话表达"
                                onClick={() => playAudio(parsed.model)}
                                disabled={isPlaying}
                                className={`rounded-xl p-2 ${
                                  isPlaying
                                    ? "bg-green-500 text-white"
                                    : "bg-white text-green-600 hover:bg-green-100"
                                }`}
                              >
                                <Volume2 className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="text-sm font-medium italic text-green-900">
                              {toTraditional(parsed.model)}
                            </p>
                          </div>
                        )}

                        {parsed.thought && (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">
                              <BrainCircuit className="h-3 w-3" />
                              思考时刻
                            </div>
                            <p className="text-sm font-medium text-blue-900">
                              {toTraditional(parsed.thought)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {message.role === "model" && parsed.answer && (
                      <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700">
                          <Trophy className="h-3 w-3" />
                          挑战参考
                        </div>
                        <p className="text-sm font-medium text-purple-900">
                          {toTraditional(parsed.answer)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-4">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-white text-xl">
                  {renderAvatar(
                    selectedCharacter.avatar,
                    `${selectedCharacter.name} avatar`,
                    "text-xl",
                    "h-full w-full object-cover",
                  )}
                </div>
                <div className="rounded-3xl rounded-tl-none border border-gray-100 bg-white px-5 py-4 shadow-sm">
                  <div className="flex gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-300" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-white p-6">
            <div className="mx-auto flex max-w-4xl items-center gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
                  placeholder="在这里回复伙伴..."
                  className="h-16 w-full rounded-3xl bg-[var(--color-bg)] pl-6 pr-16 text-lg font-medium outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10"
                />
                <button
                  onClick={handleSendMessage}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
