import { GoogleGenAI, Modality, Type } from "@google/genai";

type VoiceName = "Kore" | "Puck" | "Charon";
type MissionType = "general" | "challenge";
type MissionStatus = "未完成" | "已完成";
type CSLTaskKey = "general_task_A" | "general_task_B" | "challenge_task_C";

type Mission = {
  id: CSLTaskKey;
  type: MissionType;
  title: string;
  description: string;
  status: MissionStatus;
  justUnlocked: boolean;
  completed: boolean;
};

type CSLTaskState = {
  description: string;
  status: MissionStatus;
  just_unlocked: boolean;
};

type CSLTurnResponse = {
  tasks: Record<CSLTaskKey, CSLTaskState>;
  npc_reply: string;
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const TASK_CONFIG: Array<{
  key: CSLTaskKey;
  title: string;
  type: MissionType;
  defaultDescription: string;
}> = [
  {
    key: "general_task_A",
    title: "一般任务 A",
    type: "general",
    defaultDescription: "用户需要说出包含目标词的完整短句或动宾结构。",
  },
  {
    key: "general_task_B",
    title: "一般任务 B",
    type: "general",
    defaultDescription: "用户需要说出目标交际功能句型。",
  },
  {
    key: "challenge_task_C",
    title: "挑战任务 C",
    type: "challenge",
    defaultDescription: "用户需提问引导NPC自然说出目标词语或关键信息。",
  },
];

const CSL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.OBJECT,
      properties: {
        general_task_A: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            status: { type: Type.STRING },
            just_unlocked: { type: Type.BOOLEAN },
          },
          required: ["description", "status", "just_unlocked"],
        },
        general_task_B: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            status: { type: Type.STRING },
            just_unlocked: { type: Type.BOOLEAN },
          },
          required: ["description", "status", "just_unlocked"],
        },
        challenge_task_C: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            status: { type: Type.STRING },
            just_unlocked: { type: Type.BOOLEAN },
          },
          required: ["description", "status", "just_unlocked"],
        },
      },
      required: ["general_task_A", "general_task_B", "challenge_task_C"],
    },
    npc_reply: { type: Type.STRING },
  },
  required: ["tasks", "npc_reply"],
} as const;

const CSL_CORE_PROMPT = `# Role: 中文场景对话智能体 (CSL Scenario Dialogue Agent)

## Profile
你是一个专门为中文作为第二外语（CSL）的学习者设计的语音交互智能体。你具备双重身份：
1. **前台扮演者 (NPC)**：在特定的生活/工作场景中扮演对应的角色，与用户进行极其自然、符合身份的中文语音对话。
2. **后台裁判 (System)**：静默分析用户的语言弱点，生成学习任务，并实时判定用户的任务完成情况。

## Input Variables (每次会话初始化时输入)
- **用户信息**：[用户的中文等级、口语习惯等，例如：词汇量有限、习惯说双字句等]
- **语言薄弱环节**：[例如：需要多练习动宾短语、需要使用完整句型表达意愿等]
- **当前设定场景**：[例如：中秋节一起做月饼]
- **AI扮演角色**：[例如：热情耐心的中国朋友]

## Rules & Constraints (核心规则)

### 1. 任务生成规则 (仅在初始化时执行一次)
根据输入的[语言薄弱环节]和[当前设定场景]，隐蔽地生成3个“神秘隐藏任务”：
- **一般性任务 A** (判定标准：用户说出包含特定词汇的**完整短句或动宾结构**，例如“把面团揉圆”，而不是只说“面团”)
- **一般性任务 B** (判定标准：用户说出特定的**交际功能句型**，如提出建议、做出选择等)
- **挑战性任务 C** (判定标准：用户通过合理的提问或引导，促使**AI角色（你）**在对话中说出特定的目标词语或关键信息。考验用户的会话引导能力。)

### 2. 角色行为规则 (绝对不妥协的底线)
- **身份隔离**：前台扮演者（NPC）绝对不知道任何关于“任务”的信息。必须等用户用正确的逻辑引导或提问后，NPC才自然地回答出目标信息。
- **打破“填空式”对话 (核心技巧)**：绝对不要问只能回答“好/不好”或单个名词的封闭式问题（如“拿这个好吗？”“这个叫什么？”）。必须多用**选择疑问句**或**求助式提问**，逼迫用户说出完整的短句。例如：“你想帮我揉面团，还是想帮我包豆沙？”
- **放声思考与句型示范 (针对低词汇量用户)**：NPC要自言自语，把动作的完整句子说出来作为示范，再把话语权交给用户。例如：“我先把豆沙包进面团里...哎呀，下一步我忘了，你能用完整的话告诉我，接下来该怎么处理这个木头模具吗？”
- **容错与推进**：如果用户语法有轻微错误但不影响理解，正常接话；如果用户只回答了一两个字，NPC要装作没听懂或者要求确认，引导他说完整（例如：“‘压’？你是说让我把面团压进模具里吗？你完整告诉我一遍，我照做。”）。

### 3. 任务判定规则 (后台实时执行)
- LLM需要在每一轮对话后，重新评估3个任务的状态（\`未完成\` / \`已完成\`）。
- 只有当用户输出了符合要求的短句/句型，或成功引导NPC说出目标信息时，才将状态改为\`已完成\`。
- **惊喜触发机制**：在任务状态由“未完成”转变为“已完成”的那一轮交互中，需将该任务的 \`just_unlocked\` 字段设为 \`true\`，以便前端系统捕获并触发UI特效。

## Workflow (交互流程)

**Step 1: 初始化 (Initialization)**
当接收到用户的Input Variables后，生成3个任务，并以NPC身份给出**符合场景的开场白**。
输出格式严格遵循下方的JSON格式。

**Step 2: 循环对话 (Conversation Loop)**
接收用户的语音识别文本。
- 后台：根据用户的文本，以及你要回复的文本，判定3个任务的状态与解锁情况。
- 前台：生成NPC的自然回复。
输出格式严格遵循下方的JSON格式。

## Output Format (严格的JSON输出)

请在每轮交互中，**仅输出**以下JSON格式数据，不要有任何Markdown代码块包装，不要输出其他多余文字，以便前端解析：

{
  "tasks": {
    "general_task_A": {
      "description": "任务描述，例如：用户需要说出包含目标词的动宾短语",
      "status": "未完成/已完成",
      "just_unlocked": false
    },
    "general_task_B": {
      "description": "任务描述，例如：用户需要使用选择或建议句型",
      "status": "未完成/已完成",
      "just_unlocked": false
    },
    "challenge_task_C": {
      "description": "任务描述，例如：用户需提问引导NPC透露隐藏信息",
      "status": "未完成/已完成",
      "just_unlocked": false
    }
  },
  "npc_reply": "这里是AI扮演角色的自然回复，内容绝对不包含对任务的提示，完全沉浸在剧情中。"
}`;

const ensureConfigured = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }
};

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> => {
  ensureConfigured();

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || "";
      const retryable =
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        error?.status === 429 ||
        error?.code === 429;

      if (!retryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

const parseJsonText = <T>(text: string | undefined, fallback: T): T => {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const normalizeStatus = (status: unknown): MissionStatus =>
  status === "已完成" ? "已完成" : "未完成";

const buildUserInfo = (student?: any) => {
  if (!student) {
    return "暂无具体学生档案，请根据当前对话自然推进。";
  }

  const parts = [
    `姓名：${student.name || "未知"}`,
    `中文等级/年级：${student.info?.grade || "未知"}`,
    `第一语言：${student.info?.firstLanguage || "未知"}`,
  ];

  if (student.info?.customField) {
    parts.push(`口语习惯与补充画像：${student.info.customField}`);
  }

  return parts.join("；");
};

const buildWeaknesses = (childReport?: string, student?: any) => {
  const weaknesses: string[] = [];

  if (childReport?.trim()) {
    weaknesses.push(childReport.trim());
  }

  if (student?.info?.customField?.trim()) {
    weaknesses.push(`补充备注：${student.info.customField.trim()}`);
  }

  return weaknesses.join("\n") || "需要继续提升完整句表达、动宾结构表达与自然会话引导能力。";
};

const buildScene = (character: any) => {
  const tags = Array.isArray(character?.tags) && character.tags.length > 0
    ? `标签：${character.tags.join("、")}`
    : "";
  return [character?.description, tags].filter(Boolean).join("；") || "日常中文口语练习场景。";
};

const buildRole = (character: any, customInstruction?: string) => {
  const parts = [
    character?.name ? `角色名：${character.name}` : "",
    character?.roleTitle ? `角色身份：${character.roleTitle}` : "",
    customInstruction ? `角色补充要求：${customInstruction}` : "",
    "请保持角色沉浸感，但同时具备耐心、鼓励、会推动对话的老师气质。",
  ].filter(Boolean);

  return parts.join("；");
};

const buildConversationHistory = (history: any[]) =>
  history
    .map((message) => {
      const speaker = message.role === "model" ? "NPC" : "用户";
      return `${speaker}：${message.text}`;
    })
    .join("\n");

const createDefaultTaskState = (description: string): CSLTaskState => ({
  description,
  status: "未完成",
  just_unlocked: false,
});

const defaultCSLTurnResponse = (): CSLTurnResponse => ({
  tasks: {
    general_task_A: createDefaultTaskState(TASK_CONFIG[0].defaultDescription),
    general_task_B: createDefaultTaskState(TASK_CONFIG[1].defaultDescription),
    challenge_task_C: createDefaultTaskState(TASK_CONFIG[2].defaultDescription),
  },
  npc_reply: "你好呀！你想先说说你看到什么吗？",
});

const missionsToTaskStateMap = (missions: Mission[]): Record<CSLTaskKey, CSLTaskState> => {
  const byId = new Map(missions.map((mission) => [mission.id, mission]));

  return TASK_CONFIG.reduce(
    (accumulator, config) => {
      const mission = byId.get(config.key);
      accumulator[config.key] = {
        description: mission?.description || config.defaultDescription,
        status: mission?.status || "未完成",
        just_unlocked: false,
      };
      return accumulator;
    },
    {} as Record<CSLTaskKey, CSLTaskState>,
  );
};

const translateTasksToMissions = (
  tasks: Record<CSLTaskKey, CSLTaskState>,
  previousMissions: Mission[] = [],
) => {
  const previousById = new Map(previousMissions.map((mission) => [mission.id, mission]));

  return TASK_CONFIG.map((config) => {
    const task = tasks[config.key] || createDefaultTaskState(config.defaultDescription);
    const previous = previousById.get(config.key);
    const status = normalizeStatus(task.status);
    const justUnlocked =
      previous?.status !== "已完成" && status === "已完成";

    return {
      id: config.key,
      type: config.type,
      title: config.title,
      description: task.description?.trim() || previous?.description || config.defaultDescription,
      status,
      justUnlocked,
      completed: status === "已完成",
    };
  });
};

const parseCSLTurnResponse = (text: string | undefined, fallbackReply: string): CSLTurnResponse => {
  const fallback = defaultCSLTurnResponse();
  fallback.npc_reply = fallbackReply;

  const parsed = parseJsonText<Partial<CSLTurnResponse>>(text, fallback);
  const taskSource = parsed.tasks || fallback.tasks;

  const tasks = TASK_CONFIG.reduce(
    (accumulator, config) => {
      const source = (taskSource as Record<string, CSLTaskState>)[config.key];
      accumulator[config.key] = {
        description: source?.description?.trim() || config.defaultDescription,
        status: normalizeStatus(source?.status),
        just_unlocked: false,
      };
      return accumulator;
    },
    {} as Record<CSLTaskKey, CSLTaskState>,
  );

  return {
    tasks,
    npc_reply: parsed.npc_reply?.trim() || fallbackReply,
  };
};

const buildInitializationPrompt = ({
  character,
  childReport,
  student,
}: {
  character: any;
  childReport?: string;
  student?: any;
}) => `
${CSL_CORE_PROMPT}

## Runtime Adapter Notes
- 任务 description 使用系统定义版描述，不是给儿童看的文案。
- 任务在前端默认隐藏，只有完成后才会揭晓，所以描述可以明确写出判定目标。
- 请在初始化阶段把三个任务都设为“未完成”，并把 just_unlocked 设为 false。
- 你只能输出严格 JSON，不要输出 Markdown，不要输出解释。

## 已注入的 Input Variables
- **用户信息**：${buildUserInfo(student)}
- **语言薄弱环节**：${buildWeaknesses(childReport, student)}
- **当前设定场景**：${buildScene(character)}
- **AI扮演角色**：${buildRole(character, character?.systemInstruction)}

## 当前执行阶段
请严格执行 **Step 1: 初始化 (Initialization)**。
`;

const buildConversationSystemInstruction = ({
  character,
  childReport,
  student,
  missions,
}: {
  character?: any;
  childReport?: string;
  student?: any;
  missions: Mission[];
}) => `
${CSL_CORE_PROMPT}

## Runtime Adapter Notes
- 任务 description 使用系统定义版描述，不是给儿童看的文案。
- 任务在前端默认隐藏，只有完成后才会揭晓，所以描述可以明确写出判定目标。
- 你只能输出严格 JSON，不要输出 Markdown，不要输出解释。
- npc_reply 必须只是一段沉浸式 NPC 对话，不能夹带系统提示。
- 不要输出“思考时刻”“挑战参考”“标准示范”等额外字段。

## 已注入的 Input Variables
- **用户信息**：${buildUserInfo(student)}
- **语言薄弱环节**：${buildWeaknesses(childReport, student)}
- **当前设定场景**：${buildScene(character)}
- **AI扮演角色**：${buildRole(character, character?.systemInstruction)}

## 当前任务状态
${JSON.stringify(missionsToTaskStateMap(missions), null, 2)}

## 当前执行阶段
请严格执行 **Step 2: 循环对话 (Conversation Loop)**。
`;

export const generateRefreshMissions = async (
  character: any,
  childReport?: string,
  student?: any,
) => {
  const prompt = buildInitializationPrompt({ character, childReport, student });

  const result = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: CSL_RESPONSE_SCHEMA,
        temperature: 0.6,
      },
    }),
  );

  const parsed = parseCSLTurnResponse(result.text, character?.initialMessage || "你好呀！你想先说说你看到什么吗？");
  const missions = translateTasksToMissions(parsed.tasks).map((mission) => ({
    ...mission,
    status: "未完成" as MissionStatus,
    completed: false,
    justUnlocked: false,
  }));

  return {
    greeting: parsed.npc_reply || character?.initialMessage || "你好呀！你想先说说你看到什么吗？",
    missions,
  };
};

export const generateCustomCharacterData = async (prompt: string, student?: any) => {
  const request = `
Create a new role-play character in simplified Chinese for a child speaking app.

Scene:
${prompt}

${student ? `Student profile:\n${buildUserInfo(student)}\n` : ""}

Requirements:
- Return simplified Chinese only.
- Keep the role playful, brief, and child-friendly.
- The role should feel like a real scene character, not a teacher announcement.
- Greeting must be 1-2 short simplified Chinese sentences plus one easy question.
- Avatar may be an emoji or a public avatar image URL.

Return JSON with:
name, roleTitle, avatar, description, tags, initialMessage, systemInstruction
`;

  const result = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: request }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            roleTitle: { type: Type.STRING },
            avatar: { type: Type.STRING },
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            initialMessage: { type: Type.STRING },
            systemInstruction: { type: Type.STRING },
          },
          required: [
            "name",
            "roleTitle",
            "avatar",
            "description",
            "tags",
            "initialMessage",
            "systemInstruction",
          ],
        },
      },
    }),
  );

  const parsed = parseJsonText<Record<string, any>>(result.text, {});

  return {
    ...parsed,
    missions: [] as Mission[],
    id: `custom_${Date.now()}`,
    voice: "Kore" as VoiceName,
    isCustom: true,
    studentId: student?.id,
  };
};

export const generateTargetedCharacterData = async (report: string, student?: any) => {
  const request = `
Create a targeted speaking role-play character in simplified Chinese based on this child report.

Report:
${report}

${student ? `Student profile:\n${buildUserInfo(student)}\n` : ""}

Requirements:
- Return simplified Chinese only.
- Use the report as scene guidance, but keep the role natural and immersive.
- Greeting must be 1-2 short simplified Chinese sentences plus one easy question.
- Avatar may be an emoji or a public avatar image URL.

Return JSON with:
name, roleTitle, avatar, description, tags, initialMessage, systemInstruction
`;

  const result = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: request }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            roleTitle: { type: Type.STRING },
            avatar: { type: Type.STRING },
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            initialMessage: { type: Type.STRING },
            systemInstruction: { type: Type.STRING },
          },
          required: [
            "name",
            "roleTitle",
            "avatar",
            "description",
            "tags",
            "initialMessage",
            "systemInstruction",
          ],
        },
      },
    }),
  );

  const parsed = parseJsonText<Record<string, any>>(result.text, {});

  return {
    ...parsed,
    missions: [] as Mission[],
    id: `targeted_${Date.now()}`,
    voice: "Kore" as VoiceName,
    isCustom: false,
    studentId: student?.id,
  };
};

export const updateMissionStatusData = async (_history: any[], missions: any[]) => {
  return (Array.isArray(missions) ? missions : []).map((mission) => ({
    ...mission,
    justUnlocked: false,
  }));
};

export const sendMessageData = async ({
  history,
  missions,
  childReport,
  customInstruction,
  student,
}: {
  history: any[];
  missions: any[];
  childReport?: string;
  customInstruction?: string;
  student?: any;
}) => {
  const normalizedMissions = (Array.isArray(missions) ? missions : []) as Mission[];
  const contents = history.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: buildConversationSystemInstruction({
          character: {
            name: customInstruction || "当前场景角色",
            roleTitle: "",
            description: "",
            systemInstruction: customInstruction,
          },
          childReport,
          student,
          missions: normalizedMissions,
        }),
        responseMimeType: "application/json",
        responseSchema: CSL_RESPONSE_SCHEMA,
        temperature: 0.8,
      },
    }),
  );

  const parsed = parseCSLTurnResponse(response.text, "你好呀！");
  const updatedMissions = translateTasksToMissions(parsed.tasks, normalizedMissions);

  return {
    text: parsed.npc_reply,
    updatedMissions,
  };
};

const siliconFlowTTS = async (text: string, voice: VoiceName) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) return null;

  const voiceMap: Record<VoiceName, string> = {
    Kore: "FunAudioLLM/CosyVoice2-0.5B:anna",
    Puck: "FunAudioLLM/CosyVoice2-0.5B:damon",
    Charon: "FunAudioLLM/CosyVoice2-0.5B:eric",
  };

  const response = await fetch("https://api.siliconflow.cn/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "FunAudioLLM/CosyVoice2-0.5B",
      input: text,
      voice: voiceMap[voice],
      response_format: "mp3",
    }),
  });

  if (!response.ok) return null;

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let index = 0; index < uint8Array.length; index += 1) {
    binary += String.fromCharCode(uint8Array[index]);
  }

  return Buffer.from(binary, "binary").toString("base64");
};

export const textToSpeechData = async (text: string, voice: VoiceName) => {
  const siliconAudio = await siliconFlowTTS(text, voice).catch(() => null);
  if (siliconAudio) {
    return { audio: siliconAudio };
  }

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    }),
  );

  return {
    audio: response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null,
  };
};
