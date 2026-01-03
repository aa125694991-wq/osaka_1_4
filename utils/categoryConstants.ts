import { Category } from '../types';

export const CATEGORY_COLORS: Record<Category, string> = {
  sightseeing: 'bg-ios-indigo text-white',
  food: 'bg-ios-orange text-white',
  transport: 'bg-ios-green text-white',
  accommodation: 'bg-ios-pink text-white',
  shopping: 'bg-ios-blue text-white'
};

export const CATEGORY_LABELS: Record<Category, string> = {
  sightseeing: '觀光',
  food: '美食',
  transport: '交通',
  accommodation: '住宿',
  shopping: '購物'
};

export const CATEGORY_ICONS: Record<Category, string> = {
  sightseeing: 'fa-camera',
  food: 'fa-utensils',
  transport: 'fa-train-subway',
  accommodation: 'fa-bed',
  shopping: 'fa-bag-shopping'
};
