import s2t from "s2t-chinese";

export interface StudentInfo {
  firstLanguage: string;
  enrollmentDate: string;
  grade: string;
  customField: string;
}

export interface Student {
  id: string;
  name: string;
  info: StudentInfo;
  report: string;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  audio?: string;
  audioMimeType?: string;
}

export interface Mission {
  id: string;
  type: "general" | "challenge";
  title: string;
  description: string;
  status: "未完成" | "已完成";
  justUnlocked: boolean;
  completed: boolean;
}

export type CharacterId = string;

export interface Character {
  id: CharacterId;
  name: string;
  roleTitle: string;
  avatar: string;
  description: string;
  tags?: string[];
  systemInstruction: string;
  initialMessage: string;
  voice: "Kore" | "Puck" | "Charon";
  isCustom?: boolean;
  missions?: Mission[];
  studentId?: string;
}

export const CHARACTERS: Character[] = [
  {
    id: "astronaut",
    name: "祝融 (Zhu Rong)",
    roleTitle: "火星探险员",
    avatar: "🚀",
    description: "一起在红色星球上找线索，边观察边聊天。",
    tags: ["太空", "观察", "表达"],
    initialMessage: "你好呀！我是祝融。你准备好和我一起看看火星了吗？",
    voice: "Charon",
    missions: [
      {
        id: "general_task_A",
        type: "general",
        title: "一般任务 A",
        description: "用户需要说出包含目标词的完整短句：火星是红色的。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
      {
        id: "general_task_B",
        type: "general",
        title: "一般任务 B",
        description: "用户需要使用选择句型做出决定。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
      {
        id: "challenge_task_C",
        type: "challenge",
        title: "挑战任务 C",
        description: "用户需提问引导NPC透露隐藏信息：想带回地球的东西。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
    ],
    systemInstruction: "你是火星探险员祝融，要用简短中文自然聊天，像耐心老师一样鼓励孩子多说话。",
  },
  {
    id: "animal_keeper",
    name: "阿福 (A-Fu)",
    roleTitle: "动物园饲养员",
    avatar: "🐼",
    description: "和动物们一起准备早餐，让孩子在聊天里多开口。",
    tags: ["动物", "口语", "观察"],
    initialMessage: "你好呀！我是阿福。你今天想先看看哪只小动物？",
    voice: "Kore",
    missions: [
      {
        id: "general_task_A",
        type: "general",
        title: "一般任务 A",
        description: "用户需要说出包含目标词的完整短句：熊猫喜欢吃竹子。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
      {
        id: "general_task_B",
        type: "general",
        title: "一般任务 B",
        description: "用户需要使用选择句型做出决定。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
      {
        id: "challenge_task_C",
        type: "challenge",
        title: "挑战任务 C",
        description: "用户需提问引导NPC透露隐藏信息：最喜欢的动物。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
    ],
    systemInstruction: "你是动物园饲养员阿福，要自然聊天，像耐心老师一样鼓励孩子多说完整句。",
  },
  {
    id: "chef",
    name: "李师傅 (Chef Li)",
    roleTitle: "月亮厨房点心师",
    avatar: "🥮",
    description: "在香香的厨房里做点心，用食物话题引导孩子表达。",
    tags: ["美食", "生活", "表达"],
    initialMessage: "你好呀！我是李师傅。今天你想和我一起做什么点心？",
    voice: "Puck",
    missions: [
      {
        id: "general_task_A",
        type: "general",
        title: "一般任务 A",
        description: "用户需要说出包含目标词的动宾结构：把面团揉圆。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
      {
        id: "general_task_B",
        type: "general",
        title: "一般任务 B",
        description: "用户需要使用选择句型或建议句型。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
      {
        id: "challenge_task_C",
        type: "challenge",
        title: "挑战任务 C",
        description: "用户需提问引导NPC透露隐藏信息：想吃的点心。",
        status: "未完成",
        justUnlocked: false,
        completed: false,
      },
    ],
    systemInstruction: "你是月亮厨房的李师傅，要保持自然对话，用耐心老师的语气鼓励孩子多表达。",
  },
];

export function toTraditional(text: string): string {
  if (!text) return text;

  try {
    return s2t.s2t(text);
  } catch (error) {
    console.error("Conversion to Traditional failed:", error);
    return text;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof (payload as { error?: unknown })?.error === "string"
        ? (payload as { error: string }).error
        : `Request failed for ${path}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function refreshMissions(
  character: Character,
  childReport?: string,
  student?: Student,
): Promise<{ missions: Mission[]; greeting: string }> {
  return postJson("/api/refresh-missions", {
    character,
    childReport,
    student,
  });
}

export async function generateCustomCharacter(
  prompt: string,
  student?: Student,
): Promise<Character> {
  return postJson("/api/generate-custom-character", {
    prompt,
    student,
  });
}

export async function generateTargetedCharacter(
  report: string,
  student?: Student,
): Promise<Character> {
  return postJson("/api/generate-targeted-character", {
    report,
    student,
  });
}

export async function updateMissionStatus(
  history: ChatMessage[],
  missions: Mission[],
): Promise<Mission[]> {
  return postJson("/api/update-mission-status", {
    history,
    missions,
  });
}

export async function sendMessage(
  characterId: string,
  history: ChatMessage[],
  missions: Mission[],
  childReport?: string,
  customInstruction?: string,
  student?: Student,
): Promise<{ text: string; updatedMissions: Mission[] }> {
  return postJson("/api/send-message", {
    characterId,
    history,
    missions,
    childReport,
    customInstruction,
    student,
  });
}

export async function textToSpeech(
  text: string,
  voice: "Kore" | "Puck" | "Charon" = "Kore",
) {
  const payload = await postJson<{ audio?: string }>("/api/text-to-speech", {
    text,
    voice,
  });
  return payload.audio ?? null;
}
