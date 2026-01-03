import React, { useState, useEffect, useMemo } from 'react';
import { Expense } from '../types';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';

const DEFAULT_MEMBERS = ['Jimmy', 'Serena', '媽媽', '姊姊'];

const INITIAL_MOCK_EXPENSES: Expense[] = [
  { id: '1', amount: 1200, currency: 'JPY', category: 'Food', payer: 'Jimmy', splitWith: ['Jimmy', 'Serena'], date: '2024-11-15', note: '拉麵' },
  { id: '2', amount: 320, currency: 'JPY', category: 'Transport', payer: 'Serena', splitWith: ['Serena'], date: '2024-11-15', note: '地鐵' },
  { id: '3', amount: 15000, currency: 'JPY', category: 'Accommodation', payer: 'Jimmy', splitWith: DEFAULT_MEMBERS, date: '2024-11-15', note: '飯店訂金' },
];

const JPY_RATE = 0.215; // Mock rate

const CATEGORIES = ['美食', '交通', '購物', '住宿', '票券', '其他'];
const CATEGORY_MAP: Record<string, string> = {
  'Food': '美食',
  'Transport': '交通',
  'Shopping': '購物',
  'Accommodation': '住宿',
  'Tickets': '票券',
  'Other': '其他'
};

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

const ExpenseView: React.FC = () => {
  // --- Data State (Synced with Firebase) ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // --- View State ---
  const [viewMode, setViewMode] = useState<'dashboard' | 'history'>('dashboard');
  const [historyTab, setHistoryTab] = useState<'list' | 'balance'>('list');

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  
  // Member Edit Temp State
  const [editingMembers, setEditingMembers] = useState<string[]>([]);
  
  // Add Expense Form State
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [payer, setPayer] = useState('');
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // --- Firebase Sync ---
  useEffect(() => {
    // 1. Sync Expenses
    const expensesRef = collection(db, 'expenses');
    // Order by date desc, then by created timestamp (id)
    const q = query(expensesRef); // Client-side sorting is often easier for small lists, but here we query all

    const unsubExpenses = onSnapshot(q, (snapshot) => {
        if (snapshot.empty && !loading) {
             // Optional: Seed if empty? We'll leave it empty to be clean, or seed once.
             // For now, let's just let it be empty.
        }
        
        const loadedExpenses = snapshot.docs.map(d => d.data() as Expense);
        // Sort descending locally
        loadedExpenses.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return Number(b.id) - Number(a.id);
        });
        setExpenses(loadedExpenses);
    });

    // 2. Sync Members
    const membersRef = doc(db, 'expense_meta', 'config');
    const unsubMembers = onSnapshot(membersRef, (docSnap) => {
        if (docSnap.exists()) {
            const list = docSnap.data().members as string[];
            setMembers(list);
            setEditingMembers(list);
            // Initialization for forms
            if (list.length > 0) {
                 if (!payer) setPayer(list[0]);
                 if (splitWith.length === 0) setSplitWith(list);
            }
        } else {
            // Initialize Default Members
            setDoc(membersRef, { members: DEFAULT_MEMBERS });
            setMembers(DEFAULT_MEMBERS);
            
            // Also Seed Initial Expenses for demo purposes if it's a fresh DB
            const batch = writeBatch(db);
            INITIAL_MOCK_EXPENSES.forEach(exp => {
                batch.set(doc(db, 'expenses', exp.id), exp);
            });
            batch.commit();
        }
        setLoading(false);
    });

    return () => {
        unsubExpenses();
        unsubMembers();
    };
  }, []);

  // Update form defaults when members load
  useEffect(() => {
     if (members.length > 0 && !payer) {
         setPayer(members[0]);
         setSplitWith(members);
     }
  }, [members]);

  // Calculations
  const totalJPY = expenses.filter(e => e.currency === 'JPY').reduce((acc, cur) => acc + cur.amount, 0);
  const totalTWD = expenses.filter(e => e.currency === 'TWD').reduce((acc, cur) => acc + cur.amount, 0) + (totalJPY * JPY_RATE);

  // --- Logic: Split Algorithm ---
  const { balances, settlements } = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach(m => bal[m] = 0);

    // 1. Calculate Net Balance (in TWD)
    expenses.forEach(exp => {
        // Normalize to TWD for settlement
        const amountTWD = exp.currency === 'JPY' ? exp.amount * JPY_RATE : exp.amount;
        
        // Payer gets positive credit
        if (bal[exp.payer] !== undefined) {
            bal[exp.payer] += amountTWD;
        }

        // Splitters get negative credit (debt)
        const splitAmount = amountTWD / exp.splitWith.length;
        exp.splitWith.forEach(person => {
            if (bal[person] !== undefined) {
                bal[person] -= splitAmount;
            }
        });
    });

    // 2. Calculate Settlements (Who owes whom)
    const debtors: {name: string, amount: number}[] = [];
    const creditors: {name: string, amount: number}[] = [];

    Object.entries(bal).forEach(([name, amount]) => {
        const val = Math.round(amount); // Round to integer for cleaner display
        if (val < -1) debtors.push({ name, amount: val }); // use -1 to ignore floating point dust
        if (val > 1) creditors.push({ name, amount: val });
    });

    debtors.sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    const results: Settlement[] = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        
        // The amount to settle is the minimum of what debtor owes and creditor needs
        const amount = Math.min(Math.abs(debtor.amount), creditor.amount);
        
        results.push({
            from: debtor.name,
            to: creditor.name,
            amount: amount
        });

        // Adjust remaining amounts
        debtor.amount += amount;
        creditor.amount -= amount;

        // Move indices if settled
        if (Math.abs(debtor.amount) < 1) i++;
        if (creditor.amount < 1) j++;
    }

    return { balances: bal, settlements: results };
  }, [expenses, members]);

  // --- Handlers ---

  const handleAdd = async () => {
    if (!amountInput) return;
    
    const newId = Date.now().toString();
    const newExpense: Expense = {
      id: newId,
      amount: parseFloat(amountInput),
      currency: 'JPY', // Default to JPY for Japan trip
      category,
      payer,
      splitWith,
      date: new Date().toISOString().split('T')[0],
      note: note || category
    };

    try {
        await setDoc(doc(db, 'expenses', newId), newExpense);
        resetForm();
        setShowAddModal(false);
    } catch (e) {
        alert("儲存失敗，請檢查網路");
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    const confirmDelete = window.confirm("確定要刪除這筆款項嗎？此動作無法復原。");
    if (confirmDelete) {
        await deleteDoc(doc(db, 'expenses', selectedExpense.id));
        setSelectedExpense(null);
    }
  };

  const resetForm = () => {
    setAmountInput('');
    setCategory(CATEGORIES[0]);
    if (members.length > 0) {
        setPayer(members[0]);
        setSplitWith(members);
    }
    setNote('');
  };

  const toggleSplitMember = (member: string) => {
    if (splitWith.includes(member)) {
      if (splitWith.length > 1) { 
         setSplitWith(splitWith.filter(m => m !== member));
      }
    } else {
      setSplitWith([...splitWith, member]);
    }
  };

  const saveMembers = async () => {
     const validMembers = editingMembers.filter(m => m.trim() !== '');
     if (validMembers.length > 0) {
        await setDoc(doc(db, 'expense_meta', 'config'), { members: validMembers });
        // Ensure payer/split are valid locally immediately for better UX
        if (!validMembers.includes(payer)) setPayer(validMembers[0]);
        setSplitWith(validMembers);
     }
     setShowMemberModal(false);
  };

  const updateMemberName = (index: number, newName: string) => {
    const newMembers = [...editingMembers];
    newMembers[index] = newName;
    setEditingMembers(newMembers);
  };

  const addMemberSlot = () => {
    setEditingMembers([...editingMembers, '新成員']);
  };

  const removeMemberSlot = (index: number) => {
     if (editingMembers.length <= 1) return;
     const newMembers = editingMembers.filter((_, i) => i !== index);
     setEditingMembers(newMembers);
  };

  const getCategoryIcon = (cat: string) => {
      if (['Food', '美食'].includes(cat)) return 'fa-utensils';
      if (['Transport', '交通'].includes(cat)) return 'fa-train';
      if (['Accommodation', '住宿'].includes(cat)) return 'fa-bed';
      if (['Shopping', '購物'].includes(cat)) return 'fa-bag-shopping';
      if (['Tickets', '票券'].includes(cat)) return 'fa-ticket';
      return 'fa-tag';
  };

  const getCategoryColor = (cat: string) => {
      if (['Food', '美食'].includes(cat)) return 'bg-ios-orange';
      if (['Transport', '交通'].includes(cat)) return 'bg-ios-green';
      if (['Accommodation', '住宿'].includes(cat)) return 'bg-ios-pink';
      if (['Shopping', '購物'].includes(cat)) return 'bg-ios-blue';
      return 'bg-ios-indigo';
  };

  // --- Render Sub-Components ---

  const renderExpenseItem = (exp: Expense) => (
    <div 
        key={exp.id} 
        onClick={() => setSelectedExpense(exp)}
        className="bg-white p-4 rounded-xl shadow-ios-sm border border-gray-100 flex items-center justify-between active:scale-[0.99] transition-transform cursor-pointer"
    >
       <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${getCategoryColor(exp.category)}`}>
             <i className={`fa-solid ${getCategoryIcon(exp.category)}`}></i>
          </div>
          <div>
             <p className="font-bold text-gray-900">{exp.note || (CATEGORY_MAP[exp.category] || exp.category)}</p>
             <p className="text-xs text-gray-500">
               {exp.payer} 已付 • 
               <span className="ml-1 text-ios-indigo">{exp.splitWith.length === members.length ? '全體' : `${exp.splitWith.length} 人`}</span>
             </p>
          </div>
       </div>
       <div className="text-right">
          <p className="font-bold text-gray-900">¥{exp.amount.toLocaleString()}</p>
          <p className="text-xs text-gray-400">≈ NT${Math.round(exp.amount * JPY_RATE)}</p>
       </div>
    </div>
  );

  // --- Main View Render ---

  if (viewMode === 'history') {
      return (
        <div className="flex flex-col h-full bg-gray-50 animate-[fadeIn_0.2s_ease-out]">
            {/* History Header: Added z-20 */}
            <div className="bg-white pt-safe border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                 <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-4">
                        <button 
                            onClick={() => setViewMode('dashboard')}
                            className="text-ios-blue flex items-center gap-1 text-lg font-medium active:opacity-60"
                        >
                            <i className="fa-solid fa-chevron-left"></i> 返回
                        </button>
                        <h2 className="text-lg font-bold text-gray-900">帳務明細</h2>
                        <div className="w-10"></div>
                    </div>

                    {/* Segmented Control */}
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-2">
                    <button 
                        onClick={() => setHistoryTab('list')}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${
                        historyTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                        }`}
                    >
                        交易明細
                    </button>
                    <button 
                        onClick={() => setHistoryTab('balance')}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${
                        historyTab === 'balance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                        }`}
                    >
                        分帳結算
                    </button>
                    </div>
                 </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {historyTab === 'list' ? (
                    expenses.length === 0 ? (
                        <div className="text-center text-gray-400 mt-20">
                            <i className="fa-solid fa-receipt text-4xl mb-3"></i>
                            <p>目前沒有任何記錄</p>
                        </div>
                    ) : (
                        expenses.map(renderExpenseItem)
                    )
                ) : (
                    <div className="space-y-6">
                        {/* Summary of Balances */}
                        <div className="bg-white rounded-2xl p-5 shadow-ios-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-scale-balanced text-ios-indigo"></i>
                                收支淨額表 (TWD)
                            </h3>
                            <div className="space-y-3">
                                {members.map(member => {
                                    const bal = Math.round(balances[member] || 0);
                                    return (
                                        <div key={member} className="flex justify-between items-center pb-2 border-b border-gray-50 last:border-0">
                                            <span className="font-medium text-gray-700">{member}</span>
                                            <span className={`font-bold font-mono ${bal >= 0 ? 'text-ios-green' : 'text-ios-red'}`}>
                                                {bal > 0 ? '+' : ''}{bal.toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Settlement Plan */}
                        {settlements.length > 0 ? (
                             <div className="space-y-3">
                                <h3 className="font-bold text-gray-500 text-xs uppercase px-2">建議轉帳方式</h3>
                                {settlements.map((s, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl shadow-ios-sm border-l-4 border-ios-blue flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="text-center">
                                                <div className="font-bold text-gray-900">{s.from}</div>
                                                <div className="text-[10px] text-gray-400 bg-gray-100 rounded px-1">支付</div>
                                            </div>
                                            <i className="fa-solid fa-arrow-right text-gray-300"></i>
                                            <div className="text-center">
                                                <div className="font-bold text-gray-900">{s.to}</div>
                                                <div className="text-[10px] text-gray-400 bg-gray-100 rounded px-1">收款</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-ios-blue">
                                                <span className="text-sm mr-1">NT$</span>
                                                {Math.round(s.amount).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        ) : (
                            <div className="text-center text-gray-400 py-10 bg-white rounded-2xl border border-dashed">
                                <i className="fa-solid fa-check-circle text-4xl mb-2 text-ios-green"></i>
                                <p>目前已結清，無需轉帳</p>
                            </div>
                        )}
                        
                        <p className="text-center text-xs text-gray-400 mt-4">
                            * 此金額依據匯率 {JPY_RATE} 計算
                        </p>
                    </div>
                )}

                {/* Explicit Spacer for Bottom Tab Bar */}
                <div className="h-32 w-full"></div>
            </div>

            {/* Reuse Detail Modal logic below */}
            {selectedExpense && renderDetailModal()}
        </div>
      );
  }

  // Dashboard View
  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
       {/* Dashboard Header: z-20 for high layer priority */}
       <div className="bg-ios-indigo px-6 pt-safe pt-2 pb-12 rounded-b-[2.5rem] shadow-lg relative z-20 shrink-0">
         <div className="flex justify-between items-center mb-6 pt-2">
            <div className="flex items-center gap-2">
               <h1 className="text-2xl font-bold text-white">支出總覽</h1>
               <button onClick={() => setShowMemberModal(true)} className="bg-white/20 px-2 py-0.5 rounded-lg text-white/90 text-xs font-medium backdrop-blur-sm active:bg-white/30">
                  <i className="fa-solid fa-user-group mr-1"></i>
                  {members.length}人
               </button>
            </div>
            <button 
                onClick={() => setViewMode('history')}
                className="bg-white/20 p-2 rounded-full text-white backdrop-blur-sm active:scale-90 transition-transform"
            >
              <i className="fa-solid fa-list-ul"></i>
            </button>
         </div>
         
         <div className="text-white">
            <p className="text-ios-indigo-100 text-sm mb-1">總支出 (預估台幣)</p>
            <div className="text-4xl font-bold tracking-tight">
               <span className="text-2xl opacity-70 mr-1">NT$</span>
               {Math.round(totalTWD).toLocaleString()}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm opacity-80">
               <i className="fa-solid fa-yen-sign"></i>
               <span>{totalJPY.toLocaleString()} JPY</span>
               <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">匯率: {JPY_RATE}</span>
            </div>
         </div>
       </div>

       {/* Recent Expense List: z-10 */}
       <div className="flex-1 overflow-y-auto px-4 -mt-6 pt-8 space-y-4 relative z-10">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-bold text-gray-700">近期消費明細</h3>
            <button 
                onClick={() => setViewMode('history')}
                className="text-ios-blue text-sm font-medium active:opacity-60"
            >
                查看全部
            </button>
          </div>

          {expenses.slice(0, 5).map(renderExpenseItem)}
          
          {expenses.length === 0 && (
             <p className="text-center text-gray-400 py-8 text-sm">點擊右下角 + 開始記帳</p>
          )}

          {/* Explicit Spacer for Bottom Tab Bar */}
          <div className="h-32 w-full"></div>
       </div>

       {/* Floating Action Button */}
       <button 
         onClick={() => setShowAddModal(true)}
         className="absolute right-6 w-14 h-14 bg-ios-blue text-white rounded-full shadow-lg shadow-blue-300 flex items-center justify-center text-2xl active:scale-90 transition-transform z-30"
         style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }} 
       >
         <i className="fa-solid fa-plus"></i>
       </button>

       {/* --- MODALS --- */}

       {/* Add Expense Modal */}
       {showAddModal && (
         <div className="fixed inset-0 z-[60] flex items-end bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-h-[90%] overflow-y-auto rounded-t-3xl p-6 pb-20 animate-[slideUp_0.3s_ease-out] shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">新增記帳</h2>
                  <button onClick={() => setShowAddModal(false)} className="text-gray-400 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
               </div>

               <div className="mb-6">
                  <label className="text-xs font-bold text-gray-400 uppercase">金額 (日幣)</label>
                  <div className="flex items-center border-b-2 border-ios-blue py-2">
                     <span className="text-3xl font-bold text-gray-900 mr-2">¥</span>
                     <input 
                       type="number" 
                       inputMode="decimal"
                       value={amountInput}
                       onChange={(e) => setAmountInput(e.target.value)}
                       className="w-full text-4xl font-bold outline-none bg-transparent placeholder-gray-200"
                       placeholder="0"
                       autoFocus
                     />
                  </div>
                  <p className="text-right text-sm text-gray-500 mt-2">
                     ≈ NT$ {amountInput ? Math.round(parseFloat(amountInput) * JPY_RATE) : 0}
                  </p>
               </div>
               
               <div className="space-y-4 mb-6">
                  <div>
                     <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">類別</label>
                     <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {CATEGORIES.map(c => (
                           <button 
                              key={c}
                              onClick={() => setCategory(c)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-all ${
                                 category === c ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600'
                              }`}
                           >
                              {c}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">付款人 (誰付錢?)</label>
                     <div className="grid grid-cols-4 gap-2">
                        {members.map(m => (
                           <button 
                              key={m}
                              onClick={() => setPayer(m)}
                              className={`py-2 rounded-lg text-sm font-bold transition-all truncate ${
                                 payer === m ? 'bg-ios-blue text-white shadow-md' : 'bg-gray-100 text-gray-500'
                              }`}
                           >
                              {m}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">分攤對象</label>
                     <div className="flex gap-2 mb-2">
                        <button 
                           onClick={() => setSplitWith(members)}
                           className={`px-3 py-1 rounded text-xs font-bold ${splitWith.length === members.length ? 'bg-ios-indigo text-white' : 'bg-gray-100 text-gray-500'}`}
                        >
                           全體
                        </button>
                     </div>
                     <div className="grid grid-cols-4 gap-2">
                        {members.map(m => (
                           <button 
                              key={m}
                              onClick={() => toggleSplitMember(m)}
                              className={`py-2 rounded-lg text-sm font-bold border-2 transition-all flex items-center justify-center gap-1 truncate ${
                                 splitWith.includes(m) ? 'border-ios-green text-ios-green bg-green-50' : 'border-transparent bg-gray-50 text-gray-400'
                              }`}
                           >
                              {splitWith.includes(m) && <i className="fa-solid fa-check text-[10px]"></i>}
                              {m}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">備註</label>
                      <input 
                        className="w-full bg-gray-50 rounded-xl px-4 py-3 outline-none"
                        placeholder="這筆錢是用來做什麼的？"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                  </div>
               </div>

               <button 
                 onClick={handleAdd}
                 className="w-full bg-ios-blue text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
               >
                 儲存
               </button>
            </div>
         </div>
       )}

       {/* Edit Members Modal */}
       {showMemberModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
             <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                <h2 className="text-xl font-bold mb-4">成員管理</h2>
                <div className="space-y-3 mb-6">
                   {editingMembers.map((m, idx) => (
                      <div key={idx} className="flex gap-2">
                         <input 
                           value={m}
                           onChange={(e) => updateMemberName(idx, e.target.value)}
                           className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-ios-blue transition-colors"
                           placeholder="輸入名字"
                         />
                         <button 
                           onClick={() => removeMemberSlot(idx)}
                           className={`w-10 rounded-xl flex items-center justify-center ${editingMembers.length > 1 ? 'text-red-500 bg-red-50' : 'text-gray-300 bg-gray-100'}`}
                           disabled={editingMembers.length <= 1}
                         >
                            <i className="fa-solid fa-trash"></i>
                         </button>
                      </div>
                   ))}
                   <button onClick={addMemberSlot} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 text-sm font-bold">
                      + 新增成員
                   </button>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => setShowMemberModal(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">取消</button>
                   <button onClick={saveMembers} className="flex-1 bg-ios-blue text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200">儲存設定</button>
                </div>
             </div>
          </div>
       )}
    
       {/* Expense Detail & Delete Modal */}
       {selectedExpense && renderDetailModal()}
    </div>
  );

  function renderDetailModal() {
      if (!selectedExpense) return null;
      return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
             <div className="h-32 bg-gray-100 relative flex flex-col items-center justify-center border-b border-gray-200">
                 <button 
                    onClick={() => setSelectedExpense(null)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white rounded-full text-gray-500 shadow-sm active:scale-95"
                 >
                    <i className="fa-solid fa-xmark"></i>
                 </button>
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl mb-2 shadow-lg ${getCategoryColor(selectedExpense.category)}`}>
                     <i className={`fa-solid ${getCategoryIcon(selectedExpense.category)}`}></i>
                 </div>
                 <div className="text-2xl font-bold text-gray-900">¥{selectedExpense.amount.toLocaleString()}</div>
                 <div className="text-xs text-gray-500">≈ NT${Math.round(selectedExpense.amount * JPY_RATE)}</div>
             </div>
             
             <div className="p-6 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">項目</label>
                    <p className="text-lg font-medium text-gray-900">{selectedExpense.note || (CATEGORY_MAP[selectedExpense.category] || selectedExpense.category)}</p>
                 </div>
                 
                 <div className="flex gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">日期</label>
                        <p className="font-medium text-gray-800">{selectedExpense.date}</p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">類別</label>
                        <p className="font-medium text-gray-800">{CATEGORY_MAP[selectedExpense.category] || selectedExpense.category}</p>
                    </div>
                 </div>

                 <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                        <span className="text-sm text-gray-500">付款人</span>
                        <span className="font-bold text-gray-900">{selectedExpense.payer}</span>
                    </div>
                    <div>
                        <span className="text-sm text-gray-500 block mb-1">分攤對象</span>
                        <div className="flex flex-wrap gap-1">
                            {selectedExpense.splitWith.map(name => (
                                <span key={name} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-600">
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>
                 </div>

                 <button 
                    onClick={handleDelete}
                    className="w-full py-3 mt-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                 >
                    <i className="fa-regular fa-trash-can"></i> 刪除此筆記錄
                 </button>
             </div>
          </div>
        </div>
      );
  }
};

export default ExpenseView;