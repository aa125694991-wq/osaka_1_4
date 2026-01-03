
export type ViewTab = 'schedule' | 'expense' | 'planning';

export type Category = 'sightseeing' | 'food' | 'transport' | 'accommodation' | 'shopping';

export interface Location {
  lat?: number;
  lng?: number;
  name: string;
}

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  location: Location;
  category: Category;
  notes?: string;
  photos?: string[];
  reservationNumber?: string;
}

export interface Expense {
  id: string;
  amount: number;
  currency: 'TWD' | 'JPY';
  category: string;
  payer: string;
  splitWith: string[]; // names
  date: string;
  note?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  assignedTo?: string; // name or 'All'
}

export interface HourlyForecast {
  time: string; // HH:00
  temp: number;
  precipitationProb: number;
  conditionCode: number;
}

export interface WeatherInfo {
  date: string;
  condition: 'sunny' | 'cloudy' | 'rainy'; // Legacy for mock compatibility
  conditionCode?: number; // WMO code
  tempMin: number;
  tempMax: number;
  apparentTempMax?: number; // RealFeel High
  apparentTempMin?: number; // RealFeel Low
  currentTemp?: number;
  currentApparentTemp?: number; // Current RealFeel
  hourly?: HourlyForecast[];
  precipitationProb?: number;
  lastUpdated?: number; // Timestamp
}