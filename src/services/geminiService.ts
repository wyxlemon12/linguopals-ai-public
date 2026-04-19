import { GoogleGenAI, Modality, Type } from "@google/genai";
import s2t from "s2t-chinese";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export function toTraditional(text: string): string {
  if (!text) return text;

  try {
    return s2t.s2t(text);
  } catch (error) {
    console.error("Conversion to Traditional failed:", error);
    return text;
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing. Please set it in .env.local.");
      }

      return await fn();
    } catch (error: any) {
      lastError = error;

      const errorMsg = error?.message || "";
      const errorStr = String(error);
      const isInvalidKey =
        errorMsg.includes("API key expired") ||
        errorMsg.includes("INVALID_ARGUMENT") ||
        errorMsg.includes("API_KEY_INVALID");

      if (isInvalidKey) {
        throw new Error("无效或过期的 API Key，请检查 GEMINI_API_KEY。");
      }

      const isQuotaError =
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorStr.includes("429") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        error?.status === 429 ||
        error?.code === 429;

      if (isQuotaError && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1500 + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

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

const BASE_RESPONSE_RULES = `
你必须只输出四个标签，且全部使用简体中文：
[对话内容] 角色对孩子说的话
[标准示范] 更自然、更完整的普通话表达
[思考时刻] 一个非常简单的追问
[挑战参考] 一个有趣但简短的参考答案

规则：
1. 角色的语言要短、口语化、适合儿童。
2. 目标是让孩子多说话，所以角色自己不要说太复杂。
3. [标准示范] 必须是孩子可以直接模仿的简短普通话表达。
4. 不要输出旁白、内心活动、说明文字或额外标签。
`;

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
      { id: "ast_1", title: "火星颜色", description: "问问火星是什么颜色。", completed: false },
      { id: "ast_2", title: "太空发现", description: "说说你在太空里看到了什么。", completed: false },
      { id: "ast_3", title: "回地球", description: "讲讲你最想带什么回地球。", completed: false },
    ],
    systemInstruction: `你是火星探险家“祝融”。${BASE_RESPONSE_RULES}`,
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
      { id: "fu_1", title: "最喜欢的动物", description: "说说你最喜欢哪只动物。", completed: false },
      { id: "fu_2", title: "动物声音", description: "学一学一种动物怎么叫。", completed: false },
      { id: "fu_3", title: "动物早餐", description: "说说动物今天想吃什么。", completed: false },
    ],
    systemInstruction: `你是动物园饲养员“阿福”。${BASE_RESPONSE_RULES}`,
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
      { id: "chef_1", title: "做月饼", description: "说说你想做什么口味的月饼。", completed: false },
      { id: "chef_2", title: "喜欢的味道", description: "说说你最喜欢什么味道。", completed: false },
      { id: "chef_3", title: "厨房发现", description: "讲讲你在厨房里看到了什么。", completed: false },
    ],
    systemInstruction: `你是月亮厨房点心师“李师傅”。${BASE_RESPONSE_RULES}`,
  },
];

const buildStudentProfile = (student?: Student) => {
  if (!student) return "";

  return `
Student profile reference:
- Name: ${student.name || "Unknown"}
- Grade: ${student.info?.grade || "Unknown"}
- Enrollment date: ${student.info?.enrollmentDate || "Unknown"}
- First language: ${student.info?.firstLanguage || "Unknown"}
- Custom notes: ${student.info?.customField || "None"}
`;
};

export async function refreshMissions(
  character: Character,
  childReport?: string,
): Promise<{ missions: Mission[]; greeting: string }> {
  const prompt = `
You are preparing a speaking scene for a young child.

Character:
- Name: ${character.name}
- Role: ${character.roleTitle}

${childReport ? `Child report:\n${childReport}\n` : ""}

Requirements:
- Write the greeting in simplified Chinese.
- The greeting must be 1-2 short child-facing sentences and end with one very easy question.
- Keep missions extremely simple and tied to the current role.

Return JSON with:
{
  "greeting": string,
  "missions": [{ "id": string, "title": string, "description": string, "completed": boolean }]
}
`;

  try {
    const result = await withRetry(() =>
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              greeting: { type: Type.STRING },
              missions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    completed: { type: Type.BOOLEAN },
                  },
                  required: ["id", "title", "description", "completed"],
                },
              },
            },
            required: ["greeting", "missions"],
          },
        },
      }),
    );

    const data = JSON.parse(result.text || "{}");
    return {
      greeting: data.greeting || character.initialMessage,
      missions: data.missions || character.missions || [],
    };
  } catch (error) {
    console.error("Failed to refresh missions:", error);
    return {
      greeting: character.initialMessage,
      missions: character.missions || [],
    };
  }
}

export async function generateCustomCharacter(prompt: string, student?: Student): Promise<Character> {
  const studentContext = buildStudentProfile(student);
  const request = `
Create a playful speaking role-play character in simplified Chinese.

Scene idea:
${prompt}

${studentContext}

Requirements:
- The role should encourage the child to speak more.
- Keep the role's own language short and easy.
- The greeting should be 1-2 short sentences plus one simple question.

Return JSON with:
name, roleTitle, avatar, description, tags, initialMessage, systemInstruction, missions
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
            missions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  completed: { type: Type.BOOLEAN },
                },
                required: ["id", "title", "description", "completed"],
              },
            },
          },
          required: [
            "name",
            "roleTitle",
            "avatar",
            "description",
            "tags",
            "initialMessage",
            "systemInstruction",
            "missions",
          ],
        },
      },
    }),
  );

  const charData = JSON.parse(result.text || "{}");
  return {
    ...charData,
    id: `custom_${Date.now()}`,
    voice: "Kore",
    isCustom: true,
    studentId: student?.id,
    name: charData.name || "新朋友",
    roleTitle: charData.roleTitle || "神秘伙伴",
    avatar: charData.avatar || "✨",
    description: charData.description || "一个会陪孩子一起开口说话的新场景。",
    tags: charData.tags || ["口语", "互动"],
    missions: charData.missions || [],
    initialMessage: charData.initialMessage || "你好呀！你想先说说你看到了什么吗？",
    systemInstruction: charData.systemInstruction || BASE_RESPONSE_RULES,
  };
}

export async function generateTargetedCharacter(report: string, student?: Student): Promise<Character> {
  const studentContext = buildStudentProfile(student);
  const request = `
You are an early childhood speaking coach. Use the student report and profile to design a targeted role-play character.

Report:
${report}

${studentContext}

Requirements:
- Use the student profile as reference in the analysis.
- The role should be playful, short-spoken, and strongly encourage the child to answer.
- The greeting must be 1-2 short sentences plus one simple question.
- Use simplified Chinese for all generated text.

Return JSON with:
name, roleTitle, avatar, description, tags, initialMessage, systemInstruction, missions
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
            missions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  completed: { type: Type.BOOLEAN },
                },
                required: ["id", "title", "description", "completed"],
              },
            },
          },
          required: [
            "name",
            "roleTitle",
            "avatar",
            "description",
            "tags",
            "initialMessage",
            "systemInstruction",
            "missions",
          ],
        },
      },
    }),
  );

  const charData = JSON.parse(result.text || "{}");
  return {
    ...charData,
    id: `targeted_${Date.now()}`,
    voice: "Kore",
    isCustom: false,
    studentId: student?.id,
    name: charData.name || "报告推荐伙伴",
    roleTitle: charData.roleTitle || "口语引导老师",
    avatar: charData.avatar || "🌙",
    description: charData.description || "根据报告和档案生成的专属引导场景。",
    tags: charData.tags || ["个性化", "报告推荐"],
    missions: charData.missions || [],
    initialMessage: charData.initialMessage || "你好呀！你想先说说你看到什么吗？",
    systemInstruction: charData.systemInstruction || BASE_RESPONSE_RULES,
  };
}

export async function updateMissionStatus(
  history: ChatMessage[],
  missions: Mission[],
): Promise<Mission[]> {
  if (missions.length === 0) return missions;

  const prompt = `
Conversation history:
${JSON.stringify(history)}

Current missions:
${JSON.stringify(missions)}

Mark a mission completed if the child clearly responded to it. Return only JSON.
`;

  try {
    const result = await withRetry(() =>
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                completed: { type: Type.BOOLEAN },
              },
              required: ["id", "title", "description", "completed"],
            },
          },
        },
      }),
    );

    return JSON.parse(result.text || "[]");
  } catch (error) {
    console.error("Failed to update mission status:", error);
    return missions;
  }
}

export async function sendMessage(
  characterId: string,
  history: ChatMessage[],
  missions: Mission[],
  childReport?: string,
  customInstruction?: string,
  student?: Student,
): Promise<{ text: string; updatedMissions: Mission[] }> {
  const character =
    CHARACTERS.find((item) => item.id === characterId) || {
      systemInstruction: customInstruction || BASE_RESPONSE_RULES,
    };

  if (!character.systemInstruction) {
    throw new Error("Character not found");
  }

  const studentContext = buildStudentProfile(student);
  const contents = history.map((message) => {
    const parts: any[] = [{ text: message.text }];

    if (message.audio && message.audioMimeType) {
      parts.push({
        inlineData: {
          mimeType: message.audioMimeType,
          data: message.audio,
        },
      });
    }

    return {
      role: message.role,
      parts,
    };
  });

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: `
${character.systemInstruction}

${studentContext}

${childReport ? `Child report:\n${childReport}\n` : ""}

Mission tracking:
${JSON.stringify(missions)}

Keep [对话内容] short and concrete, and prefer one easy question that gets the child to answer immediately.
`,
        temperature: 0.8,
      },
    }),
  );

  return {
    text: response.text || "",
    updatedMissions: missions,
  };
}

async function siliconFlowTTS(text: string, voice: string) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) return null;

  try {
    const voiceMap: Record<string, string> = {
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
        voice: voiceMap[voice] || voiceMap.Kore,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let index = 0; index < uint8Array.length; index += 1) {
      binary += String.fromCharCode(uint8Array[index]);
    }
    return window.btoa(binary);
  } catch (error) {
    console.error("SiliconFlow TTS Request Failed:", error);
    return null;
  }
}

export async function textToSpeech(
  text: string,
  voice: "Kore" | "Puck" | "Charon" = "Kore",
) {
  const sfAudio = await siliconFlowTTS(text, voice);
  if (sfAudio) return sfAudio;

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

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}
