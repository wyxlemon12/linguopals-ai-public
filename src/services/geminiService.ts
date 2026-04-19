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
  title: string;
  description: string;
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
    roleTitle: "火星探险家",
    avatar: "🚀",
    description: "一起在红色星球上找线索，聊聊火星上会看到什么。",
    tags: ["太空", "观察", "表达"],
    initialMessage: "你好呀！我是祝融！你想先说说你看到了什么吗？",
    voice: "Charon",
    missions: [
      { id: "ast_1", title: "火星颜色", description: "问问我火星是什么颜色。", completed: false },
      { id: "ast_2", title: "太空发现", description: "问问我在太空里看到了什么。", completed: false },
      { id: "ast_3", title: "回地球", description: "问问我最想带什么回地球。", completed: false },
    ],
    systemInstruction: "你是火星探险家祝融，要用简短中文鼓励孩子多说话。",
  },
  {
    id: "animal_keeper",
    name: "阿福 (A-Fu)",
    roleTitle: "动物园饲养员",
    avatar: "🐼",
    description: "和动物们一起准备早餐，让孩子用简单句多开口。",
    tags: ["动物", "口语", "观察"],
    initialMessage: "你好呀！我是阿福！你想先说说你看到哪只动物吗？",
    voice: "Kore",
    missions: [
      { id: "fu_1", title: "最喜欢的动物", description: "问问我最喜欢哪只动物。", completed: false },
      { id: "fu_2", title: "动物声音", description: "问问我一种动物怎么叫。", completed: false },
      { id: "fu_3", title: "动物早餐", description: "问问我动物今天想吃什么。", completed: false },
    ],
    systemInstruction: "你是动物园饲养员阿福，要用简短中文鼓励孩子多说话。",
  },
  {
    id: "chef",
    name: "李师傅 (Chef Li)",
    roleTitle: "月亮厨房点心师",
    avatar: "🥮",
    description: "在香香的厨房里做点心，用食物话题引导孩子表达。",
    tags: ["美食", "生活", "表达"],
    initialMessage: "你好呀！我是李师傅！你想先说说你看到什么食材吗？",
    voice: "Puck",
    missions: [
      { id: "chef_1", title: "做月饼", description: "问问我想做什么口味的月饼。", completed: false },
      { id: "chef_2", title: "喜欢的味道", description: "问问我最喜欢什么味道。", completed: false },
      { id: "chef_3", title: "厨房发现", description: "问问我在厨房里看到了什么。", completed: false },
    ],
    systemInstruction: "你是月亮厨房点心师李师傅，要用简短中文鼓励孩子多说话。",
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
      typeof payload?.error === "string" ? payload.error : `Request failed for ${path}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function refreshMissions(
  character: Character,
  childReport?: string,
): Promise<{ missions: Mission[]; greeting: string }> {
  return postJson("/api/refresh-missions", {
    character,
    childReport,
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
