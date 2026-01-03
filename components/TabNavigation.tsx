import React from 'react';
import { ViewTab } from '../types';

interface TabNavigationProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ currentTab, onTabChange }) => {
  const tabs: { id: ViewTab; label: string; icon: string }[] = [
    { id: 'schedule', label: '行程', icon: 'fa-map-location-dot' },
    { id: 'expense', label: '記帳', icon: 'fa-wallet' },
    { id: 'planning', label: '準備', icon: 'fa-suitcase-rolling' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200/50 pb-safe pt-1 z-50 shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex justify-around items-center max-w-md mx-auto h-[50px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all active:scale-95 duration-200 ${
              currentTab === tab.id ? 'text-ios-blue' : 'text-gray-400'
            }`}
          >
            <i className={`fa-solid ${tab.icon} text-xl mb-0.5`}></i>
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;