import { Item, LocationType, NPC, NPCId, RelationLevel, Outfit } from './types';

// --- 时间常数 ---
export const INITIAL_TIME = 350; // 5:50 AM
export const SCHOOL_START = 350;
export const SCHOOL_END = 1265;

// --- 24小时动态光效预设 (Atmosphere) ---
export const LIGHTING_PRESETS = {
  DAWN: "Early morning (5-7 AM). Soft pale blue light, morning mist, low contrast, serene.",
  MORNING: "Bright morning (7-11 AM). Crisp natural daylight, high clarity, energetic.",
  NOON: "Noon (11 AM - 2 PM). Harsh overhead sun, high contrast, vivid colors.",
  AFTERNOON: "Afternoon (2-5 PM). Warm yellow sunlight, long shadows, relaxed vibe.",
  GOLDEN_HOUR: "Sunset (5-7 PM). Deep amber and orange glow, Tyndall effect, long dramatic shadows, romantic.",
  EVENING: "Evening (7-10 PM). Dim twilight outside, warm artificial indoor lighting, cozy and soft.",
  NIGHT: "Night (10 PM - 4 AM). Cool moonbeams, sharp indoor highlights from lamps, mysterious and quiet."
};

// --- 路人背景上下文 (Crowd Logic) ---
export const LOCATION_CROWD_CONTEXT: Partial<Record<LocationType, string>> = {
  [LocationType.SCHOOL_GATE]: "Dozens of students in Henan-style blue and white tracksuit uniforms are walking through the gate or chatting in groups nearby.",
  [LocationType.CAFETERIA]: "The background is filled with blurred students in blue and white tracksuit uniforms holding food trays, sitting at tables, and moving around.",
  [LocationType.CLASSROOM]: "Other students in blue and white tracksuit uniforms are sitting at their desks, some studying, others whispering in the background.",
  [LocationType.COMMERCIAL_STREET]: "A lively crowd of pedestrians, shoppers, and students in blue and white tracksuit uniforms walking along the sidewalk.",
};

// --- 全局画风设定 ---
export const ART_STYLE_GLOBAL = "Top-tier Korean Webtoon style, semi-realistic, highly detailed digital painting, sharp highlights. Korean manhwa style, 2.5D rendering, sharp vector lines, photorealistic, cinematic lighting.";
export const ART_STYLE_PROMPT = `${ART_STYLE_GLOBAL} Use side lighting, Rembrandt lighting. Strict facial consistency.`;
export const ART_STYLE_CHARACTER_ADDON = "Focus on facial features and expressive eyes. High-quality digital painting.";

// --- 地点基础描述 ---
export const LOCATION_PROMPTS: Record<LocationType, string> = {
  [LocationType.HOME]: "Bedroom.",
  [LocationType.SCHOOL_GATE]: "School Gate.",
  [LocationType.CLASSROOM]: "Classroom.",
  [LocationType.OFFICE]: "Teacher Office.",
  [LocationType.CAFETERIA]: "Cafeteria.",
  [LocationType.COMMERCIAL_STREET]: "Street.",
  [LocationType.CINEMA]: "Cinema.",
  [LocationType.PARK]: "Park.",
  [LocationType.SUJEONG_HOME]: "Living Room.",
  [LocationType.MUSIC_ROOM]: "Music Room.",
};

// --- 地点行为与镜头公式 ---
export const LOCATION_BEHAVIOR_PROMPTS: Record<LocationType, { idle: { visual: string, formula: string }; active: { visual: string, formula: string } }> = {
  [LocationType.MUSIC_ROOM]: {
    idle: {
      visual: "The piano teacher is sitting at the piano, looking out the window pensively.",
      formula: "PLAYER POS: Doorway + PERSPECTIVE: Wide Shot."
    },
    active: {
      visual: "The teacher is sitting on the piano bench, leaning slightly towards the player, smiling elegantly.",
      formula: "PLAYER POS: Standing by the piano + PERSPECTIVE: Close up."
    }
  },
  [LocationType.OFFICE]: {
    idle: { visual: "Choi Su-jeong sitting on a chair, desk in front of her.", formula: "First-person POV from door." },
    active: { visual: "Choi Su-jeong turning chair to face camera, legs crossed.", formula: "First-person POV close-up." }
  },
  [LocationType.CLASSROOM]: {
    idle: { visual: "Teacher at podium or students studying.", formula: "POV from back row." },
    active: { visual: "Character standing by the player's desk.", formula: "High-angle looking up." }
  },
  [LocationType.CAFETERIA]: {
    idle: { visual: "Busy cafeteria crowd.", formula: "Wide shot." },
    active: { visual: "Character sitting opposite the player.", formula: "Face-to-face." }
  },
  [LocationType.HOME]: {
    idle: { visual: "Mom doing housework.", formula: "POV from door." },
    active: { visual: "Mom offering fruit plate.", formula: "Close up." }
  },
  [LocationType.SCHOOL_GATE]: {
    idle: { visual: "Character waiting in distance.", formula: "Approach shot." },
    active: { visual: "Character greeting player closely.", formula: "Eye level." }
  },
  [LocationType.COMMERCIAL_STREET]: {
    idle: { visual: "Character looking at window.", formula: "Sidewalk POV." },
    active: { visual: "Character showing shopping bags.", formula: "Eye level." }
  },
  [LocationType.CINEMA]: {
    idle: { visual: "Character at counter.", formula: "Lobby POV." },
    active: { visual: "Character showing tickets.", formula: "Close up." }
  },
  [LocationType.PARK]: {
    idle: { visual: "Character reading on bench.", formula: "Distant POV." },
    active: { visual: "Sitting together on bench.", formula: "Side view." }
  },
  [LocationType.SUJEONG_HOME]: {
    idle: { visual: "Relaxing on sofa.", formula: "Living room POV." },
    active: { visual: "Leaning in with wine glass.", formula: "Very close." }
  },
};

// --- 课程表 (24小时制匹配) ---
export const SCHOOL_SCHEDULE = [
  { start: 350, end: 380, location: LocationType.CLASSROOM, name: '早读 (05:50 - 06:20)' },
  { start: 380, end: 420, location: LocationType.CAFETERIA, name: '早餐 (06:20 - 07:00)' },
  { start: 420, end: 465, location: LocationType.CLASSROOM, name: '语文 (崔秀晶) (07:00 - 07:45)' },
  { start: 475, end: 520, location: LocationType.MUSIC_ROOM, name: '音乐 (杨晓林) (07:55 - 08:40)' },
  { start: 530, end: 575, location: LocationType.CLASSROOM, name: '英语 (宋智贤) (08:50 - 09:35)' },
  { start: 575, end: 605, location: LocationType.SCHOOL_GATE, name: '跑操 (09:35 - 10:05)' },
];

// --- 好感度等级 ---
export const RELATIONSHIP_STAGES = [
    { threshold: 20, label: "平淡" },
    { threshold: 40, label: "略有好感" },
    { threshold: 60, label: "很有好感" },
    { threshold: 80, label: "喜欢" },
    { threshold: 100, label: "热恋" }
];

// --- OUTFIT DATA DEFINITIONS ---

// 1. SUJEONG (Korean Teacher)
export const SUJEONG_OUTFITS_DATA: Outfit[] = [
    {
        id: 'work_a_pink',
        name: '职场粉色诱惑',
        description: '经典的浅粉色纽扣衬衫，微微露出的事业线展现出成熟的韵味。',
        visualPrompt: 'Top: LIGHT PINK shallow V-neck button-up shirt showing cleavage. Bottom: DARK GREY tight pencil skirt. High heels.',
        type: 'work',
        price: 0,
        isOwned: true
    },
    {
        id: 'work_b_white_silk',
        name: '冰山美人白衬衫',
        description: '半透明的紧身白绸衬衫，搭配高腰开叉裙，知性中透着冷艳。',
        visualPrompt: 'Top: TIGHT WHITE silk blouse, slightly translucent, top buttons undone. Bottom: BLACK high-waisted skirt with a side slit. Black stockings. NO glasses.',
        type: 'work',
        price: 0,
        isOwned: true
    },
    {
        id: 'work_c_black_seduction',
        name: '极致攻势',
        description: '极具攻击性的穿搭，深V衬衫配合超短裙和黑丝，让人移不开眼。',
        visualPrompt: 'Top: WHITE button-up shirt, shallow V-neck showing cleavage. Bottom: BLACK tight pencil skirt. Black pantyhose. Black high heels.',
        type: 'work',
        price: 0,
        isOwned: true
    },
    {
        id: 'casual_d_sweater',
        name: '慵懒居家服',
        description: '宽松的毛衣 and 热裤，展现出她卸下防备后最真实的一面。',
        visualPrompt: 'Wearing an oversized loose grey knitted sweater falling off one shoulder. Black tight hot pants (very short). Bare feet. Messy hair bun.',
        type: 'casual',
        price: 0,
        isOwned: true
    }
];

// 2. JIHYUN (English Teacher)
export const JIHYUN_OUTFITS_DATA: Outfit[] = [
    {
        id: 'work_a_standard',
        name: '标准英语教职装',
        description: '紧身白衬衫搭配深蓝包臀裙，年轻干练。',
        visualPrompt: 'Top: TIGHT WHITE button-up shirt (Top button OPEN, showing collarbone). Bottom: TIGHT DARK BLUE pencil skirt. Bare legs. High heels.',
        type: 'work',
        price: 0,
        isOwned: true
    },
    {
        id: 'work_b_chic',
        name: '时尚通勤装',
        description: '米色丝绸衬衫搭配高腰阔腿裤，展现出年轻教师的时尚感。',
        visualPrompt: 'Top: SILK BEIGE BLOUSE, soft fabric. Bottom: High-waisted brown wide-leg trousers. Stylish necklace.',
        type: 'work',
        price: 0,
        isOwned: false
    },
    {
        id: 'casual_c_date',
        name: '约会碎花裙',
        description: '下班后的约会装扮，温柔的碎花连衣裙，充满女人味。',
        visualPrompt: 'Wearing a cute floral pattern summer dress (light blue). Thin straps. Exposed shoulders. Hair down wavy.',
        type: 'casual',
        price: 0,
        isOwned: false
    }
];

// 3. YONGHAO (Bad Student)
export const YONGHAO_OUTFITS_DATA: Outfit[] = [
    {
        id: 'uniform_a_messy',
        name: '不羁校服',
        description: '校服外套敞开，里面是黑T恤，一副无视校规的样子。',
        visualPrompt: 'Wearing Chinese high school tracksuit uniform JACKET OPEN. Inner BLACK T-shirt. Hands in pockets. Cool stance.',
        type: 'uniform',
        price: 0,
        isOwned: true
    },
    {
        id: 'uniform_b_summer',
        name: '夏季混搭',
        description: '只穿校服裤子，上身是紧身白色背心，露出肌肉线条。',
        visualPrompt: 'Top: Tight WHITE TANK TOP showing muscles. Bottom: Blue school uniform track pants. Holding a basketball.',
        type: 'uniform',
        price: 0,
        isOwned: true
    },
    {
        id: 'casual_c_street',
        name: '街头潮男',
        description: '黑皮衣加破洞牛仔裤，校外的他更加野性。',
        visualPrompt: 'Wearing a BLACK LEATHER JACKET. Ripped jeans. Silver chain necklace. Streetwear style.',
        type: 'casual',
        price: 0,
        isOwned: true
    }
];

// 4. KUANZE (Fat Best Friend)
export const KUANZE_OUTFITS_DATA: Outfit[] = [
    {
        id: 'uniform_a_standard',
        name: '紧绷的校服',
        description: '对于他来说稍微有点紧的校服，显得憨态可掬。',
        visualPrompt: 'Wearing standard Chinese blue and white tracksuit uniform. Slightly too tight around the belly. Glasses.',
        type: 'uniform',
        price: 0,
        isOwned: true
    },
    {
        id: 'casual_b_geek',
        name: '宅男T恤',
        description: '印着动漫角色的宽松T恤。',
        visualPrompt: 'Wearing a loose GREY T-SHIRT with a pixel art graphic. Cargo shorts. Glasses.',
        type: 'casual',
        price: 0,
        isOwned: true
    }
];

// 5. MOM (Mother)
export const MOM_OUTFITS_DATA: Outfit[] = [
    {
        id: 'casual_a_apron',
        name: '居家围裙',
        description: '妈妈在厨房忙碌时最常见的打扮。',
        visualPrompt: 'Wearing casual comfortable home clothes (pink sweater). Wearing a floral APRON over it. Hair tied back.',
        type: 'casual',
        price: 0,
        isOwned: true
    },
    {
        id: 'casual_b_outdoor',
        name: '外出便服',
        description: '去超市或散步时的穿着，朴素大方。',
        visualPrompt: 'Wearing a simple cardigan and long skirt. Carrying a handbag. Gentle motherly look.',
        type: 'casual',
        price: 0,
        isOwned: true
    }
];

// 6. XIAOLIN (Music Teacher)
export const XIAOLIN_OUTFITS_DATA: Outfit[] = [
    {
        id: 'casual_a_elegant',
        name: '优雅长裙',
        description: '黑色长裙，搭配珍珠项链，尽显高冷气质。',
        visualPrompt: 'Wearing a long black elegant dress. Pearl necklace. Sitting gracefully.',
        type: 'casual',
        price: 0,
        isOwned: true
    }
];

// --- 道具与商店数据 (ITEMS) ---
// 定义在服装数据之后以便引用
export const ITEMS: Item[] = [
    // 食物与饮品 (主要用于食堂逻辑或体力恢复)
    { 
        id: 'water', 
        name: '矿泉水', 
        price: 2, 
        type: 'drink', 
        description: '解渴', 
        effect: (s) => ({ ...s, thirst: Math.min(100, s.thirst + 30) }) 
    },
    { 
        id: 'cheap_meal', 
        name: '素包子套餐', 
        price: 4, 
        type: 'food', 
        description: '食堂便宜的饭', 
        effect: (s) => ({ ...s, hunger: Math.min(100, s.hunger + 25) }) 
    },
    { 
        id: 'expensive_meal', 
        name: '红烧肉盖饭', 
        price: 10, 
        type: 'food', 
        description: '食堂贵的饭', 
        effect: (s) => ({ ...s, hunger: Math.min(100, s.hunger + 60) }) 
    },
    { 
        id: 'soup_meal', 
        name: '羊肉烩面', 
        price: 12, 
        type: 'food', 
        description: '带汤的饭', 
        effect: (s) => ({ 
            ...s, 
            hunger: Math.min(100, s.hunger + 50), 
            thirst: Math.min(100, s.thirst + 40) 
        }) 
    },

    // 礼品与服装 (展示在手机淘宝应用中)
    // 这里的 visualPrompt 链接到对应 NPC 的服装库以保持生成一致性
    { 
        id: 'black_stockings', 
        name: '极薄黑丝(10D)', 
        price: 68, 
        type: 'clothes', 
        description: '透肉的黑色丝袜，性感加分。',
        visualPrompt: SUJEONG_OUTFITS_DATA[2].visualPrompt, // 链接到崔秀晶的攻势装束
        image: 'https://images.unsplash.com/photo-1500917293049-724792946a6e?auto=format&fit=crop&w=300&q=80' 
    },
    { 
        id: 'summer_dress', 
        name: '碎花吊带裙', 
        price: 320, 
        type: 'clothes', 
        description: '清新的夏日装扮，适合约会。',
        visualPrompt: JIHYUN_OUTFITS_DATA[2].visualPrompt, // 链接到宋智贤的约会装
        image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80'
    },
    { 
        id: 'jk_uniform', 
        name: '日系JK制服', 
        price: 240, 
        type: 'clothes', 
        description: '经典的格裙与水手服，充满青春气息。',
        visualPrompt: 'Japanese high school uniform (JK style). White sailor collar shirt and plaid pleated skirt. Folded neatly on a clean table.',
        image: 'https://images.unsplash.com/photo-1512218168353-3b76e9857476?auto=format&fit=crop&w=300&q=80'
    },
    { 
        id: 'off_shoulder_sweater', 
        name: '露肩针织衫', 
        price: 180, 
        type: 'clothes', 
        description: '温柔中带着一丝小心机的露肩设计。',
        visualPrompt: SUJEONG_OUTFITS_DATA[3].visualPrompt, // 链接到休闲毛衣
        image: 'https://images.unsplash.com/photo-1624835630669-7f524de0901e?auto=format&fit=crop&w=300&q=80'
    },
    { 
        id: 'high_heels', 
        name: '黑色尖头高跟鞋', 
        price: 450, 
        type: 'clothes', 
        description: '提升气场的利器，成熟女性必备。',
        visualPrompt: 'A pair of sharp black stiletto high heels. Shiny patent leather. Elegant and sexy. Product shot.',
        image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=300&q=80'
    },

    // 纯礼品类
    { 
        id: 'necklace', 
        name: '纯银心形项链', 
        price: 280, 
        type: 'gift', 
        description: '精致的银饰，送给女生的经典礼物。',
        visualPrompt: 'A silver heart-shaped necklace in a velvet jewelry box. Shiny silver. Delicate chain. Macro product photography.',
        image: 'https://images.unsplash.com/photo-1599643478518-17488fbbcd75?auto=format&fit=crop&w=300&q=80'
    },
    { 
        id: 'flowers', 
        name: '红玫瑰花束', 
        price: 120, 
        type: 'gift', 
        description: '象征热情的红玫瑰，适合表白。',
        visualPrompt: 'A bouquet of red roses wrapped in paper. Romantic gift. Fresh flowers. Product photography.',
        image: 'https://images.unsplash.com/photo-1587588354456-ae376af71a25?auto=format&fit=crop&w=300&q=80'
    },
    { 
        id: 'perfume', 
        name: '名牌香水(50ml)', 
        price: 580, 
        type: 'gift', 
        description: '成熟女性喜欢的淡雅香氛。',
        visualPrompt: 'A glass perfume bottle with gold cap. Elegant design. Expensive look. Studio lighting.',
        image: 'https://images.unsplash.com/photo-1523293188086-b51292955f2e?auto=format&fit=crop&w=300&q=80'
    },
    { 
        id: 'chocolate', 
        name: '进口黑巧克力', 
        price: 88, 
        type: 'gift', 
        description: '苦中带甜，适合送给老师。',
        visualPrompt: 'A box of premium dark chocolates. Gold wrapping. Delicious. Product shot.',
        image: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=300&q=80'
    },
    { 
        id: 'lipstick', 
        name: '大牌口红', 
        price: 320, 
        type: 'gift', 
        description: '热门色号，没有女生能拒绝。',
        visualPrompt: 'A red lipstick tube, open to show the color. Luxury makeup brand style. Product shot.',
        image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=300&q=80'
    },
];

// --- 玩家与通用设定 ---
export const PLAYER_PROFILE = `
Name: 潘宇航 (Pan Yuhang)
Age: 16
Appearance:
- Face: Delicate and handsome features, a blend of maturity and cuteness. Can look very handsome at times.
- Hair: Black slightly curly hair (naturally curly but not too much) that shows a hint of brown under sunlight. Versatile styles: 3/7 split (mature/cute) or celebrity-style bangs (youthful/handsome).
- Eyes: NO GLASSES. When thinking, his eyes reveal depth and wisdom; when interacting, he appears simple, naive, and "silly" (憨憨).
- Body: 180cm tall, 65kg. Long legs. Appears slim in clothes but possesses broad, reliable shoulders. Good skeletal frame with potential for 8-pack abs (though currently unexercised).
- Attire: Usually wears the school uniform (Henan-style blue and white tracksuit).

Personality & Psychology:
- Social: Introverted, shy, and easily embarrassed. Low presence in class with few friends (only Sheng Kuanze). Rarely communicates with others.
- Behavior: Occasionally acts silly or funny in a clumsy way, but is often lonely, sitting in corners lost in melancholic thoughts.
- Interaction: Lacks confidence and avoids eye contact with women he likes.
- Inner Qualities: Brave, kind, and strong, though these are deeply hidden. Can be very stubborn and persistent when facing problems.
- Vibe: Usually lacks charisma due to his personality, but his hidden charm and "buried treasure" qualities shine through in critical moments.
`;

export const PLAYER_VISUAL_PROFILE = `
Name: Pan Yuhang (Male, 16 years old)
Appearance: Handsome youth, delicate features, black slightly curly hair.
Eyes: NO GLASSES.
Body: 180cm tall, slim but broad shoulders, long legs.
Attire: Henan-style blue and white tracksuit school uniform.
`;

// 兼容性保留
export const SUJEONG_OUTFITS = [
    SUJEONG_OUTFITS_DATA[0].visualPrompt
];
export const NPC_DEFAULT_OUTFITS: Record<string, string> = {};

// --- 初始 NPC 数据 (核心) ---
export const INITIAL_NPCS: Record<NPCId, NPC> = {
  [NPCId.SUJEONG]: {
    id: NPCId.SUJEONG,
    name: '崔秀晶 (Choi Su-jeong)',
    age: 27,
    role: '语文老师',
    description: `
身份：学校明星教师 / 玩家的暗恋对象。
定位：外在温柔性感知性、带着成熟教师气质的女性；内在极度脆弱、充满不配得感，且带有隐藏的 M（受虐）属性。

核心性格逻辑：
1. 教师身份：她平常以老师身份与玩家相处，在普通学生和同事面前维持着知性、优雅且专业的形象。不再是“大姐姐”的感觉，而是一位充满魅力的“崔老师”。
2. 隐藏的受虐倾向 (M)：在私密或极度暧昧的氛围下，面对玩家的强势或亲密举动，她会表现出明显的弱势和顺从。内心渴望被玩家掌控，但表面上会因为教师身份而进行羞涩且无力的拒绝（内心想要，表面拒绝）。
3. 身体与内心的分离：
   - 如果玩家表现出只对她的身体感兴趣（色欲导向），她不会感到“不配得”，反而会因为这种纯粹的欲望满足而感到安心和兴奋，享受这种堕落感。
   - 只有当玩家展现出真诚的情感、试图走进她的内心时，她深层的不配得感才会爆发，觉得自己“破碎”且“肮脏”，配不上这份纯真的爱。
4. 偶尔的诱惑：她会利用教师身份的禁忌感，偶尔故意勾引和诱惑玩家，享受这种危险的拉扯。

**重要提示：她绝对不戴眼镜。对话中应通过神态 and 动作侧面体现内心，尤其是她面对亲密举动时的弱势与挣扎。**
`,
    bodyVisualPrompt: `Woman, 27 years old. **Deep Pink Hair.**
FACE: STRICTLY FOLLOW REFERENCE IMAGE FACIAL FEATURES. DO NOT CHANGE FACE SHAPE, NOSE, OR JAWLINE. **NO GLASSES. DO NOT GENERATE GLASSES.**
BODY: **Model-like body proportions (1:8 head-to-body ratio). Long slender legs.** Voluptuous and curvaceous. Slim yet full in the right places (Slim-thick). Extremely beautiful waist-to-hip ratio due to self-discipline. Slender shoulders and arms. Ant waist. Slightly wide and plump hips and buttocks. Shoulder width equals hip width. X-shaped hourglass figure. Full chest. Slightly visible cleavage.
VIBE: Seductive, alluring, vulnerable, elegant.
EXPRESSION: Seductive smile with a hint of sadness/longing.`,
    visualPrompt: "", 
    outfits: SUJEONG_OUTFITS_DATA,
    currentOutfitId: SUJEONG_OUTFITS_DATA[0].id,
    phoneNumber: "13800138001",
    affection: 10,
    currentLocation: LocationType.OFFICE,
    referenceImages: [],
    avatars: {},
    dialogueMemory: ""
  },

  [NPCId.JIHYUN]: {
    id: NPCId.JIHYUN,
    name: '宋智贤 (Song Jihyun)',
    age: 23,
    role: '英语老师',
    description: `
身份：刚入职不久的英语老师。
性格：纯粹的善良与平易近人。性格直观积极，对玩家充满好奇和好感。
外貌：23岁。知性、温柔，身材极好。**不戴眼镜。**
核心设定：
1. 纯真热情：与崔秀晶的伪装不同，她的态度更加真诚，表现得精力充沛且善良。
2. 对玩家态度：初始好感度20（接近略有好感）。面对玩家时通常带着温暖的欢迎微笑和明亮的眼神，给玩家一种亲切、好相处的印象。对玩家第一印象就有着好感与好奇，想深入了解。
3. 职业专注：她是一名专业的英语老师，只讨论英语相关话题或日常生活，绝对不会教数学或做数学题。

**重要提示：她绝对不戴眼镜。**
`,
    bodyVisualPrompt: `Female teacher, 23 years old. STRICTLY FOLLOW THE FACIAL FEATURES AND HAIRSTYLE FROM THE REFERENCE IMAGES. **NO GLASSES. WEARING NO GLASSES.** **Fair skin**. DO NOT CHANGE FACE SHAPE, NOSE, OR JAWLINE.
**Balanced proportions (1:7 ratio). Slender legs.** Beautiful S-line curve. Ant waist. X-shaped hourglass figure. Full chest.
VIBE: Gentle, energetic, kind, approachable. Sexy, beautiful curves, elegant.
EXPRESSION: Bright eyes, warm welcoming smile.`,
    visualPrompt: "", 
    outfits: JIHYUN_OUTFITS_DATA,
    currentOutfitId: JIHYUN_OUTFITS_DATA[0].id,
    phoneNumber: "13900139002",
    affection: 20,
    currentLocation: LocationType.CLASSROOM,
    referenceImages: [],
    avatars: {},
    dialogueMemory: ""
  },

  [NPCId.YONGHAO]: {
    id: NPCId.YONGHAO,
    name: '永豪',
    age: 18,
    role: '高三学长',
    description: '金发，略显成熟，痞帅，坏男孩风格。知道崔秀晶老师的秘密。',
    bodyVisualPrompt: `Handsome boy, 18 years old. HAIRSTYLE MUST MATCH REFERENCE IMAGE. Sharp jawline. Blonde hair.
VIBE: Rebellious, cool, confident, dangerous.
POSTURE: Slouching slightly, hands in pockets, looking down arrogantly.
EXPRESSION: Smirking, confident gaze.`,
    visualPrompt: "",
    outfits: YONGHAO_OUTFITS_DATA,
    currentOutfitId: YONGHAO_OUTFITS_DATA[0].id,
    phoneNumber: "13700137003",
    affection: 0,
    currentLocation: LocationType.SCHOOL_GATE,
    referenceImages: [],
    avatars: {},
    dialogueMemory: ""
  },

  [NPCId.KUANZE]: {
    id: NPCId.KUANZE,
    name: '盛宽泽',
    age: 17,
    role: '同班同学',
    description: '玩家的死党，小胖子，戴眼镜。性格憨厚搞笑，消息灵通。',
    bodyVisualPrompt: `Chubby high school boy, 17 years old. Wearing glasses. Round face.
VIBE: Friendly, geeky, harmless, funny.
POSTURE: Relaxed, slightly awkward but happy.
EXPRESSION: Grinning, eyes squinting with laughter.`,
    visualPrompt: "",
    outfits: KUANZE_OUTFITS_DATA,
    currentOutfitId: KUANZE_OUTFITS_DATA[0].id,
    phoneNumber: "13600136004",
    affection: 50,
    currentLocation: LocationType.CLASSROOM,
    referenceImages: [],
    avatars: {},
    dialogueMemory: ""
  },

  [NPCId.MOM]: {
    id: NPCId.MOM,
    name: '妈妈',
    age: 45,
    role: '母亲',
    description: '普通的家庭主妇，关心儿子的学习和生活。',
    bodyVisualPrompt: `Middle-aged asian woman, 45 years old. Kind face.
VIBE: Motherly, caring, warm, gentle.
POSTURE: Comfortable standing pose.
EXPRESSION: Soft caring look.`,
    visualPrompt: "",
    outfits: MOM_OUTFITS_DATA,
    currentOutfitId: MOM_OUTFITS_DATA[0].id,
    phoneNumber: "13500135005",
    affection: 100,
    currentLocation: LocationType.HOME,
    referenceImages: [],
    avatars: {},
    dialogueMemory: ""
  },

  [NPCId.XIAOLIN]: {
    id: NPCId.XIAOLIN,
    name: '杨晓林 (Yang Xiaolin)',
    age: 25,
    role: '音乐老师',
    description: '高雅优雅，带着淡淡的忧郁，钢琴造诣极高。',
    bodyVisualPrompt: `Woman, 25 years old. Long jet black hair in a low ponytail. Porcelain skin. Vibe: Elegant, quiet beauty.`,
    visualPrompt: "Wearing a white midi dress with a black thin silk scarf.",
    phoneNumber: "13300133006", affection: 15, currentLocation: LocationType.MUSIC_ROOM,
    referenceImages: [], avatars: {}, dialogueMemory: ""
  },
};
