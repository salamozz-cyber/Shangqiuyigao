import React, { useState, useEffect, useRef } from 'react';
import { 
  GameState, LocationType, NPCId, RelationLevel, PlayerStats, ChatMessage, Item, NPC, ActionOption, Outfit, Delivery 
} from './types';
import { 
  INITIAL_TIME, INITIAL_NPCS, SCHOOL_SCHEDULE, RELATIONSHIP_STAGES, ITEMS, SUJEONG_OUTFITS_DATA, JIHYUN_OUTFITS_DATA 
} from './constants';
import { 
  generateDialogue, generateSceneImage, generateNPCImage, generateGreeting, analyzeSceneAction
} from './services/geminiService';
import { getCalendarDate } from './services/timeService';
import { 
  saveAssetToDB, getAssetFromDB, loadAssetsFromDB, clearAllAssets, saveGameStateToDB, loadGameStateFromDB, getAllSaves 
} from './services/assetStore';
import PhoneInterface from './components/PhoneInterface';

const App: React.FC = () => {
  const [view, setView] = useState<'menu' | 'settings' | 'game' | 'load_game' | 'save_game'>('menu');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loadingScene, setLoadingScene] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // 新增：防止并发 AI 请求
  const [actionInput, setActionInput] = useState(''); // 新增：动作输入状态
  
  // 本地持久化资产状态
  const [globalAssets, setGlobalAssets] = useState<Record<NPCId, string[]>>({
      [NPCId.SUJEONG]: [], [NPCId.JIHYUN]: [], [NPCId.XIAOLIN]: [], 
      [NPCId.YONGHAO]: [], [NPCId.KUANZE]: [], [NPCId.MOM]: []
  });
  const [sceneRefImages, setSceneRefImages] = useState<Record<string, string[]>>({});
  const [saveSlots, setSaveSlots] = useState<Record<number, any>>({});

  const [gameState, setGameState] = useState<GameState>({
    time: INITIAL_TIME, 
    day: 1, 
    location: LocationType.HOME,
    stats: { money: 150, hunger: 80, thirst: 80, stamina: 100, intelligence: 50, appearance: 70 },
    inventory: [], 
    deliveries: [], 
    npcs: INITIAL_NPCS,
    phone: { contacts: [NPCId.KUANZE, NPCId.MOM], pendingRequests: [], messages: {}, isOpen: false, app: null },
    currentDialogue: { active: false, npcId: null, history: [], currentEmotion: 'neutral', isCinematic: false },
    backgroundUrl: null, 
    bgCache: {}, 
    sceneLayout: {}, 
    isClassStarted: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingUploadTarget, setSettingUploadTarget] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'npc' | 'scene'>('npc');

  // --- 初始化加载：资产 ---
  useEffect(() => {
    const initData = async () => {
        // 1. 仅加载存档列表，不再一次性加载所有图片资产到内存
        const saves = await getAllSaves();
        setSaveSlots(saves);

        // 2. 检查 API Key
        // 注意：在 Vite define 中，process.env.GEMINI_API_KEY 会被替换为字符串
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey !== "undefined" && apiKey !== "") {
            setHasApiKey(true);
        } else {
            // 尝试通过 window.aistudio 检查
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setHasApiKey(true);
            }
        }
    };
    initData();
  }, []);

  // 当进入设置界面时，加载资源预览图
  useEffect(() => {
      if (view === 'settings') {
          const loadPreviewAssets = async () => {
              const assets = await loadAssetsFromDB();
              if (assets) {
                  const newNpcAssets: any = {};
                  const newSceneAssets: any = {};
                  Object.keys(assets).forEach(key => {
                      if (Object.values(NPCId).includes(key as NPCId)) {
                          newNpcAssets[key] = assets[key];
                      } else {
                          newSceneAssets[key] = assets[key];
                      }
                  });
                  setGlobalAssets(newNpcAssets);
                  setSceneRefImages(newSceneAssets);
              }
          };
          loadPreviewAssets();
      } else {
          // 离开设置界面时清空预览图，释放内存
          setGlobalAssets({
              [NPCId.SUJEONG]: [], [NPCId.JIHYUN]: [], [NPCId.XIAOLIN]: [], 
              [NPCId.YONGHAO]: [], [NPCId.KUANZE]: [], [NPCId.MOM]: []
          });
          setSceneRefImages({});
      }
  }, [view]);

  // 新增：按需获取 NPC 参考图的辅助函数
  const getNPCRefs = async (npcId: NPCId): Promise<string[]> => {
      return await getAssetFromDB(npcId);
  };

  // 新增：按需获取场景参考图的辅助函数
  const getSceneRefs = async (loc: string): Promise<string[]> => {
      return await getAssetFromDB(loc);
  };

  // --- 自动存档逻辑：移除，改为手动存档 ---
  // useEffect(() => {
  //   if (view === 'game') {
  //       saveGameStateToDB(gameState);
  //   }
  // }, [gameState.time, gameState.location, gameState.day, view]);

  const [lastOutfitChangeDay, setLastOutfitChangeDay] = useState(0);

  // --- 监听时间和天数变化，5:50 时根据工作日/周末更换崔秀晶的服装 ---
  useEffect(() => {
    // 只有在 5:50 (350分钟) 之后且当天还没换过装时才触发
    if (gameState.time < 350 || lastOutfitChangeDay === gameState.day) return;

    const dateInfo = getCalendarDate(gameState.day);
    // 判断是否为工作日 (1-5)
    const isWorkday = dateInfo.dayOfWeek >= 1 && dateInfo.dayOfWeek <= 5;
    
    // 立即更新标记，防止重复进入
    setLastOutfitChangeDay(gameState.day);

    setGameState(prev => {
        const newNpcs = { ...prev.npcs };
        let changed = false;
        let changedOutfitName = "";

        // --- 崔秀晶换装 ---
        const sujeong = newNpcs[NPCId.SUJEONG];
        if (sujeong) {
            const targetType = isWorkday ? 'work' : 'casual';
            const available = SUJEONG_OUTFITS_DATA.filter(o => o.type === targetType);
            if (available.length > 0) {
                // 尽量选择一套不同的衣服
                const otherOutfits = available.filter(o => o.id !== sujeong.currentOutfitId);
                const randomOutfit = otherOutfits.length > 0 
                    ? otherOutfits[Math.floor(Math.random() * otherOutfits.length)]
                    : available[0];

                if (sujeong.currentOutfitId !== randomOutfit.id) {
                    newNpcs[NPCId.SUJEONG] = {
                        ...sujeong,
                        currentOutfitId: randomOutfit.id,
                        avatars: {}
                    };
                    changed = true;
                    changedOutfitName = randomOutfit.name;
                }
            }
        }

        if (!changed) return prev;

        return {
            ...prev,
            npcs: newNpcs
        };
    });

    // 将通知逻辑移出 setGameState
    const sujeong = gameState.npcs[NPCId.SUJEONG];
    if (sujeong) {
        const targetType = isWorkday ? 'work' : 'casual';
        const available = SUJEONG_OUTFITS_DATA.filter(o => o.type === targetType);
        if (available.length > 0) {
            const otherOutfits = available.filter(o => o.id !== sujeong.currentOutfitId);
            const randomOutfit = otherOutfits.length > 0 
                ? otherOutfits[Math.floor(Math.random() * otherOutfits.length)]
                : available[0];
            if (sujeong.currentOutfitId !== randomOutfit.id) {
                if (gameState.day > 1 || gameState.time > 350) {
                    setTimeout(() => showNotification(`👗 崔秀晶换上了: ${randomOutfit.name}`), 1000);
                }
            }
        }
    }
  }, [gameState.day, gameState.time, lastOutfitChangeDay]);

  const advanceTime = (minutes: number) => {
    setGameState(prev => {
        let newTime = prev.time + minutes;
        let newDay = prev.day;
        if (newTime >= 1440) {
            newTime -= 1440;
            newDay += 1;
        }
        return { ...prev, time: newTime, day: newDay };
    });
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // --- 参考图上传处理 ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && settingUploadTarget) {
      // 检查数量限制
      if (Object.values(NPCId).includes(settingUploadTarget as NPCId)) {
          if ((globalAssets[settingUploadTarget as NPCId] || []).length >= 5) {
              showNotification("⚠️ 最多只能上传 5 张参考图");
              return;
          }
      } else {
          if ((sceneRefImages[settingUploadTarget] || []).length >= 5) {
              showNotification("⚠️ 最多只能上传 5 张参考图");
              return;
          }
      }

      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        
        if (Object.values(NPCId).includes(settingUploadTarget as NPCId)) {
            const newData = [...(globalAssets[settingUploadTarget as NPCId] || []), result];
            await saveAssetToDB(settingUploadTarget, newData);
            setGlobalAssets(prev => ({ ...prev, [settingUploadTarget]: newData }));
        } else {
            const newData = [...(sceneRefImages[settingUploadTarget] || []), result];
            await saveAssetToDB(settingUploadTarget, newData);
            setSceneRefImages(prev => ({ ...prev, [settingUploadTarget]: newData }));
        }
        
        setIsUploading(false);
        showNotification(`${settingUploadTarget} 的参考图上传成功`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAsset = async (targetId: string, index: number) => {
      if (Object.values(NPCId).includes(targetId as NPCId)) {
          const currentAssets = globalAssets[targetId as NPCId] || [];
          const newData = currentAssets.filter((_, i) => i !== index);
          await saveAssetToDB(targetId, newData);
          setGlobalAssets(prev => ({ ...prev, [targetId]: newData }));
      } else {
          const currentAssets = sceneRefImages[targetId] || [];
          const newData = currentAssets.filter((_, i) => i !== index);
          await saveAssetToDB(targetId, newData);
          setSceneRefImages(prev => ({ ...prev, [targetId]: newData }));
      }
      showNotification("图片已删除");
  };

  const handleStartNewGame = async () => {
    if (!hasApiKey) {
        showNotification("⚠️ 请先配置 API Key");
        return;
    }

    // 重置游戏状态为初始状态
    // 深拷贝初始 NPC 数据，避免直接修改常量
    const initialNpcs = JSON.parse(JSON.stringify(INITIAL_NPCS));
    
    // 随机化初始服装 (崔秀晶)
    const dateInfo = getCalendarDate(1);
    const isWorkday = dateInfo.dayOfWeek >= 1 && dateInfo.dayOfWeek <= 5;
    const sujeongTargetType = isWorkday ? 'work' : 'casual';
    const sujeongAvailable = SUJEONG_OUTFITS_DATA.filter(o => o.type === sujeongTargetType);
    if (sujeongAvailable.length > 0) {
        const randomOutfit = sujeongAvailable[Math.floor(Math.random() * sujeongAvailable.length)];
        initialNpcs[NPCId.SUJEONG].currentOutfitId = randomOutfit.id;
    }

    // 宋智贤不再随机化初始服装，使用默认的第一套
    initialNpcs[NPCId.JIHYUN].currentOutfitId = JIHYUN_OUTFITS_DATA[0].id;

    const initialState: GameState = {
        time: INITIAL_TIME, 
        day: 1, 
        location: LocationType.HOME,
        stats: { money: 150, hunger: 80, thirst: 80, stamina: 100, intelligence: 50, appearance: 70 },
        inventory: [], 
        deliveries: [], 
        npcs: initialNpcs,
        phone: { contacts: [NPCId.KUANZE, NPCId.MOM], pendingRequests: [], messages: {}, isOpen: false, app: null },
        currentDialogue: { active: false, npcId: null, history: [], currentEmotion: 'neutral', isCinematic: false },
        backgroundUrl: "https://picsum.photos/1920/1080", // 初始给一个默认背景，防止空值
        bgCache: {}, 
        sceneLayout: {}, 
        isClassStarted: false
    };

    setGameState(initialState);
    setView('game');
    
    // 使用新的初始状态进行初始化，避免闭包中的旧状态导致的问题
    try {
        await initializeLocation(LocationType.HOME, initialState);
    } catch (e: any) {
        console.error("Critical error starting game:", e?.message || "Unknown error");
        showNotification("游戏启动失败，请重试");
        setView('menu'); // 只有在严重失败时才退回菜单
    }
  };

  const handleLoadGame = async (slotId: number) => {
      const saved = await loadGameStateFromDB(slotId);
      if (saved) {
          setGameState(prev => ({ ...prev, ...saved }));
          setView('game');
          showNotification(`✅ 已读取存档 ${slotId}`);
          // 重新初始化场景以恢复画面
          await initializeLocation(saved.location, saved);
      } else {
          showNotification("❌ 读取存档失败");
      }
  };

  const handleSaveGame = async (slotId: number) => {
      await saveGameStateToDB(gameState, slotId);
      const saves = await getAllSaves();
      setSaveSlots(saves);
      showNotification(`✅ 游戏已保存至存档 ${slotId}`);
  };

// ...

  const initializeLocation = async (loc: LocationType, state: GameState) => {
    if (isProcessing) return;
    
    try {
        setIsProcessing(true);
        setLoadingScene(true);
        showNotification(`正在进入 ${loc}...`);
        
        const presentNPCs = Object.values(state.npcs).filter(n => n.currentLocation === loc);
        const mainNpc = presentNPCs[0] || null;
        let avatarBase64: string | null = null;
        let avatarUrl = "";
        let npcRefs: string[] = [];

        // 1. 准备参数和缓存检查
        if (mainNpc) {
            npcRefs = await getNPCRefs(mainNpc.id);
            if (mainNpc.avatars && mainNpc.avatars.neutral) {
                // 如果已经有缓存的常态立绘，直接使用
                avatarUrl = mainNpc.avatars.neutral;
                if (avatarUrl.startsWith('data:image')) {
                    avatarBase64 = avatarUrl.split('base64,')[1];
                }
            } else if (npcRefs[0]) {
                // 如果没有立绘，但有用户上传的参考图，先用参考图作为场景生成的输入
                avatarBase64 = npcRefs[0].split('base64,')[1];
            }
        }

        const sceneRefs = await getSceneRefs(loc);
        const userSceneBg = sceneRefs[0] ? sceneRefs[0].split('base64,')[1] : null;

        // 移动地点消耗时间
        advanceTime(15);

        // 2. 顺序生成头像和场景 (确保场景使用生成的头像作为参考)
        if (mainNpc && !avatarUrl) {
            try {
                showNotification(`正在准备 ${mainNpc.name} 的形象...`);
                avatarUrl = await generateNPCImage(mainNpc, 'neutral', loc, npcRefs);
                if (avatarUrl && avatarUrl.startsWith('data:image')) {
                    avatarBase64 = avatarUrl.split('base64,')[1];
                }
            } catch (err: any) {
                console.warn("NPC Image generation failed", err);
            }
        }

        let bg = gameState.backgroundUrl;
        try {
            showNotification(`正在渲染 ${loc} 场景...`);
            const generatedBg = await generateSceneImage(loc, mainNpc, avatarBase64, state.time, "", false, userSceneBg, 'neutral', state.day);
            if (generatedBg) bg = generatedBg;
        } catch (err: any) {
            console.warn("Scene generation failed", err);
        }
        
        setGameState(prev => ({ 
            ...prev, 
            location: loc, 
            backgroundUrl: bg,
            // 修复：重新进入场景时重置聊天界面
            currentDialogue: { active: false, npcId: null, history: [], currentEmotion: 'neutral', isCinematic: false }, 
            npcs: mainNpc ? { 
                ...prev.npcs, 
                [mainNpc.id]: { 
                    ...mainNpc, 
                    avatars: { 
                        neutral: avatarUrl || (mainNpc.avatars && mainNpc.avatars.neutral) || mainNpc.avatarUrl || "" 
                    } 
                } 
            } : prev.npcs
        }));
    } catch (error: any) {
        console.error("Failed to initialize location:", error?.message || "Unknown error");
        showNotification("场景加载遇到问题，已恢复默认状态");
    } finally {
        setLoadingScene(false);
        setIsProcessing(false);
    }
  };

// --- 交互逻辑：开始对话 ---
  const startDialogue = async (npcId: NPCId) => {
    if (isProcessing) return; // 防止重复触发
    
    try {
        const npc = gameState.npcs[npcId];
        if (!npc) {
            showNotification("无法找到该角色");
            return;
        }

        // 修复：如果当前已有与该角色的对话历史，直接恢复，不重新生成问候语
        if (gameState.currentDialogue.npcId === npcId && gameState.currentDialogue.history.length > 0) {
            setGameState(prev => ({
                ...prev,
                currentDialogue: { ...prev.currentDialogue, active: true }
            }));
            return;
        }

        setIsProcessing(true);
        setLoadingScene(true);
        showNotification("正在思考问候语...");

        // 1. 生成问候语
        const greeting = await generateGreeting(gameState, npcId);
        const emotion = greeting.emotion || 'neutral';

        showNotification("正在生成角色表情...");
        // 2. 强制生成当前表情的 NPC 头像 (Instant Generation)
        // 不使用缓存，总是重新生成
        const npcRefs = await getNPCRefs(npcId);
        const avatarUrl = await generateNPCImage(npc, emotion, gameState.location, npcRefs);
        
        let avatarBase64: string | null = null;
        if (avatarUrl && avatarUrl.startsWith('data:image')) {
            avatarBase64 = avatarUrl.split('base64,')[1];
        } else if (npcRefs[0]) {
            // 如果生成失败或返回的是 URL，尝试使用原始参考图作为场景生成的输入
            avatarBase64 = npcRefs[0].split('base64,')[1];
        }

        // 3. 准备场景参考图
        const sceneRefs = await getSceneRefs(gameState.location);
        const userSceneBg = sceneRefs[0] ? sceneRefs[0].split('base64,')[1] : null;

        showNotification("正在生成场景特写...");
        // 4. 重新生成场景图 (Active/对话状态 - Close up)
        // 第一次对话生成特写场景，增强代入感
        const bg = await generateSceneImage(gameState.location, npc, avatarBase64, gameState.time, "", true, userSceneBg, emotion, gameState.day);

        setGameState(prev => {
            const currentNpc = prev.npcs[npcId];
            if (!currentNpc) return prev;

            return {
                ...prev,
                backgroundUrl: bg || prev.backgroundUrl, 
                npcs: {
                    ...prev.npcs,
                    [npcId]: {
                        ...currentNpc,
                        avatars: { 
                            neutral: (currentNpc.avatars && currentNpc.avatars.neutral) || currentNpc.avatarUrl || "",
                            [emotion]: avatarUrl || ""
                        }
                    }
                },
                currentDialogue: { 
                    active: true, 
                    npcId, 
                    history: [{ sender: 'npc', content: greeting.text || "......", timestamp: Date.now() }], 
                    currentEmotion: emotion, 
                    isCinematic: false 
                }
            };
        });
        
    } catch (error: any) {
        console.error("Failed to start dialogue:", error?.message || "Unknown error");
        showNotification("对话启动失败，请重试");
    } finally {
        setLoadingScene(false);
        setIsProcessing(false);
    }
  };

  // --- 交互逻辑：处理玩家输入 ---
  const handleDialogueInput = async (text: string, targetId?: NPCId) => {
    if (isProcessing) return; // 防止并发请求导致崩溃
    
    const npcId = targetId || gameState.currentDialogue.npcId;
    if (!npcId || !gameState.npcs[npcId]) {
        console.error("No active NPC for dialogue");
        showNotification("❌ 对话异常，请重新开启");
        return;
    }

    const trimmedText = text.trim();
    const actionFromInput = actionInput.trim();
    
    // 尝试从对话文本中提取动作模式 (动作: ...)
    const actionFromTextMatch = trimmedText.match(/[（(]动作[:：]\s*(.*?)[)）]/);
    const actionFromText = actionFromTextMatch ? actionFromTextMatch[1] : null;
    
    const savedAction = actionFromInput || actionFromText || "";
    
    // 如果既没有动作也没有文字，不处理
    if (!trimmedText && !savedAction) return;

    setIsProcessing(true);
    
    // 构造完整输入内容：包含动作（如果有）和对话文本
    const hasAction = !!savedAction;
    let fullInput = trimmedText;
    if (actionFromInput) {
        fullInput = trimmedText ? `(动作: ${actionFromInput}) ${trimmedText}` : `(动作: ${actionFromInput})`;
        setActionInput(''); // 发送后清空动作输入
    }
    // 如果是从文本中提取的，fullInput 已经包含了该文本，不需要额外构造
    
    // 1. 立即显示玩家输入
    setGameState(prev => {
        // 如果是手机聊天，更新手机消息记录
        if (targetId) {
             const currentMessages = (prev.phone && prev.phone.messages && prev.phone.messages[targetId]) || [];
             return {
                 ...prev,
                 phone: {
                     ...(prev.phone || { contacts: [], pendingRequests: [], messages: {}, isOpen: false, app: null }),
                     messages: {
                         ...(prev.phone?.messages || {}),
                         [targetId]: [...currentMessages, { sender: 'player', content: fullInput, timestamp: Date.now() }]
                     }
                 }
             };
        }

        // 否则更新当前对话历史
        return { 
            ...prev, 
            currentDialogue: { 
                ...prev.currentDialogue, 
                history: [...(prev.currentDialogue.history || []), { sender: 'player', content: fullInput, timestamp: Date.now() }] 
            } 
        };
    });
    
    try {
        showNotification("正在生成回复...");
        // 2. 生成回复
        // 传递当前对话历史给 AI，以便记住上下文
        const currentHistory = targetId 
            ? ((gameState.phone && gameState.phone.messages[targetId]) || []) 
            : (gameState.currentDialogue.history || []);
            
        const result = await generateDialogue(gameState, npcId, fullInput, currentHistory);
        
        // 对话消耗时间
        advanceTime(5);

        // 3. 安全检查：确保回复内容有效
        const replyText = result?.text || "......";
        const rawEmotion = result?.emotion || "neutral";
        
        // 尝试从回复中提取括号内的神态描述
        const bracketMatch = replyText.match(/[（(](.*?)[)）]/);
        const bracketContent = bracketMatch ? bracketMatch[1] : null;
        const emotion = (bracketContent || rawEmotion).toLowerCase();
        
        // 4. 更新对话历史、好感度和 AI 记忆
        const affectionChange = result?.affectionChange || 0;
        if (affectionChange !== 0) {
            showNotification(`${gameState.npcs[npcId]?.name} 的好感度 ${affectionChange > 0 ? '+' : ''}${affectionChange}`);
        }

        setGameState(prev => {
            const currentNpc = prev.npcs[npcId];
            if (!currentNpc) return prev;
            
            const newAffection = Math.max(0, Math.min(100, currentNpc.affection + affectionChange));

            // 更新 AI 记忆：追加新对话，保留更长的上下文 (5000字符)
            // 只有当 memory 还没包含这段对话时才追加
            const newEntry = `\nPlayer: ${fullInput}\nNPC: ${replyText}`;
            const newMemory = ((currentNpc.dialogueMemory || "") + newEntry).slice(-5000);

            // 如果是手机聊天，更新手机消息
            if (targetId) {
                const currentMessages = (prev.phone && prev.phone.messages && prev.phone.messages[targetId]) || [];
                return {
                    ...prev,
                    npcs: {
                        ...prev.npcs,
                        [npcId]: {
                            ...currentNpc,
                            affection: newAffection,
                            dialogueMemory: newMemory
                        }
                    },
                    phone: {
                        ...(prev.phone || { contacts: [], pendingRequests: [], messages: {}, isOpen: false, app: null }),
                        messages: {
                            ...(prev.phone?.messages || {}),
                            [targetId]: [...currentMessages, { sender: 'npc', content: replyText, timestamp: Date.now() }]
                        }
                    }
                };
            }

            return { 
                ...prev, 
                npcs: {
                    ...prev.npcs,
                    [npcId]: {
                        ...currentNpc,
                        affection: newAffection,
                        dialogueMemory: newMemory
                    }
                },
                currentDialogue: { 
                    ...prev.currentDialogue, 
                    history: [...(prev.currentDialogue.history || []), { sender: 'npc', content: replyText, timestamp: Date.now() }], 
                    currentEmotion: emotion 
                } 
            };
        });

        // 如果是手机聊天，不需要生成场景和头像更新
        if (targetId) return;


        showNotification("正在生成新表情...");
        // 5. 生成新头像 (使用常态立绘作为参考)
        let avatarUrl = "";
        try {
            const currentNpc = gameState.npcs[npcId];
            if (currentNpc) {
                // 关键：将当前的常态立绘作为参考图传入，确保一致性
                const npcRefs = await getNPCRefs(npcId);
                const neutralRef = currentNpc.avatars?.neutral ? [currentNpc.avatars.neutral] : npcRefs;
                avatarUrl = await generateNPCImage(currentNpc, emotion, gameState.location, neutralRef, bracketContent || "");
            }
        } catch (e: any) {
            console.warn("Failed to generate NPC avatar:", e?.message || "Unknown error");
        }
        
        // 6. 只有当玩家执行了动作时，才重新生成场景
        let newBackgroundUrl = gameState.backgroundUrl;
        console.log("[Game] hasAction:", hasAction, "avatarUrl exists:", !!avatarUrl);
        if (hasAction && avatarUrl && gameState.npcs[npcId]) {
            try {
                showNotification("正在生成动作场景...");
                let avatarBase64: string | null = null;
                // 优先使用刚刚生成的、带表情的立绘作为参考，确保场景中的人物形象一致
                if (avatarUrl && avatarUrl.startsWith('data:image')) {
                    avatarBase64 = avatarUrl.split('base64,')[1];
                } else {
                    console.log("[Game] avatarUrl is not data:image, falling back to neutral/refs");
                    // 如果生成失败，回退到常态立绘或参考图
                    const neutralUrl = (gameState.npcs[npcId].avatars && gameState.npcs[npcId].avatars.neutral) || gameState.npcs[npcId].avatarUrl;
                    if (neutralUrl && neutralUrl.startsWith('data:image')) {
                        avatarBase64 = neutralUrl.split('base64,')[1];
                    } else {
                        const npcRefs = await getNPCRefs(npcId);
                        if (npcRefs[0]) {
                            avatarBase64 = npcRefs[0].split('base64,')[1];
                        }
                    }
                }

                const sceneRefs = await getSceneRefs(gameState.location);
                const userSceneBg = sceneRefs[0] && sceneRefs[0].includes('base64,') ? sceneRefs[0].split('base64,')[1] : null;
                
                // --- 关键改进：使用 AI 分析复杂的互动场景 ---
                console.log("[Game] Calling analyzeSceneAction with:", savedAction);
                showNotification("正在分析场景细节...");
                const interactionPrompt = await analyzeSceneAction(
                    gameState.location,
                    gameState.npcs[npcId]?.name || "NPC",
                    savedAction,
                    replyText
                );
                
                console.log("[Game] Interaction Prompt:", interactionPrompt);
                const bg = await generateSceneImage(gameState.location, gameState.npcs[npcId], avatarBase64, gameState.time, interactionPrompt, true, userSceneBg, emotion, gameState.day);
                console.log("[Game] Generated Background URL:", bg?.substring(0, 50) + "...");
                if (bg) newBackgroundUrl = bg;
            } catch (e: any) {
                console.warn("Failed to regenerate scene on action:", e?.message || "Unknown error");
            }
        }

        // 7. 更新状态 (采用局部更新，确保 neutral 不丢失)
        if (avatarUrl && avatarUrl.length > 10) {
            setGameState(prev => {
                const currentNpc = prev.npcs[npcId];
                if (!currentNpc) return prev;
                
                return {
                    ...prev,
                    backgroundUrl: newBackgroundUrl || prev.backgroundUrl, 
                    npcs: {
                        ...prev.npcs,
                        [npcId]: {
                            ...currentNpc,
                            avatars: { 
                                neutral: (currentNpc.avatars && currentNpc.avatars.neutral) || currentNpc.avatarUrl || "",
                                [emotion]: avatarUrl || ""
                            } 
                        }
                    }
                };
            });
        } else if (hasAction) {
            setGameState(prev => ({ ...prev, backgroundUrl: newBackgroundUrl || prev.backgroundUrl }));
        }
    } catch (e: any) {
        console.error("Dialogue input error:", e?.message || "Unknown error");
        showNotification("AI 响应超时或出错，请稍后再试");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- UI 格式化工具 ---
  const formatTime = (min: number) => {
      const h = Math.floor(min / 60).toString().padStart(2, '0');
      const m = (min % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
  };

  const getTimeIcon = () => {
      const h = gameState.time / 60;
      if (h >= 5 && h < 18) return '☀️'; // 白天 (从 5:00 开始)
      if (h >= 18 && h < 20) return '🌇'; // 傍晚
      return '🌙'; // 夜晚
  };

  // --- 渲染逻辑 ---
  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans select-none">
      {/* 动态背景层 */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000" 
        style={{ backgroundImage: `url(${gameState.backgroundUrl})` }} 
      />
      
      {/* 顶部 HUD (状态栏) */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-30">
          <div className="bg-black/60 backdrop-blur p-4 rounded-xl border border-white/10 text-white flex items-center gap-4">
              <div className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
                  <span>{getTimeIcon()}</span> {formatTime(gameState.time)}
              </div>
              <div className="w-[1px] h-10 bg-white/20"></div>
              <div className="text-sm">
                  <div className="text-cyan-400 font-bold">
                    {getCalendarDate(gameState.day).year}年{getCalendarDate(gameState.day).month}月{getCalendarDate(gameState.day).day}日 {getCalendarDate(gameState.day).weekday}
                  </div>
                  <div className="text-gray-400">{gameState.location}</div>
              </div>
          </div>
          
          <div className="flex gap-2">
             <button 
                onClick={() => setView('save_game')}
                className="bg-green-800 text-white p-3 rounded-full border border-white/10 shadow-lg hover:scale-110 transition"
                title="保存游戏"
             >
                💾
             </button>
             <button 
                onClick={() => setGameState(p => ({...p, phone: {...(p.phone || { contacts: [], pendingRequests: [], messages: {}, app: null }), isOpen: true}}))} 
                className="bg-slate-800 text-white p-3 rounded-full border border-white/10 shadow-lg hover:scale-110 transition"
                title="手机"
             >
                📱
             </button>
             <button 
                onClick={() => setView('menu')}
                className="bg-red-800 text-white p-3 rounded-full border border-white/10 shadow-lg hover:scale-110 transition"
                title="返回主菜单"
             >
                🏠
             </button>
          </div>
      </div>

      {/* ... (加载动画) ... */}
      {loadingScene && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white text-2xl gap-4 animate-pulse">
              <div className="animate-spin text-4xl">⏳</div>
              加载场景中...
          </div>
      )}

      {/* ... (地点切换按钮) ... */}
      {!gameState.currentDialogue.active && !gameState.phone?.isOpen && view === 'game' && (
          <div className="absolute bottom-6 left-6 z-30 flex flex-col gap-2">
              {[
                LocationType.HOME, 
                LocationType.CLASSROOM, 
                LocationType.OFFICE, 
                LocationType.MUSIC_ROOM, 
                LocationType.CAFETERIA, 
                LocationType.COMMERCIAL_STREET
              ].map(loc => (
                  <button 
                    key={loc} 
                    onClick={() => initializeLocation(loc, gameState)} 
                    className={`px-4 py-2 rounded-lg text-sm border transition ${
                        gameState.location === loc 
                        ? 'bg-cyan-900 border-cyan-400 text-cyan-200' 
                        : 'bg-black/60 border-white/20 text-white hover:bg-cyan-700'
                    }`}
                  >
                      {loc}
                  </button>
              ))}
          </div>
      )}

      {/* ... (NPC 互动触发区域) ... */}
      {!gameState.currentDialogue.active && !gameState.phone?.isOpen && view === 'game' && (
          <div className="absolute inset-0 z-20 flex justify-center items-center pointer-events-none">
              {Object.values(gameState.npcs)
                .filter(n => n.currentLocation === gameState.location)
                .map(n => (
                  <button 
                    key={n.id} 
                    onClick={() => startDialogue(n.id)} 
                    className="pointer-events-auto w-1/3 h-full group flex flex-col items-center justify-end pb-20 hover:bg-white/5 transition"
                  >
                      <div className="bg-black/60 text-white px-4 py-2 rounded-full border border-cyan-500 opacity-0 group-hover:opacity-100 transition shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                          与 {n.name} 交谈
                      </div>
                  </button>
              ))}
          </div>
      )}

      {/* ... (对话系统覆盖层) ... */}
      {gameState.currentDialogue.active && gameState.currentDialogue.npcId && gameState.npcs[gameState.currentDialogue.npcId] && view === 'game' && (
          <div className="absolute inset-0 z-40 bg-black/40 flex flex-col justify-end items-center pb-10 pointer-events-none">
              
              {/* 1. 人物立绘 (位于对话框左侧，不遮挡场景) */}
              <div className="absolute left-0 bottom-0 z-10 pointer-events-auto flex flex-col items-center">
                  <div className="h-[65vh] aspect-[3/4] relative filter drop-shadow-2xl origin-bottom-left transition-all duration-500">
                      {(() => {
                          const npcId = gameState.currentDialogue.npcId;
                          const npc = npcId ? gameState.npcs[npcId] : null;
                          const emotion = gameState.currentDialogue.currentEmotion || 'neutral';
                          const displayUrl = npc?.avatars?.[emotion] || npc?.avatars?.neutral || npc?.avatarUrl;
                          
                          return displayUrl ? (
                              <img 
                                src={displayUrl} 
                                className="w-full h-full object-cover rounded-tr-3xl border-r-2 border-t-2 border-white/20 shadow-2xl" 
                                alt="avatar"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                    // 如果当前头像加载失败，尝试回退到默认头像
                                    const target = e.target as HTMLImageElement;
                                    if (npc?.avatarUrl && target.src !== npc.avatarUrl) {
                                        target.src = npc.avatarUrl;
                                    }
                                }}
                              />
                          ) : (
                              <div className="w-full h-full bg-black/50 rounded-tr-3xl flex items-center justify-center text-6xl border-r-2 border-t-2 border-white/20">👤</div>
                          );
                      })()}
                      
                      {/* 表情状态指示器已移除，避免遮挡人物 */}
                  </div>
              </div>

              {/* 2. 对话框 (位于底部，向右偏移以避开立绘) */}
              <div className="relative z-20 w-full max-w-6xl px-4 pb-8 pl-[35vh] pointer-events-auto">
                  
                  <div className="bg-slate-900/95 border-2 border-cyan-500/50 p-6 rounded-3xl text-white shadow-2xl relative">
                      <div className="text-cyan-400 font-bold text-xl mb-2 flex justify-between">
                          <span>{gameState.npcs[gameState.currentDialogue.npcId]?.name || 'Unknown'}</span>
                          <span className="text-xs text-gray-500">好感度: {gameState.npcs[gameState.currentDialogue.npcId]?.affection || 0}</span>
                      </div>
                      <div className="h-32 overflow-y-auto mb-4 border-b border-white/10 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-cyan-900">
                          {(gameState.currentDialogue.history || []).slice(-3).map((m, i) => (
                              <div key={i} className={`${m.sender === 'player' ? 'text-cyan-300 italic text-right' : 'text-white'}`}>
                                  {m.content}
                              </div>
                          ))}
                      </div>
                      
                      {/* 输入区域：动作 + 对话 */}
                      <div className="flex flex-col gap-2">
                          {/* 动作输入框 */}
                          <input 
                            value={actionInput}
                            onChange={e => setActionInput(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-yellow-200 focus:border-yellow-500 outline-none transition placeholder-white/30" 
                            placeholder="动作描述 (选填，如: 紧紧抱住她、轻抚脸颊)..." 
                          />
                          
                          {/* 对话输入框 */}
                          <div className="flex gap-2">
                              <input 
                                onKeyDown={e => { 
                                    if(e.key === 'Enter' && !isProcessing) { 
                                        const val = e.currentTarget.value;
                                        e.currentTarget.value = ''; 
                                        handleDialogueInput(val); 
                                    } 
                                }} 
                                disabled={isProcessing}
                                className={`flex-1 bg-black/40 border border-white/20 rounded p-3 text-sm focus:border-cyan-500 outline-none transition ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                placeholder={isProcessing ? "AI 正在思考中..." : "输入你的回复..."} 
                              />
                              <button 
                                onClick={() => {
                                    if (isProcessing) return;
                                    // 离开对话时，不再重新加载场景，保持当前状态
                                    setGameState(p => ({...p, currentDialogue: {...p.currentDialogue, active: false}}));
                                }} 
                                disabled={isProcessing}
                                className={`bg-red-900/80 px-6 rounded text-sm hover:bg-red-800 transition border border-red-700/50 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                离开
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 手机系统接口 */}
      {gameState.phone?.isOpen && view === 'game' && (
          <PhoneInterface 
            gameState={gameState}
            onClose={() => setGameState(p => ({...p, phone: {...p.phone, isOpen: false}}))}
            onSendMessage={(id, text) => handleDialogueInput(text, id)}
            onAddContact={() => {}}
            onBuyItem={(item) => {}}
            onConsumeItem={(item) => {}}
            setPhoneApp={(app) => setGameState(p => ({...p, phone: {...p.phone, app}}))}
          />
      )}

      {/* 主菜单 */}
      {view === 'menu' && (
          <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white">
              <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 mb-10">
                  商丘一高：悸动青春
              </h1>
              <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleStartNewGame} 
                    className="bg-cyan-600 px-12 py-4 rounded-xl text-2xl font-bold shadow-lg shadow-cyan-900 hover:bg-cyan-500 transition active:scale-95"
                  >
                      开始新游戏
                  </button>
                  <button 
                    onClick={() => setView('load_game')} 
                    className="bg-emerald-700 px-12 py-3 rounded-xl text-xl font-bold shadow-lg shadow-emerald-900 hover:bg-emerald-600 transition active:scale-95"
                  >
                      读取存档
                  </button>
                  <button 
                    onClick={() => setView('settings')} 
                    className="bg-purple-700 px-12 py-3 rounded-xl text-xl font-bold shadow-lg shadow-purple-900 hover:bg-purple-600 transition active:scale-95"
                  >
                      资源设定 (角色 & 场景)
                  </button>
                  <button 
                    onClick={() => { clearAllAssets(); window.location.reload(); }} 
                    className="text-gray-500 text-sm hover:text-red-400 transition"
                  >
                      重置所有数据
                  </button>
              </div>
          </div>
      )}

      {/* 存档/读档界面 */}
      {(view === 'load_game' || view === 'save_game') && (
          <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center text-white p-8">
              <h2 className="text-4xl font-bold mb-8 text-cyan-400">
                  {view === 'load_game' ? '读取进度' : '保存进度'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                  {[1, 2, 3].map(slot => (
                      <button
                          key={slot}
                          onClick={() => view === 'load_game' ? handleLoadGame(slot) : handleSaveGame(slot)}
                          className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition flex flex-col gap-4 group relative overflow-hidden"
                      >
                          <div className="text-2xl font-bold text-gray-500 group-hover:text-cyan-400">存档 {slot}</div>
                          {saveSlots[slot] ? (
                              <>
                                  <div className="text-lg text-white">{saveSlots[slot].summary}</div>
                                  <div className="text-sm text-gray-400">
                                      {new Date(saveSlots[slot].timestamp).toLocaleString()}
                                  </div>
                              </>
                          ) : (
                              <div className="text-gray-600 py-4">空存档</div>
                          )}
                          <div className="absolute inset-0 border-2 border-cyan-500/0 group-hover:border-cyan-500/50 rounded-xl transition-all"></div>
                      </button>
                  ))}
              </div>
              <button 
                  onClick={() => setView(view === 'load_game' ? 'menu' : 'game')}
                  className="mt-12 text-gray-400 hover:text-white px-8 py-2 border border-white/20 rounded-full"
              >
                  返回
              </button>
          </div>
      )}
      
      {/* 资源设置界面 */}
      {view === 'settings' && (
        <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col p-8 text-white overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-cyan-400">资源设定</h2>
                <button onClick={() => setView('menu')} className="text-gray-400 hover:text-white">返回菜单</button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
                <button 
                    onClick={() => setSettingsTab('npc')}
                    className={`px-6 py-2 rounded-lg transition ${settingsTab === 'npc' ? 'bg-cyan-600 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                    人物立绘
                </button>
                <button 
                    onClick={() => setSettingsTab('scene')}
                    className={`px-6 py-2 rounded-lg transition ${settingsTab === 'scene' ? 'bg-cyan-600 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                    场景背景
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {settingsTab === 'npc' ? (
                    Object.values(gameState.npcs).map(npc => (
                        <div key={npc.id} className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">{npc.name}</h3>
                                <span className="text-xs text-gray-500">{npc.role}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {(globalAssets[npc.id] || []).map((img, idx) => (
                                    <div key={idx} className="aspect-[3/4] bg-black/40 rounded-lg overflow-hidden relative group">
                                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        <button 
                                            onClick={() => handleDeleteAsset(npc.id, idx)}
                                            className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                                            title="删除"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {/* 上传按钮占位符，如果未满5张 */}
                                {(globalAssets[npc.id] || []).length < 5 && (
                                    <button 
                                        onClick={() => { setSettingUploadTarget(npc.id); fileInputRef.current?.click(); }}
                                        className="aspect-[3/4] bg-white/5 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center hover:bg-white/10 transition"
                                    >
                                        <span className="text-2xl text-gray-400">+</span>
                                        <span className="text-[10px] text-gray-400 mt-1">上传</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-2">{npc.description}</p>
                        </div>
                    ))
                ) : (
                    Object.values(LocationType).map(loc => (
                        <div key={loc} className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">{loc}</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {(sceneRefImages[loc] || []).map((img, idx) => (
                                    <div key={idx} className="aspect-video bg-black/40 rounded-lg overflow-hidden relative group">
                                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        <button 
                                            onClick={() => handleDeleteAsset(loc, idx)}
                                            className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                                            title="删除"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {/* 上传按钮占位符，如果未满5张 */}
                                {(sceneRefImages[loc] || []).length < 5 && (
                                    <button 
                                        onClick={() => { setSettingUploadTarget(loc); fileInputRef.current?.click(); }}
                                        className="aspect-video bg-white/5 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center hover:bg-white/10 transition"
                                    >
                                        <span className="text-2xl text-gray-400">+</span>
                                        <span className="text-[10px] text-gray-400 mt-1">上传</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload} 
            />
            
            {isUploading && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
                    <div className="animate-spin text-4xl">⏳</div>
                </div>
            )}
        </div>
      )}
      
      {/* 浮动通知栏 */}
      {notification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-6 py-2 rounded-full border border-cyan-500 text-sm animate-bounce">
            {notification}
        </div>
      )}
    </div>
  );
};

export default App;
