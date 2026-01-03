import React, { useState } from 'react';
import { TodoItem } from '../types';

const INITIAL_TODOS: TodoItem[] = [
  { id: '1', text: '買網卡/eSIM', completed: true, assignedTo: 'Jimmy' },
  { id: '2', text: '預約和服體驗', completed: false, assignedTo: 'Serena' },
  { id: '3', text: '換日幣', completed: false, assignedTo: 'All' },
  { id: '4', text: '確認環球影城門票', completed: true, assignedTo: '媽媽' },
];

const INITIAL_PACKING: TodoItem[] = [
  { id: 'p1', text: '護照', completed: false },
  { id: 'p2', text: '行動電源', completed: false },
  { id: 'p3', text: '轉接頭', completed: true },
];

const PlanningView: React.FC = () => {
  const [activeList, setActiveList] = useState<'todo' | 'packing'>('todo');
  const [todos, setTodos] = useState(INITIAL_TODOS);
  const [packing, setPacking] = useState(INITIAL_PACKING);

  const currentList = activeList === 'todo' ? todos : packing;
  const setList = activeList === 'todo' ? setTodos : setPacking;

  const toggleItem = (id: string) => {
    setList(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const progress = Math.round((currentList.filter(i => i.completed).length / currentList.length) * 100) || 0;

  return (
    <div className="flex flex-col h-full bg-ios-bg">
       {/* Header: Added z-20 relative to ensure it stays on top of scrolling content */}
       <div className="px-6 pt-safe pt-4 pb-6 bg-white border-b border-gray-200 z-20 relative shadow-sm">
         <h1 className="text-2xl font-bold text-gray-900 mb-4">行前準備</h1>
         
         <div className="flex bg-gray-100 p-1 rounded-xl">
           <button 
             onClick={() => setActiveList('todo')}
             className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
               activeList === 'todo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
             }`}
           >
             待辦事項
           </button>
           <button 
             onClick={() => setActiveList('packing')}
             className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
               activeList === 'packing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
             }`}
           >
             行李清單
           </button>
         </div>
       </div>

       {/* Content Area */}
       <div className="flex-1 overflow-y-auto relative z-10">
          <div className="p-6 space-y-6">
            {/* Progress Bar */}
            <div>
                <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
                <span>進度 (Progress)</span>
                <span>{progress}%</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-ios-green transition-all duration-500 ease-out" 
                    style={{ width: `${progress}%` }}
                ></div>
                </div>
            </div>

            <div className="space-y-3">
                {currentList.map(item => (
                <div 
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className="group bg-white p-4 rounded-xl border border-gray-100 shadow-ios-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all"
                >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        item.completed ? 'bg-ios-green border-ios-green' : 'border-gray-300'
                    }`}>
                        {item.completed && <i className="fa-solid fa-check text-white text-xs"></i>}
                    </div>
                    
                    <div className="flex-1">
                        <p className={`font-medium transition-all ${
                        item.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                        }`}>
                        {item.text}
                        </p>
                        {item.assignedTo && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-1 inline-block">
                            @{item.assignedTo}
                        </span>
                        )}
                    </div>
                </div>
                ))}
                
                <button className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-medium hover:bg-gray-50 transition-colors">
                <i className="fa-solid fa-plus mr-2"></i> 新增項目
                </button>
            </div>
            
            {/* Explicit Spacer for Bottom Tab Bar */}
            <div className="h-32 w-full"></div>
         </div>
       </div>
    </div>
  );
};

export default PlanningView;