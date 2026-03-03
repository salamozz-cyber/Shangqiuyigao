export enum LocationType {
  HOME = '工行新苑 (家)',
  SCHOOL_GATE = '商丘一高 (校门)',
  CLASSROOM = '高一(3)班教室',
  OFFICE = '教师办公室',
  CAFETERIA = '学校食堂',
  COMMERCIAL_STREET = '商业街',
  CINEMA = '电影院',
  PARK = '梁园区公园',
  SUJEONG_HOME = '崔秀晶家',
  MUSIC_ROOM = '钢琴音乐教室', // 新增地点 
}

declare global {
    interface Window {
        aistudio: any;
    }
}

export interface CalendarDate {
    year: number;
    month: number;
    day: number;
    weekday: string;
    season: string;
}

export type WeatherType = 'Sunny' | 'Cloudy' | 'Rainy' | 'Stormy' | 'Snowy';

export enum NPCId {
  SUJEONG = 'choi_su_jeong',
  JIHYUN = 'song_jihyun',
  XIAOLIN = 'yang_xiaolin', // 新增：音乐老师 
  YONGHAO = 'yonghao',
  KUANZE = 'sheng_kuanze',
  MOM = 'mom'
}

export enum RelationLevel {
  STRANGER = 0,
  ACQUAINTANCE = 20,
  FRIEND = 40,
  GOOD_FRIEND = 60,
  LIKE = 80,
  LOVE = 95,
  DISLIKE = -20,
  HATE = -50,
  DETEST = -80
}

export type OutfitType = 'uniform' | 'work' | 'casual' | 'date' | 'special';

export interface Outfit {
  id: string;
  name: string;
  description: string;
  visualPrompt: string;
  type: OutfitType;
  price: number;
  isOwned: boolean;
}

export interface NPC {
  id: NPCId;
  name: string;
  age: number;
  role: string;
  description: string;
  visualPrompt: string;
  bodyVisualPrompt?: string;
  outfits?: Outfit[];
  currentOutfitId?: string;
  phoneNumber: string;
  affection: number;
  currentLocation: LocationType;
  avatarUrl?: string;
  avatars: Record<string, string>;
  referenceImages: string[]; 
  dialogueMemory: string;
}

export interface PlayerStats {
  money: number;
  hunger: number; 
  thirst: number; 
  stamina: number; 
  intelligence: number; 
  appearance: number;
}

export interface ChatMessage {
  sender: 'player' | 'npc' | 'system';
  content: string;
  timestamp: number;
  image?: string;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  effect?: (stats: PlayerStats) => PlayerStats;
  description: string;
  type: 'food' | 'drink' | 'gift' | 'clothes';
  visualPrompt?: string;
  image?: string;
}

export interface Delivery {
  id: string;
  item: Item;
  arrivalTime: number;
}

export interface ActionOption {
  label: string;
  type: 'romantic' | 'funny' | 'aggressive' | 'kind';
}

export interface GameState {
  time: number; // 24小时制分钟数 
  day: number;
  location: LocationType;
  stats: PlayerStats;
  inventory: Item[];
  deliveries: Delivery[];
  npcs: Record<NPCId, NPC>;
  phone: {
    contacts: NPCId[];
    pendingRequests: { npcId: NPCId, timestamp: number }[];
    messages: Partial<Record<NPCId, ChatMessage[]>>;
    isOpen: boolean;
    app: 'wechat' | 'taobao' | 'dialer' | 'bag' | null;
  };
  currentDialogue: {
    active: boolean;
    npcId: NPCId | null;
    history: ChatMessage[];
    currentEmotion: string;
    isCinematic: boolean;
    showGiftMenu?: boolean;
  };
  backgroundUrl: string | null;
  bgCache: Partial<Record<LocationType, string>>; 
  sceneLayout: {
    left?: NPCId;
    center?: NPCId;
    right?: NPCId;
  };
  isClassStarted: boolean; // 课堂状态标识 
}
