// --- 数据库常量配置 ---
// CRITICAL: 请勿更改数据库名称。更改名称会导致浏览器创建全新的隔离数据库，从而丢失所有已上传的图片和存档。
export const DB_NAME = 'ShangqiuHigh_Data_Permanent'; 
export const DB_VERSION = 31; // Fixed schema mismatch
export const STORE_IMAGES = 'user_images';
export const STORE_SAVES = 'game_saves';

/**
 * 获取数据库实例的内部函数 (Promisified)
 */
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error("IndexedDB Open Error:", request.error?.message || "Unknown error");
      reject(request.error);
    };

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (e) => {
      console.log("Upgrading IndexedDB to version", DB_VERSION);
      const db = (e.target as IDBOpenDBRequest).result;
      
      // 创建图片存储仓库
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES);
        console.log("Created image store");
      }
      
      // 修复：重建游戏存档仓库以确保使用 out-of-line keys
      // 旧版本可能使用了 keyPath: 'id'，导致 put(value, key) 报错
      if (db.objectStoreNames.contains(STORE_SAVES)) {
        db.deleteObjectStore(STORE_SAVES);
        console.log("Deleted old save store to fix schema");
      }
      db.createObjectStore(STORE_SAVES);
      console.log("Created save store");
    };
  });
};

// --- 工具函数：Base64 与 Blob 互转 (提高存储效率) ---

const base64ToBlob = (dataURI: string): Blob | null => {
  if (!dataURI || !dataURI.startsWith('data:')) return null;
  
  const splitIndex = dataURI.indexOf(',');
  if (splitIndex === -1) return null;

  const base64 = dataURI.substring(splitIndex + 1);
  const byteString = atob(base64);
  const mimeMatch = dataURI.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- 图片资源管理部分 ---

/**
 * 保存图片资产（场景图或人物参考图）
 * 在开启事务前先并行处理 Blob 转换，防止事务阻塞
 */
export const saveAssetToDB = async (key: string, images: string[]): Promise<void> => {
  try {
    const db = await getDB();
    
    // 1. 先进行异步转换，避免在事务中执行耗时操作
    const processedData = await Promise.all(
      images.map(img => (typeof img === 'string' ? base64ToBlob(img) : img))
    );

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      
      const request = store.put(processedData, key);

      tx.oncomplete = () => {
        console.log(`[DB] 已保存 ${processedData.length} 个资源至键: ${key}`);
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (e: any) {
    console.error("Failed to save asset to DB", e?.message || "Unknown error");
  }
};

/**
 * 获取指定键的资产
 */
export const getAssetFromDB = async (key: string): Promise<string[]> => {
  try {
    const db = await getDB();
    const rawData: Blob[] = await new Promise((resolve) => {
      const tx = db.transaction(STORE_IMAGES, 'readonly');
      const store = tx.objectStore(STORE_IMAGES);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });

    return await Promise.all(rawData.map(blob => blobToBase64(blob)));
  } catch (e) {
    return [];
  }
};

/**
 * 加载所有已存储的资产
 */
export const loadAssetsFromDB = async (): Promise<Record<string, string[]>> => {
  try {
    const db = await getDB();
    const rawData: Record<string, Blob[]> = await new Promise((resolve) => {
      const tx = db.transaction(STORE_IMAGES, 'readonly');
      const store = tx.objectStore(STORE_IMAGES);
      const request = store.openCursor();
      const results: Record<string, Blob[]> = {};

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          results[cursor.key as string] = cursor.value;
          cursor.continue();
        } else resolve(results);
      };
      request.onerror = () => resolve({});
    });

    // 将读取到的 Blob 统一转回 Base64 供前端渲染
    const finalResults: Record<string, string[]> = {};
    for (const key of Object.keys(rawData)) {
      finalResults[key] = await Promise.all(rawData[key].map(blob => blobToBase64(blob)));
    }
    return finalResults;
  } catch (e) {
    return {};
  }
};

// --- 游戏进度存档部分 (GameState) ---

/**
 * 保存游戏存档到指定槽位
 */
export const saveGameStateToDB = async (state: any, slotId: number = 0) => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_SAVES, 'readwrite');
    const store = tx.objectStore(STORE_SAVES);
    
    // 清理临时 UI 状态和生成的图片缓存
    const cleanState = JSON.parse(JSON.stringify(state));
    
    cleanState.backgroundUrl = null;
    cleanState.bgCache = {};
    cleanState.currentDialogue = { ...cleanState.currentDialogue, active: false };
    
    // 添加存档元数据
    cleanState.saveMeta = {
      timestamp: Date.now(),
      summary: `第 ${cleanState.day} 天 - ${cleanState.location}`,
      slotId: slotId
    };

    if (cleanState.npcs) {
        Object.keys(cleanState.npcs).forEach(npcId => {
            if (cleanState.npcs[npcId]) {
                cleanState.npcs[npcId].avatars = {};
            }
        });
    }
    
    const key = slotId === 0 ? 'auto_save' : `save_${slotId}`;
    store.put(cleanState, key);
    
    return new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch (e: any) {
    console.error("Save game failed", e?.message || "Unknown error");
  }
};

/**
 * 读取指定槽位的存档
 */
export const loadGameStateFromDB = async (slotId: number = 0): Promise<any | null> => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_SAVES, 'readonly');
    const key = slotId === 0 ? 'auto_save' : `save_${slotId}`;
    
    return new Promise((resolve) => {
      const request = tx.objectStore(STORE_SAVES).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
};

/**
 * 获取所有存档的元数据 (用于存档列表展示)
 */
export const getAllSaves = async (): Promise<Record<number, any>> => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_SAVES, 'readonly');
    const store = tx.objectStore(STORE_SAVES);
    const request = store.getAll();
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const saves = request.result || [];
        const result: Record<number, any> = {};
        saves.forEach((save: any) => {
           if (save.saveMeta && save.saveMeta.slotId) {
               result[save.saveMeta.slotId] = save.saveMeta;
           }
        });
        resolve(result);
      };
      request.onerror = () => resolve({});
    });
  } catch (e) {
    return {};
  }
};

/**
 * 清空所有数据 (用于重置游戏)
 */
export const clearAllAssets = async () => {
  try {
    const db = await getDB();
    const tx = db.transaction([STORE_IMAGES, STORE_SAVES], 'readwrite');
    tx.objectStore(STORE_IMAGES).clear();
    tx.objectStore(STORE_SAVES).clear();
    console.log("All persistent data cleared.");
  } catch (e: any) {
    console.error("Clear failed", e?.message || "Unknown error");
  }
};
