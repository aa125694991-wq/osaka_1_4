// WMO Weather Codes mapping helpers

export const getWeatherIconClass = (code?: number) => {
  if (code === undefined) return 'fa-sun';
  if (code <= 1) return 'fa-sun'; // Clear
  if (code <= 3) return 'fa-cloud-sun'; // Partly cloudy
  if (code <= 48) return 'fa-smog'; // Fog
  if (code <= 67) return 'fa-cloud-rain'; // Rain
  if (code <= 77) return 'fa-snowflake'; // Snow
  if (code <= 82) return 'fa-cloud-showers-heavy'; // Showers
  if (code <= 99) return 'fa-bolt'; // Thunderstorm
  return 'fa-cloud';
};

export const getWeatherColorClass = (code?: number) => {
  if (code === undefined) return 'text-gray-400';
  if (code <= 1) return 'text-yellow-400'; // Sunny - Bright Yellow
  if (code <= 3) return 'text-orange-400'; // Partly cloudy - Orange
  if (code <= 48) return 'text-gray-400'; // Fog - Gray
  if (code <= 67) return 'text-blue-400'; // Rain - Light Blue
  if (code <= 77) return 'text-cyan-400'; // Snow - Cyan
  if (code <= 82) return 'text-blue-600'; // Showers - Darker Blue
  if (code <= 99) return 'text-purple-500'; // Thunder - Purple
  return 'text-gray-400';
};

export const getWeatherGradientClass = (code?: number) => {
   if (code === undefined) return 'from-blue-500 to-blue-600';
   if (code <= 1) return 'from-blue-400 to-blue-600'; // Sunny - Bright Blue Sky
   if (code <= 3) return 'from-blue-400 to-slate-400'; // Cloudy - Blue to Grey
   if (code <= 48) return 'from-gray-400 to-gray-600'; // Fog - Grey
   if (code <= 67) return 'from-slate-600 to-blue-800'; // Rain - Dark Blue Grey
   if (code <= 77) return 'from-blue-400 to-cyan-600'; // Snow
   if (code <= 82) return 'from-blue-700 to-indigo-900'; // Heavy Rain - Deep Blue
   if (code <= 99) return 'from-indigo-800 to-purple-900'; // Thunder - Deep Purple
   return 'from-gray-500 to-gray-700';
};

export const getWeatherDescription = (code?: number) => {
  if (code === undefined) return '晴天';
  if (code <= 1) return '晴朗';
  if (code <= 3) return '多雲';
  if (code <= 48) return '霧';
  if (code <= 67) return '有雨';
  if (code <= 77) return '下雪';
  if (code <= 82) return '陣雨';
  if (code <= 99) return '雷雨';
  return '陰天';
};
