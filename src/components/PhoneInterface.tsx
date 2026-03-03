import React, { useState } from 'react';
import { GameState, NPCId, Item, ChatMessage } from '../types';

interface PhoneInterfaceProps {
  gameState: GameState;
  onClose: () => void;
  onSendMessage: (id: NPCId, text: string) => void;
  onAddContact: () => void;
  onBuyItem: (item: Item) => void;
  onConsumeItem: (item: Item) => void;
  setPhoneApp: (app: 'wechat' | 'taobao' | 'dialer' | 'bag' | null) => void;
}

const PhoneInterface: React.FC<PhoneInterfaceProps> = ({
  gameState,
  onClose,
  onSendMessage,
  onAddContact,
  onBuyItem,
  onConsumeItem,
  setPhoneApp
}) => {
  const { phone, npcs } = gameState;
  const [activeContactId, setActiveContactId] = useState<NPCId | null>(null);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (activeContactId && inputText.trim()) {
      onSendMessage(activeContactId, inputText);
      setInputText('');
    }
  };

  const renderHome = () => (
    <div className="grid grid-cols-4 gap-4 p-4 mt-10">
      <button onClick={() => setPhoneApp('wechat')} className="flex flex-col items-center gap-1">
        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white text-2xl">💬</div>
        <span className="text-xs text-white">微信</span>
      </button>
      <button onClick={() => setPhoneApp('taobao')} className="flex flex-col items-center gap-1">
        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white text-2xl">🛍️</div>
        <span className="text-xs text-white">淘宝</span>
      </button>
      <button onClick={() => setPhoneApp('dialer')} className="flex flex-col items-center gap-1">
        <div className="w-12 h-12 bg-green-400 rounded-xl flex items-center justify-center text-white text-2xl">📞</div>
        <span className="text-xs text-white">电话</span>
      </button>
      <button onClick={() => setPhoneApp('bag')} className="flex flex-col items-center gap-1">
        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white text-2xl">🎒</div>
        <span className="text-xs text-white">背包</span>
      </button>
    </div>
  );

  const renderWeChat = () => {
    if (activeContactId) {
      const messages = (phone.messages && phone.messages[activeContactId]) || [];
      const npc = npcs[activeContactId];
      
      return (
        <div className="flex flex-col h-full bg-gray-100">
          <div className="bg-gray-800 text-white p-3 flex items-center gap-2">
            <button onClick={() => setActiveContactId(null)} className="text-sm">⬅️</button>
            <span className="font-bold">{npc?.name || activeContactId}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.sender === 'player' ? 'bg-green-500 text-white' : 'bg-white text-black'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 bg-white border-t flex gap-2">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 border rounded px-2 py-1 text-black"
              placeholder="发送消息..."
            />
            <button onClick={handleSend} className="bg-green-600 text-white px-3 py-1 rounded">发送</button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="bg-gray-800 text-white p-3 font-bold">微信</div>
        <div className="flex-1 overflow-y-auto">
          {(phone.contacts || []).map(id => {
             const npc = npcs[id];
             return (
              <button 
                key={id} 
                onClick={() => setActiveContactId(id)}
                className="w-full p-3 border-b flex items-center gap-3 hover:bg-gray-50"
              >
                <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
                   {npc?.avatarUrl ? <img src={npc.avatarUrl} alt={npc.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-800">{npc?.name || id}</div>
                  <div className="text-xs text-gray-500">点击聊天</div>
                </div>
              </button>
             );
          })}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (phone.app) {
      case 'wechat': return renderWeChat();
      case 'taobao': return <div className="p-4 text-center text-gray-500">淘宝暂未开放</div>;
      case 'dialer': return <div className="p-4 text-center text-gray-500">拨号暂未开放</div>;
      case 'bag': return <div className="p-4 text-center text-gray-500">背包暂未开放</div>;
      default: return renderHome();
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[320px] h-[600px] bg-black rounded-[40px] border-8 border-gray-800 overflow-hidden shadow-2xl">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-20"></div>
        
        {/* Status Bar */}
        <div className="absolute top-1 left-0 w-full px-6 flex justify-between text-[10px] text-white z-10">
          <span>{new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')}</span>
          <div className="flex gap-1">
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Content */}
        <div className="w-full h-full bg-slate-900 pt-8 pb-12">
            {phone.app && (
                <button 
                    onClick={() => setPhoneApp(null)} 
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/50 rounded-full z-20"
                ></button>
            )}
            {renderContent()}
        </div>

        {/* Home Button Area (Virtual) */}
        <div className="absolute bottom-0 left-0 w-full h-8 bg-transparent z-10" onClick={() => {
            if (phone.app) setPhoneApp(null);
            else onClose();
        }}></div>
      </div>
      
      {/* Close Button Outside */}
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-xl bg-white/20 p-2 rounded-full hover:bg-white/30">
        ✕
      </button>
    </div>
  );
};

export default PhoneInterface;
