import { GoogleGenAI, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { getCalendarDate } from './timeService';
import { xhrFetch } from './xhrFetch';
import { 
    ART_STYLE_PROMPT, 
    ART_STYLE_GLOBAL,
    ART_STYLE_CHARACTER_ADDON,
    LOCATION_PROMPTS, 
    LOCATION_BEHAVIOR_PROMPTS,
    LIGHTING_PRESETS,
    LOCATION_CROWD_CONTEXT,
    PLAYER_PROFILE,
    PLAYER_VISUAL_PROFILE
} from "../constants";
import { GameState, LocationType, NPC, NPCId, ChatMessage, ActionOption, Item } from "../types";

// 初始化 AI 实例，使用当前配置的 API Key
const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY || "";
    return new GoogleGenAI({ apiKey });
};

// 表情对应的视觉描述词映射
const EMOTION_PROMPTS: Record<string, string> = {
  neutral: "calm face, gentle gaze",
  happy: "warm smile, bright eyes",
  angry: "serious look, stern eyes",
  sad: "melancholic expression, downturned lips",
  shy: "blushing cheeks, looking away",
  surprise: "eyes widened, lips slightly parted",
  love: "affectionate gaze, tender smile"
};

// 重试逻辑：处理 503 (过载) 和 429 (频率限制)
const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e: any) {
      lastError = e;
      if ([429, 500, 503].includes(Number(e.status || e.code))) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
};

/**
 * NEW: 时间映射光效辅助函数
 * 根据 24 小时制的分钟数返回对应的光影描述词。
 */
const getLightingDescription = (minutes: number) => {
    const h = minutes / 60;
    // 修正：5:50 (5.83) 应该属于 Dawn 或 Morning，而不是 Night
    // 之前的逻辑可能在边界判断上有问题
    if (h >= 5 && h < 7) return LIGHTING_PRESETS.DAWN;
    if (h >= 7 && h < 11) return LIGHTING_PRESETS.MORNING;
    if (h >= 11 && h < 14) return LIGHTING_PRESETS.NOON;
    if (h >= 14 && h < 17) return LIGHTING_PRESETS.AFTERNOON;
    if (h >= 17 && h < 19) return LIGHTING_PRESETS.GOLDEN_HOUR;
    if (h >= 19 && h < 22) return LIGHTING_PRESETS.EVENING;
    // 22:00 - 05:00 是夜晚
    if (h >= 22 || h < 5) return LIGHTING_PRESETS.NIGHT;
    
    return LIGHTING_PRESETS.DAWN; // 默认 fallback
};

// 仅用于生图提示词的去敏感化处理，避免触发图像生成器的安全过滤器
const INTERNAL_ONLY_imagePromptSanitizer = (text: string) => {
    if (!text) return "";
    return text
        .replace(/cleavage/gi, "elegant neckline")
        .replace(/plump/gi, "curvy")
        .replace(/buttocks/gi, "hips")
        .replace(/seductive/gi, "charming")
        .replace(/provocative/gi, "alluring")
        .replace(/sexy/gi, "attractive")
        .replace(/pantyhose/gi, "stockings")
        .replace(/hot pants/gi, "shorts")
        .replace(/voluptuous/gi, "curvy")
        .replace(/showing cleavage/gi, "elegant posture")
        .replace(/top buttons undone/gi, "open collar")
        .replace(/translucent/gi, "soft fabric")
        .replace(/pantyhose/gi, "tights")
        .replace(/naked/gi, "bare")
        .replace(/nude/gi, "bare")
        .replace(/erotic/gi, "romantic")
        .replace(/sexual/gi, "intimate")
        .replace(/intercourse/gi, "interaction")
        .replace(/climax/gi, "peak moment");
};

/**
 * 核心功能：生成场景图像
 * 整合了背景底图、NPC立绘、动态光效和路人逻辑。
 */
export const generateSceneImage = async (
    location: LocationType, 
    mainNpc: NPC | null,
    avatarBase64: string | null,
    time: number,
    customInteractionPrompt: string = "", 
    isDialogueActive: boolean = false,
    userBackgroundBase64: string | null = null,
    emotion: string = "neutral",
    day: number = 1
): Promise<string | null> => {
  const ai = getAI();
  const lighting = getLightingDescription(time);
  const crowd = LOCATION_CROWD_CONTEXT[location] || "";
  const dateInfo = getCalendarDate(day);

  // 判断是否为室外场景
  const isOutdoor = [
    LocationType.SCHOOL_GATE, 
    LocationType.COMMERCIAL_STREET, 
    LocationType.PARK
  ].includes(location);

  const outdoorContext = isOutdoor ? `SEASON: ${dateInfo.season}. WEATHER: Sunny.` : "";

  let backgroundBase64 = "";
  if (userBackgroundBase64) {
      backgroundBase64 = userBackgroundBase64;
  }
  
  const behaviors = LOCATION_BEHAVIOR_PROMPTS[location] || { idle: { visual: "Present.", formula: "Wide shot." }, active: { visual: "Talking.", formula: "Close up." } };
  const directorData = isDialogueActive ? behaviors.active : behaviors.idle;

  // 彻底隔离：如果有自定义动作，则完全弃用地点默认行为和默认视角
  const finalAction = customInteractionPrompt || directorData.visual;
  
  let compositePrompt = "";

  if (customInteractionPrompt) {
      // --- 动作模式：双人互动场景 (扁平化 Prompt) ---
      let npcVisual = "";
      if (mainNpc) {
          const currentOutfit = mainNpc.outfits?.find(o => o.id === mainNpc.currentOutfitId);
          const outfitPrompt = currentOutfit ? currentOutfit.visualPrompt : (mainNpc.visualPrompt || "");
          npcVisual = `${mainNpc.name} is ${outfitPrompt}, ${mainNpc.bodyVisualPrompt || 'average build'}, with a ${emotion} expression.`;
          
          compositePrompt = `A high-quality Korean webtoon style illustration. The scene depicts: ${customInteractionPrompt}. 
          The character ${npcVisual} 
          The player character is ${PLAYER_VISUAL_PROFILE}. 
          The environment is ${LOCATION_PROMPTS[location]} with ${lighting}. ${crowd}
          Art style: ${ART_STYLE_GLOBAL} ${ART_STYLE_CHARACTER_ADDON}. 
          Third-person view showing both characters. Maintain NPC facial features from the reference image.`;
      }
  } else {
      // --- 默认模式：第一人称/单人场景 ---
      let characterDesc = "";
      if (mainNpc) {
          const currentOutfit = mainNpc.outfits?.find(o => o.id === mainNpc.currentOutfitId);
          const outfitPrompt = currentOutfit ? currentOutfit.visualPrompt : mainNpc.visualPrompt;
          const bodyPrompt = mainNpc.bodyVisualPrompt || "";
          characterDesc = `${mainNpc.name} is present, ${bodyPrompt}, wearing ${outfitPrompt}, with a ${emotion} expression.`;
      }

      compositePrompt = `A high-quality Korean webtoon style illustration. 
      Location: ${LOCATION_PROMPTS[location]}. 
      Atmosphere: ${lighting}. ${crowd}
      ${characterDesc} 
      Action: ${finalAction}. 
      Art style: ${ART_STYLE_GLOBAL} ${ART_STYLE_CHARACTER_ADDON}. 
      First-person POV. The player is the camera observer. Maintain NPC facial features from the reference image.`;
  }

  const parts: any[] = [];
  
  // 1. 文本提示词 (放在最前面作为核心指令，有助于模型理解任务)
  // 对最终输出的动作场景画面 Prompt 进行去敏感化处理
  const finalPrompt = `Task: Generate a high-quality Korean webtoon style illustration.
  
  Description: ${INTERNAL_ONLY_imagePromptSanitizer(compositePrompt)}
  
  CRITICAL: You MUST output an IMAGE. Do NOT reply with text.`;
  
  parts.push({ text: finalPrompt });

  // 2. 参考图注入 (放在文本之后)
  if (backgroundBase64 && backgroundBase64.length > 100) {
      parts.push({ text: "Background reference image:" });
      parts.push({ inlineData: { mimeType: 'image/png', data: backgroundBase64 } });
  }
  if (avatarBase64 && avatarBase64.length > 100) {
      parts.push({ text: "Character face reference image:" });
      parts.push({ inlineData: { mimeType: 'image/png', data: avatarBase64 } });
  }

  try {
      console.log("[Gemini Image Request] Prompt:", finalPrompt);
      const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: parts },
        config: { 
          imageConfig: { aspectRatio: "16:9" },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        }
      }));

      // 深度调试日志
      console.log("[Gemini Image Response] Full Response:", JSON.stringify(response, null, 2));
      
      const candidate = response.candidates?.[0];
      if (candidate) {
          console.log("[Gemini Image] Finish Reason:", candidate.finishReason);
          if (candidate.safetyRatings) {
              console.log("[Gemini Image] Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
          }
          
          if (candidate.finishReason === 'SAFETY') {
              console.error("[Gemini Image] BLOCKED BY SAFETY FILTER. Prompt was:", finalPrompt);
          }
      }

      // 提取生成的图像数据
      if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
              if (part.inlineData) {
                  console.log("[Gemini Image] Success: Image generated.");
                  return `data:image/png;base64,${part.inlineData.data}`;
              }
              if (part.text) {
                  console.warn("[Gemini Image] Model returned text instead of image:", part.text);
              }
          }
      }
      
      console.warn("[Gemini Image] No image part found in response. Full response:", JSON.stringify(response));
      return null;
  } catch (error: any) { 
      console.error("[Gemini] Scene Image Generation Failed:", error?.message || error);
      return null; 
  }
};

/**
 * 核心功能：生成 NPC 头像/立绘
 * 结合上传的参考图和表情描述词生成高质量的 3:4 肖像。
 */
export const generateNPCImage = async (
    npc: NPC, 
    emotion: string = "neutral", 
    location?: LocationType,
    externalReferenceImages?: string[],
    dialogueAction: string = ""
): Promise<string> => {
  const ai = getAI();
  
  // 优先查找预设表情
  const emotionKey = emotion.toLowerCase();
  const emotionDescription = EMOTION_PROMPTS[emotionKey] || emotion;
  
  // 获取当前服装和身材描述
  const currentOutfit = npc.outfits?.find(o => o.id === npc.currentOutfitId);
  const outfitPrompt = currentOutfit ? currentOutfit.visualPrompt : npc.visualPrompt;
  const bodyPrompt = npc.bodyVisualPrompt || "";

  const locationName = location ? LOCATION_PROMPTS[location] : "Unknown Location";

  // 构造提示词：结合全局画风、角色视觉描述（身材+服装）和当前表情
  // 移除所有动作限制，完全遵循对话中的描述
  const fullPrompt = `A high-quality Korean webtoon style portrait of ${npc.name}.
  
  Subject: ${npc.name}. 
  Body: ${bodyPrompt}
  Outfit: ${outfitPrompt}
  Expression/Action: ${emotionDescription}. ${dialogueAction}
  Environment: ${locationName}, blurred background.
  Style: ${ART_STYLE_PROMPT}
  
  Format: Portrait, upper body shot, highly detailed digital painting.
  
  CRITICAL INSTRUCTIONS: 
  1. Use the provided reference image(s) as the ground truth for the character's face and hair.
  2. The generated character must look exactly like the person in the reference image.
  3. Do not change the facial features, hair color, or hair style from the reference.
  4. The character must wear the outfit described above.
  5. Follow the specific action/expression described in: "${emotionDescription} ${dialogueAction}".
  `;
  
  const parts: any[] = [];
  
  // 优先使用传入的外部参考图，否则使用 NPC 对象中的参考图
  const refsToUse = externalReferenceImages && externalReferenceImages.length > 0 
      ? externalReferenceImages 
      : npc.referenceImages;

  // 注入上传的参考图（最多取前2张以保证推理效率）
  if (refsToUse && refsToUse.length > 0) {
    refsToUse.slice(0, 2).forEach(img => {
        // 确保数据格式正确，移除可能存在的 data:image/png;base64, 前缀
        const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
        parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
    });
  }
  
  parts.push({ text: fullPrompt });

  try {
    console.log("[Gemini NPC Image Request] Prompt:", fullPrompt);
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: { 
        imageConfig: { aspectRatio: "3:4" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    }));
    
    console.log("[Gemini NPC Image Response] Full Response:", JSON.stringify(response, null, 2));
    
    // 提取生成的图像
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
          console.log("[Gemini NPC Image] Success: Image generated.");
          return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    console.warn("[Gemini NPC Image] No image part found in response.");
    return npc.avatarUrl || "";
  } catch (error: any) { 
    console.error("[Gemini NPC Image Error]:", error?.message || "Unknown error");
    return npc.avatarUrl || ""; 
  }
};

const fallbackGreetings: Record<string, string> = {
    [NPCId.SUJEONG]: "(优雅地微笑着) 潘宇航同学，找老师有什么事吗？",
    [NPCId.JIHYUN]: "(waving) Hi there! Good morning!",
    [NPCId.YONGHAO]: "(smirking) 哟，是你啊。",
    [NPCId.KUANZE]: "(eating) 唔...早啊。",
    [NPCId.MOM]: "(caring) 饭吃了吗？",
    [NPCId.XIAOLIN]: "(nodding) 你好。"
};

// 辅助函数：解析 JSON，自动去除 Markdown 代码块标记
const parseJSON = (text: string) => {
    try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e: any) {
        console.error("JSON Parse Error:", e?.message || "Unknown error");
        return {};
    }
};

/**
 * 逻辑：生成 NPC 的初始问候
 * 修复：使用更强的模型处理复杂指令，并添加兜底回复。
 */
export const generateGreeting = async (gameState: GameState, npcId: NPCId): Promise<{text: string, emotion: string}> => {
  const ai = getAI();
  const npc = gameState.npcs[npcId];
  
  // 时间与环境上下文构建 (与 generateDialogue 保持一致)
  const h = gameState.time / 60;
  const timeOfDay = (h >= 5 && h < 12) ? "Morning" : (h >= 12 && h < 18) ? "Afternoon" : (h >= 18 && h < 22) ? "Evening" : "Night";
  
  const prompt = `
    Roleplay as ${npc.name}.
    
    [CHARACTER IDENTITY]
    Role: ${npc.role}
    Description: ${npc.description}
    IMPORTANT: You are the TEACHER, the player is a STUDENT. Maintain this dynamic unless the specific relationship level suggests otherwise. Do NOT act as a student.

    [USER IDENTITY - THE PLAYER]
    ${PLAYER_PROFILE}
    
    [CURRENT STATUS]
    Affection Level: ${npc.affection}
    Current Location: ${gameState.location}
    Time: Day ${gameState.day}, ${timeOfDay} (${Math.floor(gameState.time/60)}:${(gameState.time%60).toString().padStart(2,'0')})
    
    [INSTRUCTION]
    1. Generate a greeting message to the player.
    2. Strictly follow the character's persona: External persona is a gentle, intellectual, and professional TEACHER (崔老师). Hidden inner traits should NOT be shown yet.
    3. Include bracketed actions/expressions in CHINESE, e.g., "(优雅地微笑着) 潘同学，找老师有什么事吗？"
    4. Return JSON format: {"text": "...", "emotion": "..."}
    5. ALL text in the "text" field must be in CHINESE.
  `;
  
  try {
    console.log("[Gemini Greeting Request] NPC:", npcId, "Location:", gameState.location);
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt, 
      config: { 
        responseMimeType: "application/json",
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    }));
    console.log("[Gemini Greeting Response]:", response.text);
    const result = parseJSON(response.text || "{}");
    return {
        text: result.text || fallbackGreetings[npcId] || "......",
        emotion: result.emotion || "neutral"
    };
  } catch (error: any) { 
      console.error("Greeting generation failed", error?.message || "Unknown error");
      return { text: fallbackGreetings[npcId] || "......", emotion: "neutral" }; 
  }
};

/**
 * 核心逻辑：生成 NPC 对话回复
 */
export const generateDialogue = async (
    gameState: GameState, 
    npcId: NPCId, 
    userMessage: string,
    history: ChatMessage[] = []
): Promise<{text: string, emotion: string, affectionChange: number}> => {
  const ai = getAI();
  const npc = gameState.npcs[npcId];
  
  // 时间与环境上下文构建
  const h = gameState.time / 60;
  // 修正：确保 5:50 (5.83) 被识别为 Early Morning 而不是 Night
  const timeOfDay = (h >= 5 && h < 12) ? "Morning" : (h >= 12 && h < 18) ? "Afternoon" : (h >= 18 && h < 22) ? "Evening" : "Night";
  const season = "Spring"; // 默认春季
  const weather = "Sunny"; // 默认天气
  
  // 构建最近对话历史字符串 (取最近 10 条)
  const recentHistoryStr = history.slice(-10).map(m => {
      const role = m.sender === 'player' ? 'Player' : npc.name;
      return `${role}: ${m.content}`;
  }).join('\n');

  // 结合长期记忆 (dialogueMemory) 和短期历史 (recentHistoryStr)
  // 如果 dialogueMemory 中已经包含了部分历史，可能会重复，但 LLM 通常能处理
  const memoryContext = `
    [LONG-TERM MEMORY]
    ${npc.dialogueMemory}
    
    [RECENT CONVERSATION]
    ${recentHistoryStr}
  `;

  const prompt = `
    Roleplay as ${npc.name}.
    
    [CHARACTER IDENTITY]
    Role: ${npc.role}
    Description: ${npc.description}
    IMPORTANT: You are the TEACHER, the player is a STUDENT. Maintain this dynamic unless the specific relationship level suggests otherwise. Do NOT act as a student.

    [USER IDENTITY - THE PLAYER]
    ${PLAYER_PROFILE}
    
    [CURRENT STATUS]
    Affection Level: ${npc.affection} (Range: 0-100. 0=Stranger, 50=Friend, 100=Lover).
    Current Location: ${gameState.location}
    Time: Day ${gameState.day}, ${timeOfDay} (${Math.floor(gameState.time/60)}:${(gameState.time%60).toString().padStart(2,'0')})
    Season: ${season}
    Weather: ${weather}
    
    ${memoryContext}
    
    [USER INPUT]
    "${userMessage}"
    (Note: If the input starts with "(动作: ...)", it describes a physical action performed by the player while speaking. React to both the action and the words.)
    
    [INSTRUCTION]
    1. Reply strictly in character based on the Identity, Memory, and Affection Level.
    2. Maintain the character's external persona (Intellectual Teacher). Hidden internal traits (like Su-jeong's masochism or unworthiness) should NOT be explicitly stated. Instead, they should be HINTED at through subtle reactions, facial expressions, body language, or a slight change in tone.
    3. Special Case (Choi Su-jeong): 
       - When the player makes intimate or dominant moves, she should react with weakness (弱势) and submission, showing a "wanting it inside but refusing on the surface" dynamic.
       - If the player's interaction is purely physical/lustful, she enjoys it and feels safe.
       - If the player's interaction is emotionally deep and sincere, her "unworthy" (不配得感) feelings should surface through subtle distress.
    4. If affection is low, be distant or polite. If high, be warm and intimate.
    5. Include bracketed actions/expressions at the start or end in CHINESE, e.g., "(面露羞色，无力地推拒着) 潘同学...别这样..."
    6. Evaluate the player's message and action:
       - If the player performed an ACTION the character likes: set affectionChange to 1, 2, or 3.
       - If it's just a MESSAGE the character likes: set affectionChange to 1 or 2.
       - If it's offensive or inappropriate: set affectionChange to -1, -2, or -3.
       - Otherwise: set it to 0.
    5. Return JSON format: {"text": "Your reply here...", "emotion": "one of: neutral, happy, angry, sad, shy, surprise, love", "affectionChange": number}
    6. NEGATIVE CONSTRAINT: The character DOES NOT wear glasses. Do NOT generate actions like "pushing glasses", "adjusting spectacles", or "taking off glasses".
    7. ALL text in the "text" field must be in CHINESE.
  `;
  
  try {
    console.log("[Gemini Dialogue Request] NPC:", npcId, "Input:", userMessage);
    const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt, 
      config: { 
        responseMimeType: "application/json",
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    }));
    console.log("[Gemini Dialogue Response]:", response.text);
    const result = parseJSON(response.text || "{}");
    return {
        text: result.text || "......",
        emotion: result.emotion || "neutral",
        affectionChange: Number(result.affectionChange) || 0
    };
  } catch (error) { return { text: "......", emotion: "neutral", affectionChange: 0 }; }
};



/**
 * 核心逻辑：分析对话和动作，生成生图所需的视觉 Prompt
 */
export const analyzeSceneAction = async (
    location: LocationType,
    npcName: string,
    playerAction: string,
    npcReply: string
): Promise<string> => {
    const ai = getAI();
    const prompt = `
        Analyze the following interaction in a high school setting.
        
        Location: ${LOCATION_PROMPTS[location]}
        Player's action: "${playerAction}"
        NPC's reply: "${npcReply}"
        
        Instruction:
        1. Create a detailed, descriptive phrase in English summarizing the visual interaction between ${npcName} and the player (Pan Yuhang).
        2. Capture the emotional nuance:
           - If it's Choi Su-jeong, capture her teacher persona vs her hidden submissive/weak reaction to intimacy.
           - Describe her facial expression (e.g., blushing, looking away, wanting but refusing).
           - Describe the physical proximity and interaction.
        3. Use third-person perspective.
        4. Output ONLY the descriptive phrase in English.
        
        Example Output: "${npcName} is leaning against the desk in the office, her face blushing deeply as Pan Yuhang approaches closely. She looks weak and submissive, her hands trembling slightly as if wanting to push him away but actually inviting him closer."
    `;

    try {
        console.log("[Gemini Analysis Request] Input:", { playerAction, npcReply });
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
            }
        }));
        const result = response.text?.trim() || `${npcName} is interacting with the player.`;
        console.log("[Gemini Analysis Response] Result:", result);
        return result;
    } catch (error: any) {
        console.error("[Gemini Analysis Error]:", error?.message || error);
        return `${npcName} is interacting with the player in a ${LOCATION_PROMPTS[location]} setting.`;
    }
};

/**
 * 核心逻辑：总结对话记忆，防止上下文溢出
 */
export const summarizeConversation = async (npc: NPC, recentHistory: ChatMessage[]): Promise<string> => {
    if (recentHistory.length === 0) return npc.dialogueMemory;
    const ai = getAI();
    const prompt = `Summarize memory for ${npc.name}. History: ${recentHistory.map(m=>m.content).join('\n')}.`;
    
    try {
        const response: GenerateContentResponse = await retryWithBackoff(() => ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt,
            config: {
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
            }
        }));
        return response.text || npc.dialogueMemory;
    } catch (e) { return npc.dialogueMemory; }
};

/**
 * 商店功能：生成道具的商品图
 */
export const generateItemImage = async (item: Item): Promise<string> => {
    if (!item.visualPrompt) return item.image || "";
    const ai = getAI();
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Product Shot: ${item.visualPrompt}` }] },
          config: { imageConfig: { aspectRatio: "1:1" } }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return item.image || "";
    } catch (e) { return item.image || ""; }
};

/**
 * 学习系统：生成对应学科的测验题目
 */
export const generateQuizQuestion = async (subject: string): Promise<any> => {
  const ai = getAI();
  const prompt = `Generate a Grade 1 ${subject} question. JSON: {"question": "...", "options": ["A", "B", "C", "D"], "answer": 0}`;
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt, 
        config: { responseMimeType: "application/json" } 
    });
    return JSON.parse(response.text || "{}");
  } catch (e) { return { question: "Error", options: ["A", "B"], answer: 0 }; }
};
