import React, { useState, useEffect, useRef } from 'react';
import { ScheduleEvent, WeatherInfo } from '../types';
import { INITIAL_DATES, INITIAL_EVENTS } from '../data/scheduleData';
import { getWeatherIconClass, getWeatherColorClass, getWeatherDescription } from '../utils/weatherUtils';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from '../utils/categoryConstants';

// Firebase Imports
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

// Components
import WeatherDetailModal from '../components/WeatherDetailModal';
import EventEditModal from '../components/EventEditModal';

// Animation Library
import { Reorder } from 'framer-motion';

// Workaround for type incompatibility with Reorder components
const ReorderGroup = Reorder.Group as any;
const ReorderItem = Reorder.Item as any;

// 離線預設資料 (Fallback)
const OFFLINE_WEATHER_DATA: Record<string, WeatherInfo> = {};
INITIAL_DATES.forEach(date => {
  OFFLINE_WEATHER_DATA[date] = {
    date,
    condition: 'sunny',
    conditionCode: 1, // Clear sky
    tempMax: 12,  
    tempMin: 5,
    apparentTempMax: 10,
    apparentTempMin: 3,
    currentTemp: 8,
    precipitationProb: 10,
    hourly: Array(24).fill(0).map((_, i) => ({
      time: `${String(i).padStart(2, '0')}:00`,
      temp: 8,
      conditionCode: 1,
      precipitationProb: 0
    }))
  };
});

const ScheduleView: React.FC = () => {
  // --- Firebase Data State ---
  const [dates, setDates] = useState<string[]>([]); 
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  // --- View State ---
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Reorder Mode State
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [localOrderedEvents, setLocalOrderedEvents] = useState<ScheduleEvent[]>([]);
  const [draggedEvent, setDraggedEvent] = useState<ScheduleEvent | null>(null);
  
  // Time Change Modal State
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeModalEvent, setTimeModalEvent] = useState<ScheduleEvent | null>(null);
  const [newTime, setNewTime] = useState('');
  
  // Weather State
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [city, setCity] = useState<string>('載入中...');
  
  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [isNewEvent, setIsNewEvent] = useState(false);

  // --- Pull to Refresh State ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80; // Pixels to pull down to trigger refresh

  // --- Firebase Real-time Sync Logic ---
  useEffect(() => {
    // 1. Sync Dates
    const datesRef = doc(db, 'schedule_meta', 'dates');
    const unsubDates = onSnapshot(datesRef, 
      (docSnap) => {
        setPermissionError(false);
        if (docSnap.exists()) {
          const loadedDates = docSnap.data().values as string[];
          setDates(loadedDates);
          if (!selectedDate && loadedDates.length > 0) {
              setSelectedDate(loadedDates[0]);
          }
        } else {
          // Initialization
          const batch = writeBatch(db);
          batch.set(datesRef, { values: INITIAL_DATES });
          INITIAL_EVENTS.forEach(ev => {
              const evRef = doc(db, 'schedule_events', ev.id);
              batch.set(evRef, ev);
          });
          batch.commit();
          setDates(INITIAL_DATES);
          setSelectedDate(INITIAL_DATES[0]);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') setPermissionError(true);
      }
    );

    // 2. Sync Events
    const eventsRef = collection(db, 'schedule_events');
    const unsubEvents = onSnapshot(eventsRef, (snapshot) => {
         const loadedEvents = snapshot.docs.map(d => d.data() as ScheduleEvent);
         setEvents(loadedEvents);
         setIsDataLoaded(true);
    });

    return () => {
      unsubDates();
      unsubEvents();
    };
  }, []);

  useEffect(() => {
    if (dates.length > 0 && (!selectedDate || !dates.includes(selectedDate))) {
        setSelectedDate(dates[0]);
    }
  }, [dates]);

  // Derived Events: Normal View (Sorted by Time) vs Reorder View (Local State)
  const currentEventsSorted = events.filter(e => e.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const currentWeather = weatherData[selectedDate];

  // Sync local reorder state when entering reorder mode or changing date
  useEffect(() => {
    if (!isReorderMode) {
        setLocalOrderedEvents(currentEventsSorted);
    }
  }, [selectedDate, events, isReorderMode]);

  // --- Weather Logic ---
  useEffect(() => {
    if (dates.length > 0) fetchWeather(dates);
  }, [dates.length]);

  const fetchWeather = async (targetDates: string[]) => {
    setCity('定位中...');

    // Osaka Coordinates (Default fallback)
    const OSAKA_LAT = 34.6937;
    const OSAKA_LON = 135.5023;

    // Helper: Fetch from Open-Meteo API
    const fetchFromApi = async (lat: number, lon: number) => {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
            if (!res.ok) throw new Error('API Error');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    // Helper: Reverse Geocode City Name
    const fetchCityName = async (lat: number, lon: number) => {
        try {
            // Using BigDataCloud Free API for city name
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`);
            if (!res.ok) return '目前位置';
            const data = await res.json();
            // Try different fields to get the best city name (e.g., "Taichung City", "Kyoto City")
            return data.city || data.locality || data.principalSubdivision || '目前位置';
        } catch (e) {
            console.warn("Reverse geocode failed", e);
            return '目前位置';
        }
    };

    // Helper: Map API data to our App State
    const updateWeatherState = (apiData: any, cityName: string) => {
        const newWeather: Record<string, WeatherInfo> = {};

        targetDates.forEach((dateStr, idx) => {
            if (!apiData) {
                // Completely failed, use offline hardcoded data
                newWeather[dateStr] = OFFLINE_WEATHER_DATA[dateStr] || OFFLINE_WEATHER_DATA[INITIAL_DATES[0]];
                return;
            }

            // The app uses 2026 dates, but API returns today+7 days.
            // We map the API's daily forecast index to our dates index to simulate dynamic data.
            const dailyIdx = idx % (apiData.daily.time.length || 1);
            
            const wCode = apiData.daily.weather_code[dailyIdx];
            const max = Math.round(apiData.daily.temperature_2m_max[dailyIdx]);
            const min = Math.round(apiData.daily.temperature_2m_min[dailyIdx]);
            const prob = apiData.daily.precipitation_probability_max?.[dailyIdx] ?? 0;
            const currentT = Math.round(apiData.current.temperature_2m);
            const currentApparent = Math.round(apiData.current.apparent_temperature);

            // Generate a simple curve for hourly temps based on max/min
            const hourly = Array(24).fill(0).map((_, h) => {
                const t = min + (max - min) * Math.sin((h - 4) * Math.PI / 14); 
                return {
                    time: `${String(h).padStart(2,'0')}:00`,
                    temp: Math.round(t > max ? max : t), 
                    conditionCode: wCode,
                    precipitationProb: prob
                };
            });

            newWeather[dateStr] = {
                date: dateStr,
                condition: 'sunny', // Legacy field
                conditionCode: wCode,
                tempMax: max,
                tempMin: min,
                apparentTempMax: max + 2,
                apparentTempMin: min - 2,
                currentTemp: currentT,
                currentApparentTemp: currentApparent,
                precipitationProb: prob,
                hourly: hourly
            };
        });

        setWeatherData(newWeather);
        setCity(cityName);
    };

    // Geolocation Flow
    if (!navigator.geolocation) {
        // Browser doesn't support -> Fallback to Osaka
        const data = await fetchFromApi(OSAKA_LAT, OSAKA_LON);
        updateWeatherState(data, '大阪 (Osaka)');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            // Success -> Use current location
            const { latitude, longitude } = position.coords;
            
            // Parallel fetch: Weather + City Name
            const [weatherData, detectedCity] = await Promise.all([
                fetchFromApi(latitude, longitude),
                fetchCityName(latitude, longitude)
            ]);
            
            updateWeatherState(weatherData, detectedCity);
        },
        async (error) => {
            // Error/Denied -> Fallback to Osaka
            console.warn("Geolocation failed, defaulting to Osaka.", error);
            const data = await fetchFromApi(OSAKA_LAT, OSAKA_LON);
            updateWeatherState(data, '大阪 (Osaka)');
        },
        { timeout: 6000, enableHighAccuracy: false }
    );
  };

  // --- Pull To Refresh Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
        touchStartRef.current = e.touches[0].clientY;
    } else {
        touchStartRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;

    // Only allow pulling if we are at the top and pulling down
    if (diff > 0 && scrollContainerRef.current?.scrollTop === 0) {
        // Add resistance (logarithmic or just division)
        setPullY(Math.min(diff * 0.4, 120)); 
    }
  };

  const handleTouchEnd = () => {
    if (pullY > PULL_THRESHOLD) {
        setIsRefreshing(true);
        // Simulate refresh (Firebase is realtime, so we just wait a bit to show feedback)
        setTimeout(() => {
            setIsRefreshing(false);
            setPullY(0);
            // Optionally re-fetch weather here
            fetchWeather(dates); 
        }, 1500);
    } else {
        setPullY(0);
    }
    touchStartRef.current = 0;
  };

  // --- Reorder Logic ---
  const handleReorderDragStart = (event: ScheduleEvent) => {
    setDraggedEvent(event);
  };

  const handleReorderComplete = (newOrder: ScheduleEvent[]) => {
    setLocalOrderedEvents(newOrder);
  };

  const handleDragEnd = () => {
     if (!draggedEvent) return;
     
     const index = localOrderedEvents.findIndex(e => e.id === draggedEvent.id);
     if (index === -1) return;

     const prevEvent = index > 0 ? localOrderedEvents[index - 1] : null;
     const nextEvent = index < localOrderedEvents.length - 1 ? localOrderedEvents[index + 1] : null;

     let suggestedTime = draggedEvent.time;
     
     if (prevEvent) {
         const [h, m] = prevEvent.time.split(':').map(Number);
         const date = new Date(); date.setHours(h); date.setMinutes(m + 30);
         suggestedTime = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
     } else if (nextEvent) {
         const [h, m] = nextEvent.time.split(':').map(Number);
         const date = new Date(); date.setHours(h); date.setMinutes(m - 30);
         suggestedTime = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
     }

     setTimeModalEvent(draggedEvent);
     setNewTime(suggestedTime);
     setShowTimeModal(true);
     setDraggedEvent(null);
  };

  const saveNewTime = async () => {
     if (timeModalEvent && newTime) {
         const updatedEvent = { ...timeModalEvent, time: newTime };
         try {
             await setDoc(doc(db, 'schedule_events', updatedEvent.id), updatedEvent);
             setShowTimeModal(false);
             setTimeModalEvent(null);
         } catch (e) {
             alert('更新失敗');
         }
     }
  };

  // --- Day Map Logic ---
  const handleOpenDayMap = () => {
    // Filter events that have a location name
    const validLocations = currentEventsSorted
        .map(e => e.location.name)
        .filter(name => name && name.trim() !== '');

    if (validLocations.length === 0) {
        alert("此日期尚無設定地點的行程");
        return;
    }

    // If only one location, open basic search
    if (validLocations.length === 1) {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(validLocations[0])}`;
        window.open(url, '_blank');
        return;
    }

    // If multiple locations, create a route (Directions)
    // Origin = First event, Destination = Last event, Waypoints = Everything in between
    const origin = encodeURIComponent(validLocations[0]);
    const destination = encodeURIComponent(validLocations[validLocations.length - 1]);
    
    // Google Maps API allows waypoints joined by pipe '|'
    // We take elements from index 1 to length-2
    const waypoints = validLocations.slice(1, -1).map(loc => encodeURIComponent(loc)).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
        url += `&waypoints=${waypoints}`;
    }
    // Set travel mode to transit (public transport) as default for Japan
    url += `&travelmode=transit`;

    window.open(url, '_blank');
  };


  // --- Event Handlers ---
  const handleAddNewEvent = () => {
    const newEvent: ScheduleEvent = {
      id: Date.now().toString(),
      date: selectedDate || dates[0],
      time: '12:00',
      title: '新行程',
      location: { name: '' },
      category: 'sightseeing',
      notes: '',
      reservationNumber: ''
    };
    setSelectedEvent(newEvent);
    setIsNewEvent(true);
  };

  const handleSaveEvent = async (updatedEvent: ScheduleEvent) => {
    await setDoc(doc(db, 'schedule_events', updatedEvent.id), updatedEvent);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = async (eventToDelete: ScheduleEvent) => {
    // Removed window.confirm here because the UI (EventEditModal) now handles the 2-step confirmation.
    // This makes the UI feel more responsive and consistent.
    await deleteDoc(doc(db, 'schedule_events', eventToDelete.id));
    setSelectedEvent(null);
  };

  const handleOpenMaps = (event: ScheduleEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免打開詳情視窗
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

  if (permissionError) {
     return <div className="p-10 text-center">請檢查 Firebase 權限設定</div>;
  }

  return (
    <div className="flex flex-col h-full bg-ios-bg">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200 shadow-sm pt-safe">
        <div className="px-6 pt-2 pb-3 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">日本大阪行</h1>
            <p className="text-sm text-gray-500 mt-1 font-medium flex items-center">
              <i className="fa-solid fa-location-dot mr-1 text-ios-red"></i> {city}
            </p>
          </div>
          
          <div className="flex gap-3">
              {/* Day Map Button */}
              {!isReorderMode && (
                  <button 
                      onClick={handleOpenDayMap}
                      className="w-10 h-10 rounded-full bg-white text-ios-blue border border-gray-200 shadow-sm flex items-center justify-center active:scale-90 transition-transform active:bg-gray-50"
                      title="在地圖上查看整天行程"
                  >
                      <i className="fa-solid fa-map-location-dot text-lg"></i>
                  </button>
              )}
              
              <button 
                  onClick={handleAddNewEvent} 
                  className="w-10 h-10 rounded-full bg-ios-blue text-white flex items-center justify-center shadow-lg shadow-blue-200 active:scale-90 transition-transform"
              >
                  <i className="fa-solid fa-plus text-xl"></i>
              </button>
          </div>
        </div>
        
        {/* Date Scroller (Hidden in Reorder Mode) */}
        {!isReorderMode && (
            <div className="flex overflow-x-auto no-scrollbar pb-4 gap-4 snap-x w-full min-h-[100px]">
                {/* Spacer to align with header (px-6 = w-6) but allow scrolling to edge */}
                <div className="w-6 flex-shrink-0"></div>
                
                {dates.map((date) => {
                    const dateObj = new Date(date);
                    const day = dateObj.getDate();
                    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                    const monthStr = monthNames[dateObj.getMonth()];
                    const w = weatherData[date];
                    const isSelected = date === selectedDate;
                    return (
                    <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`flex-shrink-0 snap-start flex flex-col items-center justify-center w-[4.5rem] h-20 rounded-2xl border transition-all duration-300 active:scale-95 ${
                        isSelected 
                            ? 'bg-ios-blue border-ios-blue text-white shadow-ios-md ring-2 ring-blue-100 ring-offset-1' 
                            : 'bg-white border-gray-100 text-gray-600'
                        }`}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'opacity-90' : 'opacity-60'}`}>{monthStr}</span>
                        <span className="text-2xl font-bold leading-none my-0.5">{day}</span>
                        <i className={`fa-solid ${getWeatherIconClass(w?.conditionCode)} text-xs mt-1 ${isSelected ? 'text-white' : getWeatherColorClass(w?.conditionCode)}`}></i>
                    </button>
                    );
                })}
                <div className="w-6 flex-shrink-0"></div>
            </div>
        )}
      </div>

      {/* Content Container with Pull-to-Refresh Logic */}
      <div 
         ref={scrollContainerRef}
         className="flex-1 overflow-y-auto relative"
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
      >
        {/* Pull to Refresh Indicator */}
        <div 
            className="absolute left-0 right-0 flex justify-center pointer-events-none z-0"
            style={{ 
                top: -50, 
                transform: `translateY(${isRefreshing ? 60 : pullY}px)`,
                transition: isRefreshing ? 'transform 0.3s ease-out' : 'none',
                opacity: pullY > 0 || isRefreshing ? 1 : 0
            }}
        >
            <div className="bg-white/80 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center shadow-md border border-gray-100">
                {isRefreshing ? (
                    <i className="fa-solid fa-spinner fa-spin text-ios-blue"></i>
                ) : (
                    <i className="fa-solid fa-arrow-down text-gray-500" style={{ transform: `rotate(${Math.min(pullY * 2, 180)}deg)` }}></i>
                )}
            </div>
        </div>

        <div 
            className="px-4 py-6 pb-24 space-y-6 transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${isRefreshing ? 10 : pullY * 0.3}px)` }}
        >
            
            {/* Weather Summary */}
            {!isReorderMode && (
                <button 
                onClick={() => currentWeather && setShowWeatherModal(true)}
                className="w-full bg-white rounded-2xl p-5 shadow-ios-sm flex items-center justify-between border border-gray-100 active:scale-[0.98] transition-transform text-left z-10 relative"
                >
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 text-2xl shadow-inner`}>
                        <i className={`fa-solid ${getWeatherIconClass(currentWeather?.conditionCode)} ${getWeatherColorClass(currentWeather?.conditionCode)}`}></i>
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 text-lg flex items-center gap-2">{city}</p>
                        <div className="text-xs text-gray-500 font-medium mt-1">
                            {selectedDate ? `${selectedDate.split('-')[1]}/${selectedDate.split('-')[2]}` : '--'} • {currentWeather ? getWeatherDescription(currentWeather.conditionCode) : '無資料'}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-3xl font-bold text-gray-900 tracking-tight">{currentWeather?.currentTemp ?? '--'}°</span>
                </div>
                </button>
            )}

            {/* Timeline vs Reorder List */}
            <div className={`relative ${!isReorderMode ? 'pl-4 border-l-2 border-gray-200 ml-4' : ''} space-y-4`}>
            
            {isReorderMode ? (
                /* --- Reorder Mode (Framer Motion) --- */
                <ReorderGroup axis="y" values={localOrderedEvents} onReorder={handleReorderComplete} className="space-y-3">
                    {localOrderedEvents.map((event) => (
                        <ReorderItem 
                            key={event.id} 
                            value={event}
                            onDragStart={() => handleReorderDragStart(event)}
                            onDragEnd={handleDragEnd}
                            className="touch-none select-none"
                        >
                            <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-dashed border-gray-300 flex items-center justify-between active:shadow-lg active:scale-[1.02] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-12 rounded-full ${CATEGORY_COLORS[event.category].split(' ')[0]}`}></div>
                                    <div>
                                        <p className="font-mono text-sm font-bold text-gray-500">{event.time}</p>
                                        <h3 className="font-bold text-gray-900">{event.title}</h3>
                                    </div>
                                </div>
                                <div className="text-gray-400 px-2">
                                    <i className="fa-solid fa-bars text-xl"></i>
                                </div>
                            </div>
                        </ReorderItem>
                    ))}
                    {localOrderedEvents.length === 0 && <p className="text-center text-gray-400 mt-10">此日期無行程可編輯</p>}
                </ReorderGroup>
            ) : (
                /* --- Standard Timeline Mode --- */
                currentEventsSorted.map((event) => (
                    <div key={event.id} className="relative group cursor-pointer" onClick={() => { setSelectedEvent(event); setIsNewEvent(false); }}>
                    <div className={`absolute -left-[25px] w-4 h-4 rounded-full border-2 border-white ring-2 ring-gray-100 ${CATEGORY_COLORS[event.category].split(' ')[0]}`}></div>
                    <div className="bg-white rounded-xl p-4 shadow-ios-sm border border-gray-100 transition-transform active:scale-[0.98]">
                        <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-semibold text-gray-400 font-mono tracking-tight">{event.time}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[event.category]}`}>
                            <i className={`fa-solid ${CATEGORY_ICONS[event.category]} mr-1`}></i>
                            {CATEGORY_LABELS[event.category]}
                        </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{event.title}</h3>
                        
                        {/* Reservation Number (Added Directly in List) */}
                        {event.reservationNumber && (
                           <div className="mt-1 mb-2 inline-block bg-slate-100 border border-slate-200 rounded-md px-2 py-1" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                 <i className="fa-solid fa-ticket text-slate-400 text-xs"></i>
                                 <span className="text-xs font-bold text-slate-700 tracking-wider font-mono">{event.reservationNumber}</span>
                                 <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(event.reservationNumber || '');
                                    }}
                                    className="ml-1 text-slate-400 active:text-slate-600 p-1 -m-1"
                                 >
                                    <i className="fa-regular fa-copy text-[10px]"></i>
                                 </button>
                              </div>
                           </div>
                        )}

                        {/* Render Photos if available */}
                        {event.photos && event.photos.length > 0 && (
                        <div className="mt-2 mb-2 flex gap-2 overflow-x-auto no-scrollbar">
                            {event.photos.map((photo, idx) => (
                            <img key={idx} src={photo} alt={event.title} className="h-24 w-auto rounded-lg object-cover shadow-sm border border-gray-100" />
                            ))}
                        </div>
                        )}

                        <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center text-gray-500 text-sm min-w-0 flex-1 mr-2">
                                <i className="fa-solid fa-location-dot mr-1.5 text-ios-red w-4 text-center shrink-0"></i>
                                <span className="truncate">{event.location.name || '未設定地點'}</span>
                            </div>
                            
                            {/* Direct Navigation Button - RESTORED */}
                            {event.location.name && (
                                <button 
                                    onClick={(e) => handleOpenMaps(event, e)}
                                    className="shrink-0 bg-blue-50 text-ios-blue text-xs font-bold px-3 py-1.5 rounded-full active:bg-blue-100 transition-colors flex items-center gap-1"
                                >
                                    <i className="fa-solid fa-location-arrow"></i> 導航
                                </button>
                            )}
                        </div>
                    </div>
                    </div>
                ))
            )}
            
            {!isDataLoaded && !isReorderMode && [1,2].map(i => <div key={i} className="bg-white rounded-xl h-24 animate-pulse"></div>)}
            </div>
        </div>
      </div>

      {/* --- TIME UPDATE MODAL --- */}
      {showTimeModal && timeModalEvent && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-50 text-ios-blue rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                        <i className="fa-regular fa-clock"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">更改時間</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        您移動了 "<span className="font-bold text-gray-700">{timeModalEvent.title}</span>"
                    </p>
                </div>
                
                <div className="mb-6">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">新時間</label>
                    <input 
                        type="time" 
                        className="w-full text-center text-3xl font-bold bg-gray-100 rounded-xl py-3 outline-none focus:ring-2 ring-ios-blue"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => { setShowTimeModal(false); setTimeModalEvent(null); }}
                        className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold"
                    >
                        取消
                    </button>
                    <button 
                        onClick={saveNewTime}
                        className="flex-1 bg-ios-blue text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200"
                    >
                        確認更改
                    </button>
                </div>
            </div>
         </div>
      )}

      {/* --- OTHER MODALS --- */}
      {showWeatherModal && currentWeather && (
        <WeatherDetailModal 
           weather={currentWeather} 
           city={city} 
           onClose={() => setShowWeatherModal(false)} 
        />
      )}

      {selectedEvent && (
        <EventEditModal 
          event={selectedEvent}
          isNew={isNewEvent}
          dates={dates}
          onClose={() => setSelectedEvent(null)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
};

export default ScheduleView;