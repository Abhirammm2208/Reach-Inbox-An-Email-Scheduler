"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { LogOut, Mail } from "lucide-react";

interface HeaderProps {
  userEmail?: string;
  userName?: string;
  userImage?: string;
  onLogout?: () => void;
}

export function Header({ userEmail, userName, userImage, onLogout }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Mail className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">ReachInbox</h1>
        </Link>

        <div className="flex items-center gap-4">
          {userImage && (
            <img
              src={userImage}
              alt="User avatar"
              className="w-10 h-10 rounded-full"
            />
          )}
          <div className="text-sm">
            {userName && <p className="font-medium text-gray-900">{userName}</p>}
            {userEmail && <p className="text-gray-500">{userEmail}</p>}
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="btn btn-secondary btn-sm flex gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
