import React from 'react';
import { WeatherInfo } from '../types';
import { getWeatherIconClass, getWeatherColorClass, getWeatherGradientClass, getWeatherDescription } from '../utils/weatherUtils';

interface WeatherDetailModalProps {
  weather: WeatherInfo;
  city: string;
  onClose: () => void;
}

const WeatherDetailModal: React.FC<WeatherDetailModalProps> = ({ weather, city, onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-0 sm:p-4">
      {/* 動態背景漸層 */}
      <div className={`bg-gradient-to-br ${getWeatherGradientClass(weather.conditionCode)} w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out] text-white`}>
          {/* Header */}
          <div className="p-6 pb-2 flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <i className="fa-solid fa-location-arrow text-sm"></i> {city}
                </h2>
                {/* 顯示詳細的日期 */}
                <p className="text-blue-100 text-sm opacity-80">{weather.date}</p>
            </div>
            <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 backdrop-blur-sm"
            >
                <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Current Status */}
          <div className="flex flex-col items-center justify-center py-6">
            <i className={`fa-solid ${getWeatherIconClass(weather.conditionCode)} text-6xl mb-4 drop-shadow-lg text-white`}></i>
            <div className="text-6xl font-bold tracking-tighter mb-2">
                {weather.currentTemp ?? Math.round((weather.tempMax + weather.tempMin) / 2)}°
            </div>
            <div className="text-lg font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm mb-1">
                {getWeatherDescription(weather.conditionCode)}
            </div>
            <div className="text-sm text-blue-100 font-medium">
                體感 {weather.currentApparentTemp ?? Math.round(((weather.apparentTempMax || 0) + (weather.apparentTempMin || 0)) / 2)}°
            </div>

            <div className="flex gap-4 mt-8 w-full px-6">
                <div className="flex-1 text-center bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-xs text-blue-100 opacity-70 mb-1">降雨機率</div>
                  <div className="text-xl font-bold"><i className="fa-solid fa-umbrella text-sm mr-1"></i>{weather.precipitationProb ?? 0}%</div>
                </div>
                <div className="flex-1 text-center bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-xs text-blue-100 opacity-70 mb-1">氣溫範圍</div>
                  <div className="text-xl font-bold">{weather.tempMax}° / {weather.tempMin}°</div>
                </div>
                <div className="flex-1 text-center bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-xs text-blue-100 opacity-70 mb-1">體感範圍</div>
                  <div className="text-xl font-bold">{weather.apparentTempMax}° / {weather.apparentTempMin}°</div>
                </div>
            </div>
          </div>

          {/* Hourly Forecast */}
          <div className="bg-white/90 backdrop-blur-xl text-gray-900 rounded-t-3xl p-6 pb-12">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">未來 24 小時預報</h3>
            <div className="flex overflow-x-auto no-scrollbar gap-4 pb-2">
                {weather.hourly?.map((hour, idx) => (
                  <div key={idx} className="flex-shrink-0 flex flex-col items-center gap-2 w-14">
                      <span className="text-xs font-bold text-gray-400">{hour.time}</span>
                      {/* 小時預報使用彩色圖示 */}
                      <i className={`fa-solid ${getWeatherIconClass(hour.conditionCode)} text-xl ${getWeatherColorClass(hour.conditionCode)}`}></i>
                      <span className="text-lg font-bold">{hour.temp}°</span>
                      <div className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                        {hour.precipitationProb}% <i className="fa-solid fa-droplet text-[8px]"></i>
                      </div>
                  </div>
                )) || <p className="text-sm text-gray-400">暫無詳細數據</p>}
            </div>
          </div>
      </div>
    </div>
  );
};

export default WeatherDetailModal;