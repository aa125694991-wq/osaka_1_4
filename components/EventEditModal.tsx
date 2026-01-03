import React, { useState, useEffect, useRef } from 'react';
import { ScheduleEvent, Category } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from '../utils/categoryConstants';

interface EventEditModalProps {
  event: ScheduleEvent;
  isNew: boolean;
  onClose: () => void;
  onSave: (event: ScheduleEvent) => void;
  onDelete: (event: ScheduleEvent) => void;
  dates: string[];
}

const EventEditModal: React.FC<EventEditModalProps> = ({ event, isNew, onClose, onSave, onDelete, dates }) => {
  // Local state for editing to keep parent clean
  const [isEditing, setIsEditing] = useState(isNew);
  const [editForm, setEditForm] = useState<Partial<ScheduleEvent>>({ ...event });
  
  // Photo Action Sheet State
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // In-App Camera State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset form when event changes
  useEffect(() => {
    setEditForm({ ...event });
    setIsEditing(isNew);
  }, [event, isNew]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleSave = () => {
    if (!editForm.title) return;
    const updatedEvent = {
        ...event,
        ...editForm,
        location: { ...event.location, name: editForm.location?.name || '' }
    } as ScheduleEvent;
    onSave(updatedEvent);
    setIsEditing(false);
  };

  const handleOpenMaps = () => {
    if (!event.location) return;
    const { name, lat, lng } = event.location;
    let query = '';
    if (lat && lng) {
      query = `${lat},${lng}`;
    } else if (name) {
      query = name;
    } else {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  // --- Photo Handling: Gallery ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert image to Base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      addPhoto(base64String);
      setShowPhotoActions(false);
    };
    reader.readAsDataURL(file);
  };

  // --- Photo Handling: Camera (WebRTC) ---
  const startCamera = async () => {
    try {
      setShowPhotoActions(false); // Close action sheet
      setShowCamera(true); // Open camera UI
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
            facingMode: 'environment', // Prefer rear camera on mobile
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        }, 
        audio: false
      });
      
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied or failed", err);
      alert("無法存取相機，請檢查權限或改用相簿上傳。");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Set canvas dimensions to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Horizontal flip for front camera? Usually environment is rear, no flip needed.
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 jpeg
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        addPhoto(base64Image);
        stopCamera();
    }
  };

  const addPhoto = (base64String: string) => {
    const currentPhotos = event.photos || [];
    const updatedEvent = {
      ...event,
      photos: [...currentPhotos, base64String]
    };
    // Save immediately
    onSave(updatedEvent);
  };

  // --- Helper to render text with links ---
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-ios-blue underline break-all active:opacity-60"
            onClick={(e) => e.stopPropagation()} // Prevent bubble
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-md h-[85vh] sm:h-auto sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]">
        
        <div className="p-6 flex-1 overflow-y-auto">
            {isEditing ? (
              /* 編輯模式 */
              <div className="space-y-4 pb-20">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">{isNew ? '新增行程' : '編輯行程'}</h2>
                    <button onClick={() => isNew ? onClose() : setIsEditing(false)} className="text-gray-400">取消</button>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">標題</label>
                  <input 
                    className="w-full border-b border-gray-200 py-2 text-lg font-bold outline-none focus:border-ios-blue"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    placeholder="輸入行程名稱"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">日期</label>
                    <select 
                      className="w-full border-b border-gray-200 py-2 bg-transparent outline-none"
                      value={editForm.date}
                      onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                    >
                        {dates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">時間</label>
                    <input 
                      type="time"
                      className="w-full border-b border-gray-200 py-2 outline-none"
                      value={editForm.time}
                      onChange={(e) => setEditForm({...editForm, time: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">類別</label>
                  <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar py-1">
                    {Object.keys(CATEGORY_COLORS).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setEditForm({...editForm, category: cat as Category})}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-colors ${
                            editForm.category === cat 
                            ? CATEGORY_COLORS[cat as Category] 
                            : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {CATEGORY_LABELS[cat as Category]}
                        </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">地點</label>
                  <input 
                    className="w-full border-b border-gray-200 py-2 outline-none"
                    value={editForm.location?.name || ''}
                    onChange={(e) => setEditForm({...editForm, location: {name: e.target.value}})}
                    placeholder="輸入地點名稱"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">預約編號</label>
                  <input 
                    className="w-full bg-gray-50 rounded-lg px-3 py-2 mt-1 outline-none border border-transparent focus:border-ios-blue focus:bg-white transition-colors"
                    value={editForm.reservationNumber || ''}
                    onChange={(e) => setEditForm({...editForm, reservationNumber: e.target.value})}
                    placeholder="例如: BK-2024-888"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">備註</label>
                  <textarea 
                    className="w-full bg-gray-50 rounded-lg px-3 py-2 mt-1 outline-none border border-transparent focus:border-ios-blue focus:bg-white transition-colors h-24 resize-none"
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                    {!isNew && (
                      <button onClick={() => onDelete(event)} className="flex-1 bg-red-100 text-red-600 py-3 rounded-xl font-bold text-sm">
                          刪除
                      </button>
                    )}
                    <button onClick={handleSave} className="flex-[2] bg-ios-blue text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200">
                      儲存
                    </button>
                </div>
              </div>
            ) : (
              /* 檢視模式 */
              <>
                {/* Header Section: Category & Close Button */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    CATEGORY_COLORS[event.category].includes('bg-ios-indigo') ? 'text-ios-indigo border-ios-indigo/20 bg-indigo-50' :
                    CATEGORY_COLORS[event.category].includes('bg-ios-orange') ? 'text-ios-orange border-ios-orange/20 bg-orange-50' :
                    CATEGORY_COLORS[event.category].includes('bg-ios-green') ? 'text-ios-green border-ios-green/20 bg-green-50' :
                    CATEGORY_COLORS[event.category].includes('bg-ios-pink') ? 'text-ios-pink border-ios-pink/20 bg-pink-50' :
                    'text-ios-blue border-ios-blue/20 bg-blue-50'
                  }`}>
                    {CATEGORY_LABELS[event.category]}
                  </span>
                  
                  <button 
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 active:scale-90 transition-transform"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-4">{event.title}</h2>

                {/* Action Buttons */}
                <div className="flex gap-3 mb-6">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-ios-blue text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-pen"></i> 編輯行程
                  </button>
                  <button 
                      onClick={() => setShowPhotoActions(true)}
                      className="flex-none w-14 bg-gray-100 text-gray-900 rounded-xl font-bold text-sm active:scale-95 transition-transform flex items-center justify-center"
                  >
                      <i className="fa-solid fa-camera text-lg"></i>
                  </button>
                </div>
                
                <div className="space-y-5">
                  {/* Reservation Number Card */}
                  {event.reservationNumber && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden flex flex-col justify-center">
                        <div className="flex justify-between items-center z-10">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">預約編號 (Booking No.)</p>
                            <p className="font-mono font-bold text-xl text-slate-800 tracking-wider">
                              {event.reservationNumber}
                            </p>
                          </div>
                          <div className="h-8 w-px bg-slate-200 mx-4"></div>
                          <button 
                            onClick={() => navigator.clipboard.writeText(event.reservationNumber || '')}
                            className="text-slate-400 hover:text-ios-blue active:scale-95 transition-transform"
                          >
                            <i className="fa-regular fa-copy text-xl"></i>
                          </button>
                        </div>
                        {/* Decoration */}
                        <div className="absolute -right-6 -bottom-6 text-slate-100/50 text-8xl">
                          <i className="fa-solid fa-ticket"></i>
                        </div>
                    </div>
                  )}

                  {/* Time Row */}
                  <div className="flex items-start gap-4">
                    <div className="w-8 flex justify-center pt-1">
                        <i className="fa-regular fa-clock text-gray-400 text-lg"></i>
                    </div>
                    <div className="flex-1 border-b border-gray-100 pb-4">
                      <p className="text-gray-900 font-medium text-lg">{event.time}</p>
                      <p className="text-gray-500 text-sm">{event.date}</p>
                    </div>
                  </div>
                  
                  {/* Location Row */}
                  <div className="flex items-start gap-4">
                      <div className="w-8 flex justify-center pt-1">
                        <i className="fa-solid fa-location-dot text-gray-400 text-lg"></i>
                      </div>
                      <div className="flex-1 border-b border-gray-100 pb-4">
                      <p className="text-gray-900 font-medium text-lg">{event.location.name}</p>
                      <button 
                        onClick={handleOpenMaps}
                        className="text-ios-blue text-sm font-medium mt-1 inline-flex items-center gap-1 active:opacity-60"
                      >
                          <i className="fa-solid fa-map-location-dot"></i> 在 Google Maps 開啟
                      </button>
                    </div>
                  </div>

                  {/* Photos Section */}
                  {event.photos && event.photos.length > 0 && (
                    <div className="mt-2 pt-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                          <i className="fa-solid fa-image"></i> 照片
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            {event.photos.map((photo, index) => (
                                <img 
                                    key={index}
                                    src={photo}
                                    alt={`photo-${index}`}
                                    className="w-full aspect-[4/3] object-cover rounded-xl shadow-sm border border-gray-100"
                                />
                            ))}
                        </div>
                    </div>
                  )}

                  {/* Notes Row */}
                  {event.notes && (
                    <div className="mt-2 pt-2 pb-10">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                          <i className="fa-solid fa-align-left"></i> 備註
                        </h4>
                        <div className="bg-gray-50 rounded-xl p-4 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap border border-gray-100 break-words">
                          {renderTextWithLinks(event.notes)}
                        </div>
                    </div>
                  )}
                </div>
              </>
            )}
        </div>
        
        {/* Photo Selection Action Sheet */}
        {showPhotoActions && (
          <div className="absolute inset-0 z-[70] bg-black/30 backdrop-blur-sm flex items-end">
            <div className="w-full p-4 space-y-2 animate-[slideUp_0.2s_ease-out]">
               <div className="bg-white/90 backdrop-blur-md rounded-xl overflow-hidden shadow-lg">
                  <button 
                      onClick={startCamera}
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
            
            {/* Hidden Input for Gallery only */}
            <input 
               ref={galleryInputRef}
               type="file" 
               accept="image/*" 
               hidden 
               onChange={handleFileSelect} 
            />
          </div>
        )}

        {/* In-App Camera UI Overlay */}
        {showCamera && (
            <div className="fixed inset-0 z-[80] bg-black flex flex-col items-center justify-between animate-[fadeIn_0.2s_ease-out]">
                {/* Camera Viewfinder */}
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <video 
                        ref={videoRef}
                        autoPlay 
                        playsInline 
                        muted 
                        className="absolute w-full h-full object-cover"
                    />
                </div>

                {/* Camera Controls */}
                <div className="absolute bottom-0 w-full p-8 pb-safe flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
                    <button 
                        onClick={stopCamera}
                        className="text-white font-medium p-4"
                    >
                        取消
                    </button>

                    {/* Shutter Button */}
                    <button 
                        onClick={capturePhoto}
                        className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 shadow-lg active:scale-95 transition-transform"
                    ></button>

                    <div className="w-12"></div> {/* Spacer for center alignment */}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default EventEditModal;