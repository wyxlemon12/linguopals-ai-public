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

const parseDialogueContent = (text: string | undefined) => {
  if (!text) return "";
  const match = text.match(/\[(?:对话内容|瀵硅瘽鍐呭)\]\s*[：:]?\s*([\s\S]*?)(?=\[|$)/);
  return match ? match[1].trim() : text.trim();
};

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/[，。！？、,.!?;:：；\s]/g, "")
    .trim();

const estimatedAgeFromGrade = (grade?: string) => {
  const map: Record<string, number> = {
    "Pre-K": 4,
    K: 5,
    G1: 6,
    G2: 7,
    G3: 8,
    G4: 9,
    G5: 10,
    G6: 11,
    G7: 12,
    G8: 13,
    G9: 14,
    G10: 15,
    G11: 16,
    G12: 17,
  };
  return map[grade || ""] ?? 10;
};

const levenshteinDistance = (a: string, b: string) => {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
};

const similarityScore = (target: string, candidate: string) => {
  if (!target || !candidate) return 0;
  const distance = levenshteinDistance(target, candidate);
  return 1 - distance / Math.max(target.length, candidate.length);
};

const completeMissionsFromResponse = (
  missions: any[],
  responseText: string,
  grade?: string,
) => {
  const dialogue = normalizeText(parseDialogueContent(responseText));
  const isYoungerChild = estimatedAgeFromGrade(grade) <= 9;

  return missions.map((mission) => {
    if (mission.completed) return mission;

    const target = normalizeText(mission.targetPhrase || "");
    const keyPhrases = Array.isArray(mission.keyPhrases) ? mission.keyPhrases : [];
    const keywordCoverage =
      keyPhrases.length === 0
        ? 0
        : keyPhrases.filter((phrase) => dialogue.includes(normalizeText(String(phrase)))).length /
          keyPhrases.length;
    const similarity = similarityScore(target, dialogue);

    const completed =
      target.length > 0 && dialogue.includes(target)
        ? true
        : isYoungerChild
          ? keywordCoverage >= 0.6 || similarity >= 0.58
          : keywordCoverage >= 1 || similarity >= 0.78;

    return {
      ...mission,
      completed,
    };
  });
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
- Each mission should be a hidden target line for the child to trigger naturally.
- The visible mission description should be: 试着让角色说出：“目标句”
- Also return hidden targetPhrase and keyPhrases for each mission.
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
                  targetPhrase: { type: Type.STRING },
                  keyPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
                  completed: { type: Type.BOOLEAN },
                },
                required: ["id", "title", "description", "targetPhrase", "keyPhrases", "completed"],
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
- The role must not know the hidden target phrases and should chat naturally after the greeting.
- Mission descriptions should be shown to the child as: 试着让角色说出：“目标句”
- Also return hidden targetPhrase and keyPhrases for each mission.
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
                  targetPhrase: { type: Type.STRING },
                  keyPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
                  completed: { type: Type.BOOLEAN },
                },
                required: ["id", "title", "description", "targetPhrase", "keyPhrases", "completed"],
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
- The role must not know the hidden target phrases and should chat naturally after the greeting.
- Mission descriptions should be shown to the child as: 试着让角色说出：“目标句”
- Also return hidden targetPhrase and keyPhrases for each mission.
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
                  targetPhrase: { type: Type.STRING },
                  keyPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
                  completed: { type: Type.BOOLEAN },
                },
                required: ["id", "title", "description", "targetPhrase", "keyPhrases", "completed"],
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
    updatedMissions = completeMissionsFromResponse(
      missions,
      response.text || "",
      student?.info?.grade,
    );
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
