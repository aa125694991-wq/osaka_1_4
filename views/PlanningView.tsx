import React, { useState, useEffect, useRef } from 'react';
import { TodoItem } from '../types';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

// Interface for the List Document
interface PlanningList {
  id: string;
  name: string;
  items: TodoItem[];
  createdAt: number;
}

const DEFAULT_LISTS: PlanningList[] = [
  {
    id: 'default_todo',
    name: '待辦事項',
    createdAt: 1,
    items: [
      { id: '1', text: '買網卡/eSIM', completed: true, assignedTo: 'Jimmy' },
      { id: '2', text: '預約和服體驗', completed: false, assignedTo: 'Serena' },
      { id: '3', text: '換日幣', completed: false, assignedTo: 'All' },
    ]
  },
  {
    id: 'default_packing',
    name: '行李清單',
    createdAt: 2,
    items: [
      { id: 'p1', text: '護照', completed: false },
      { id: 'p2', text: '行動電源', completed: false },
      { id: 'p3', text: '轉接頭', completed: true },
    ]
  }
];

const PlanningView: React.FC = () => {
  // --- Data State ---
  const [lists, setLists] = useState<PlanningList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // --- UI State ---
  const [showAddListModal, setShowAddListModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showDeleteListConfirm, setShowDeleteListConfirm] = useState(false);
  
  // Item Detail Modal
  const [selectedItem, setSelectedItem] = useState<TodoItem | null>(null);
  const [itemForm, setItemForm] = useState<TodoItem | null>(null);
  const [showPhotoActions, setShowPhotoActions] = useState(false);

  // Refs for photos
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  // Forms
  const [newListName, setNewListName] = useState('');
  const [newItemText, setNewItemText] = useState('');

  // --- Firebase Sync ---
  useEffect(() => {
    const listsRef = collection(db, 'planning_lists');
    const unsubscribe = onSnapshot(listsRef, (snapshot) => {
      if (snapshot.empty && !loading) {
         // Seed defaults if empty
         const batch = writeBatch(db);
         DEFAULT_LISTS.forEach(list => {
             batch.set(doc(db, 'planning_lists', list.id), list);
         });
         batch.commit();
      }

      const loadedLists = snapshot.docs.map(doc => doc.data() as PlanningList);
      // Sort by creation time
      loadedLists.sort((a, b) => a.createdAt - b.createdAt);
      
      setLists(loadedLists);
      setLoading(false);

      // Ensure active tab is valid
      if (loadedLists.length > 0) {
          if (!activeListId || !loadedLists.find(l => l.id === activeListId)) {
              setActiveListId(loadedLists[0].id);
          }
      } else {
          setActiveListId('');
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Derived State ---
  const activeList = lists.find(l => l.id === activeListId);
  const progress = activeList && activeList.items.length > 0
    ? Math.round((activeList.items.filter(i => i.completed).length / activeList.items.length) * 100)
    : 0;

  // --- Handlers: List Management ---

  const handleAddList = async () => {
      if (!newListName.trim()) return;
      const newId = `list_${Date.now()}`;
      const newList: PlanningList = {
          id: newId,
          name: newListName,
          items: [],
          createdAt: Date.now()
      };
      
      try {
          await setDoc(doc(db, 'planning_lists', newId), newList);
          setNewListName('');
          setShowAddListModal(false);
          setActiveListId(newId);
      } catch (e) {
          alert('新增失敗');
      }
  };

  const handleDeleteList = async () => {
      if (!activeListId) return;
      try {
          await deleteDoc(doc(db, 'planning_lists', activeListId));
          setShowDeleteListConfirm(false);
      } catch (e) {
          alert('刪除失敗');
      }
  };

  // --- Handlers: Item Management ---

  const handleAddItem = async () => {
      if (!newItemText.trim() || !activeList) return;
      
      const newItem: TodoItem = {
          id: Date.now().toString(),
          text: newItemText,
          completed: false
      };
      
      const updatedItems = [...activeList.items, newItem];
      
      try {
          await updateDoc(doc(db, 'planning_lists', activeList.id), { items: updatedItems });
          setNewItemText('');
          setShowAddItemModal(false);
      } catch (e) {
          console.error(e);
      }
  };

  const toggleItem = async (itemId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeList) return;
      const updatedItems = activeList.items.map(item => 
          item.id === itemId ? { ...item, completed: !item.completed } : item
      );
      await updateDoc(doc(db, 'planning_lists', activeList.id), { items: updatedItems });
  };

  const openItemDetail = (item: TodoItem) => {
      setSelectedItem(item);
      setItemForm({ ...item });
  };

  const handleSaveItem = async () => {
      if (!activeList || !itemForm) return;
      const updatedItems = activeList.items.map(item => 
          item.id === itemForm.id ? itemForm : item
      );
      try {
          await updateDoc(doc(db, 'planning_lists', activeList.id), { items: updatedItems });
          setSelectedItem(null);
          setItemForm(null);
      } catch (e) {
          alert('儲存失敗');
      }
  };

  const deleteItem = async (itemId: string) => {
      if (!activeList) return;
      if (!window.confirm("確定刪除此項目？")) return;

      const updatedItems = activeList.items.filter(item => item.id !== itemId);
      await updateDoc(doc(db, 'planning_lists', activeList.id), { items: updatedItems });
      setSelectedItem(null); // Close modal if open
  };

  // --- Photo Logic for Items ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!itemForm) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const currentPhotos = itemForm.photos || [];
      setItemForm({ ...itemForm, photos: [...currentPhotos, base64String] });
      setShowPhotoActions(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-ios-bg">
       {/* Header */}
       <div className="bg-white border-b border-gray-200 z-20 relative shadow-sm pt-safe">
         <div className="pt-4 pb-2">
             <div className="px-6 flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-900">行前準備</h1>
                {activeList && (
                    <button 
                        onClick={() => setShowDeleteListConfirm(true)}
                        className="text-gray-400 hover:text-red-500 text-sm font-medium px-2 py-1 rounded-lg active:bg-gray-100 transition-colors"
                    >
                        <i className="fa-regular fa-trash-can mr-1"></i> 刪除清單
                    </button>
                )}
             </div>
             
             {/* Scrollable Tabs */}
             <div className="flex overflow-x-auto no-scrollbar px-4 pb-2 gap-2">
               {lists.map(list => (
                   <button 
                    key={list.id}
                    onClick={() => setActiveListId(list.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${
                        activeListId === list.id 
                        ? 'bg-gray-900 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                   >
                     {list.name}
                   </button>
               ))}
               <button 
                 onClick={() => setShowAddListModal(true)}
                 className="whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold bg-ios-blue/10 text-ios-blue border border-ios-blue/20 active:bg-ios-blue/20 transition-colors"
               >
                 <i className="fa-solid fa-plus mr-1"></i> 新清單
               </button>
               {/* Spacer */}
               <div className="w-2 flex-shrink-0"></div>
             </div>
         </div>
       </div>

       {/* Content Area */}
       <div className="flex-1 overflow-y-auto relative z-10">
          <div className="p-6 space-y-6">
            
            {activeList ? (
                <>
                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
                        <span>完成進度 (Progress)</span>
                        <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-ios-green transition-all duration-500 ease-out" 
                            style={{ width: `${progress}%` }}
                        ></div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3">
                        {activeList.items.map(item => (
                        <div 
                            key={item.id}
                            className="group bg-white p-4 rounded-xl border border-gray-100 shadow-ios-sm flex items-center gap-4 active:scale-[0.99] transition-all relative overflow-hidden"
                        >
                            <button 
                                onClick={(e) => toggleItem(item.id, e)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                item.completed ? 'bg-ios-green border-ios-green' : 'border-gray-300'
                                }`}
                            >
                                {item.completed && <i className="fa-solid fa-check text-white text-xs"></i>}
                            </button>
                            
                            <div 
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => openItemDetail(item)}
                            >
                                <p className={`font-medium transition-all truncate ${
                                item.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                                }`}>
                                {item.text}
                                </p>
                                {item.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{item.notes}</p>}
                            </div>

                            <button 
                                onClick={() => openItemDetail(item)}
                                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-ios-blue transition-colors"
                            >
                                <i className="fa-solid fa-chevron-right text-sm"></i>
                            </button>
                        </div>
                        ))}
                        
                        {activeList.items.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                <i className="fa-solid fa-clipboard-list text-4xl mb-3 opacity-30"></i>
                                <p>這個清單還是空的</p>
                            </div>
                        )}

                        <button 
                            onClick={() => setShowAddItemModal(true)}
                            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
                        >
                            <i className="fa-solid fa-plus mr-2"></i> 新增項目
                        </button>
                    </div>
                </>
            ) : (
                <div className="text-center pt-20 text-gray-400">
                    <p>載入中或尚無清單...</p>
                </div>
            )}
            
            {/* Explicit Spacer for Bottom Tab Bar */}
            <div className="h-32 w-full"></div>
         </div>
       </div>

       {/* --- MODALS --- */}

       {/* Add List Modal */}
       {showAddListModal && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
               <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                   <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">建立新清單</h3>
                   <input 
                       className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none mb-4 font-bold text-center"
                       placeholder="例如: 購物清單"
                       value={newListName}
                       onChange={(e) => setNewListName(e.target.value)}
                       autoFocus
                   />
                   <div className="flex gap-3">
                       <button 
                           onClick={() => setShowAddListModal(false)}
                           className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-sm"
                       >
                           取消
                       </button>
                       <button 
                           onClick={handleAddList}
                           className="flex-1 bg-ios-blue text-white py-3 rounded-xl font-bold text-sm"
                           disabled={!newListName.trim()}
                       >
                           建立
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Add Item Modal */}
       {showAddItemModal && (
           <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
               <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-[slideUp_0.3s_ease-out]">
                   <h3 className="text-lg font-bold text-gray-900 mb-4">新增至 "{activeList?.name}"</h3>
                   <input 
                       className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none mb-4 text-lg"
                       placeholder="輸入項目名稱..."
                       value={newItemText}
                       onChange={(e) => setNewItemText(e.target.value)}
                       autoFocus
                   />
                   <button 
                        onClick={handleAddItem}
                        className="w-full bg-ios-blue text-white py-4 rounded-xl font-bold text-lg shadow-lg"
                        disabled={!newItemText.trim()}
                   >
                        加入清單
                   </button>
                   <button 
                        onClick={() => setShowAddItemModal(false)}
                        className="w-full mt-3 py-3 text-gray-400 font-bold"
                   >
                        取消
                   </button>
               </div>
           </div>
       )}

       {/* Delete List Confirmation */}
       {showDeleteListConfirm && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
               <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-[scaleIn_0.2s_ease-out] text-center">
                   <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                   </div>
                   <h3 className="text-lg font-bold text-gray-900 mb-2">刪除 "{activeList?.name}" ?</h3>
                   <p className="text-sm text-gray-500 mb-6">此動作無法復原，清單內的所有項目都將被刪除。</p>
                   
                   <div className="flex gap-3">
                       <button 
                           onClick={() => setShowDeleteListConfirm(false)}
                           className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-sm"
                       >
                           保留
                       </button>
                       <button 
                           onClick={handleDeleteList}
                           className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-red-200"
                       >
                           確認刪除
                       </button>
                   </div>
               </div>
           </div>
       )}

        {/* Item Detail Modal */}
        {selectedItem && itemForm && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
                <div className="bg-white w-full max-w-md h-[85vh] sm:h-auto sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]">
                    <div className="p-6 flex-1 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">編輯項目</h2>
                            <button onClick={() => setSelectedItem(null)} className="text-gray-400 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="space-y-4 pb-20">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">項目名稱</label>
                                <input 
                                    className="w-full border-b border-gray-200 py-2 text-lg font-bold outline-none focus:border-ios-blue"
                                    value={itemForm.text}
                                    onChange={(e) => setItemForm({...itemForm, text: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">備註</label>
                                <textarea 
                                    className="w-full bg-gray-50 rounded-lg px-3 py-2 mt-1 outline-none border border-transparent focus:border-ios-blue focus:bg-white transition-colors h-32 resize-none"
                                    placeholder="新增備註 (例如: 尺寸、顏色、購買連結...)"
                                    value={itemForm.notes || ''}
                                    onChange={(e) => setItemForm({...itemForm, notes: e.target.value})}
                                />
                            </div>

                            {/* Photos Section */}
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase flex items-center justify-between mb-2">
                                    <span>照片</span>
                                    <button 
                                        onClick={() => setShowPhotoActions(true)} 
                                        className="text-ios-blue text-[10px] bg-blue-50 px-2 py-1 rounded-full"
                                    >
                                        <i className="fa-solid fa-plus mr-1"></i>新增
                                    </button>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {itemForm.photos?.map((photo, idx) => (
                                        <div key={idx} className="relative aspect-square">
                                            <img src={photo} className="w-full h-full object-cover rounded-lg border border-gray-100" />
                                            <button 
                                                onClick={() => {
                                                    const newPhotos = itemForm.photos?.filter((_, i) => i !== idx);
                                                    setItemForm({...itemForm, photos: newPhotos});
                                                }}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
                                            >
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                        </div>
                                    ))}
                                    {(!itemForm.photos || itemForm.photos.length === 0) && (
                                        <button 
                                            onClick={() => setShowPhotoActions(true)}
                                            className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50"
                                        >
                                            <i className="fa-solid fa-camera mb-1"></i>
                                            <span className="text-xs">新增</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-white flex gap-3">
                        <button 
                            onClick={() => deleteItem(itemForm.id)}
                            className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold text-sm"
                        >
                            刪除項目
                        </button>
                        <button 
                            onClick={handleSaveItem}
                            className="flex-[2] bg-ios-blue text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200"
                        >
                            儲存變更
                        </button>
                    </div>
                </div>

                {/* Photo Action Sheet */}
                {showPhotoActions && (
                    <div className="absolute inset-0 z-[70] bg-black/30 backdrop-blur-sm flex items-end">
                        <div className="w-full p-4 space-y-2 animate-[slideUp_0.2s_ease-out]">
                             <div className="bg-white/90 backdrop-blur-md rounded-xl overflow-hidden shadow-lg">
                                <button 
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="w-full py-4 text-ios-blue text-lg font-medium border-b border-gray-200 active:bg-gray-50 transition-colors"
                                >
                                    開啟相機
                                </button>
                                <button 
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="w-full py-4 text-ios-blue text-lg font-medium active:bg-gray-50 transition-colors"
                                >
                                    從相簿選擇
                                </button>
                             </div>
                             <button 
                                onClick={() => setShowPhotoActions(false)}
                                className="w-full py-4 bg-white rounded-xl text-lg font-bold text-ios-blue shadow-lg active:scale-[0.98] transition-all"
                             >
                                取消
                             </button>
                        </div>
                        {/* Hidden Inputs */}
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFileSelect} />
                        <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default PlanningView;