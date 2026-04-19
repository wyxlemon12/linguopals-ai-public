import { GoogleGenAI, Modality, Type } from "@google/genai";

type VoiceName = "Kore" | "Puck" | "Charon";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const BASE_RESPONSE_RULES = `
You must reply in simplified Chinese and only use these tags:
[对话内容]
[标准示范]
[思考时刻]
[挑战参考]

Rules:
- Keep the role's lines short and child-friendly.
- Help the child speak more. Do not over-explain.
- [标准示范] must be a short Mandarin sentence the child can imitate.
- [思考时刻] should be one easy follow-up question.
`;

const ensureConfigured = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }
};

const buildStudentProfile = (student?: any) => {
  if (!student) return "";

  return `
Student profile:
- Name: ${student.name || "Unknown"}
- Grade: ${student.info?.grade || "Unknown"}
- Enrollment date: ${student.info?.enrollmentDate || "Unknown"}
- First language: ${student.info?.firstLanguage || "Unknown"}
- Custom notes: ${student.info?.customField || "None"}
`;
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

export const generateRefreshMissions = async (character: any, childReport?: string) => {
  const prompt = `
Create a speaking scene greeting and 3 mission prompts for a child.

Character:
- Name: ${character?.name || "Character"}
- Role: ${character?.roleTitle || "Guide"}

${childReport ? `Child report:\n${childReport}\n` : ""}

Requirements:
- Greeting must be 1-2 short simplified Chinese sentences plus one simple question.
- Mission descriptions must describe information the child should ask the character about.
- Use simplified Chinese only.

Return JSON with "greeting" and "missions".
`;

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

  return parseJsonText(result.text, {
    greeting: character?.initialMessage || "你好呀！你想先说说你看到了什么吗？",
    missions: character?.missions || [],
  });
};

export const generateCustomCharacterData = async (prompt: string, student?: any) => {
  const request = `
Create a new role-play character in simplified Chinese for a child speaking app.

Scene:
${prompt}

${buildStudentProfile(student)}

Requirements:
- Keep the role playful and brief.
- Greeting must be 1-2 short simplified Chinese sentences plus one simple question.
- Mission descriptions must be phrased as what the child should ask the character about.
- Avatar may be an emoji or a public avatar image URL.

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

  return {
    ...parseJsonText(result.text, {}),
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

${buildStudentProfile(student)}

Requirements:
- Use the report and student profile as context.
- Greeting must be 1-2 short simplified Chinese sentences plus one simple question.
- Mission descriptions must be phrased as what the child should ask the character about.
- Avatar may be an emoji or a public avatar image URL.

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

  return {
    ...parseJsonText(result.text, {}),
    id: `targeted_${Date.now()}`,
    voice: "Kore" as VoiceName,
    isCustom: false,
    studentId: student?.id,
  };
};

export const updateMissionStatusData = async (history: any[], missions: any[]) => {
  const prompt = `
Conversation history:
${JSON.stringify(history)}

Current missions:
${JSON.stringify(missions)}

Update completed mission flags and return only JSON.
`;

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

  return parseJsonText(result.text, missions);
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
${customInstruction || BASE_RESPONSE_RULES}

${buildStudentProfile(student)}

${childReport ? `Child report:\n${childReport}\n` : ""}

Mission tracking:
${JSON.stringify(missions)}

${BASE_RESPONSE_RULES}

After the greeting, keep the conversation natural and continuous.
Do not explicitly tell the child to ask mission questions.
Do not say things like "come ask me" or "now ask me this task".
Use the mission list only as a background guide for what information can be explored naturally in conversation.
`,
        temperature: 0.8,
      },
    }),
  );

  let updatedMissions = missions;
  if (missions.length > 0) {
    updatedMissions = await updateMissionStatusData(history, missions);
  }

  return {
    text: response.text || "",
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
