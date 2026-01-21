"use client";

import { Mail, Home, User, Send, Clock, BarChart2, Settings, LogOut, PlusCircle } from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { getStats } from "../lib/api";

interface SidebarProps {
  userEmail: string;
  userName: string;
  onLogout: () => void;
  onComposeClick: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({
  userEmail,
  userName,
  onLogout,
  onComposeClick,
  activeTab,
  onTabChange,
}: SidebarProps) {
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await getStats();
        setScheduledCount(stats.scheduled);
        setSentCount(stats.sent);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
    
    // refresh stats every 5 secs
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { id: "scheduled", label: "Scheduled", icon: Clock, badge: scheduledCount },
    { id: "sent", label: "Sent", icon: Send, badge: sentCount },
  ];

  // get user initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* app logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">ONB</h1>
      </div>

      {/* user info section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          </div>
        </div>
        
        {/* compose email button */}
        <button
          onClick={onComposeClick}
          className="w-full bg-[#4CAF50] hover:bg-[#45A049] text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* main nav menu */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={clsx(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg mb-2 transition-all",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={clsx(
                  "px-2 py-0.5 rounded-full text-xs font-semibold",
                  isActive ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                )}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* logout button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
