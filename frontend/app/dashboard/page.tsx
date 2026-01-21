"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession, signOut } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { EmailTable } from "@/components/EmailTable";
import { ComposeEmailModal } from "@/components/ComposeEmailModal";
import { EmailDetailView } from "@/components/EmailDetailModal";
import { getScheduledEmails, getSentEmails, getStats, ScheduledEmailResponse, SentEmailResponse } from "@/lib/api";
import { Mail, Send, Clock, CheckCircle2, XCircle, Inbox } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("scheduled");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmailResponse | SentEmailResponse | null>(null);

  useEffect(() => {
    // check if they're logged in (either nextauth or localstorage)
    if (status === "unauthenticated") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (!isLoggedIn) {
        router.push("/");
        return;
      }
    }

    // use nextauth session if available, otherwise fall back to localstorage
    if (status === "authenticated" && session?.user) {
      setUserEmail(session.user.email || "");
      setUserName(session.user.name || "User");
    } else {
      setUserEmail(localStorage.getItem("userEmail") || "");
      setUserName(localStorage.getItem("userName") || "");
    }
  }, [session, status, router]);

  const { data: scheduledData, isLoading: scheduledLoading } = useQuery({
    queryKey: ["scheduled", refreshKey],
    queryFn: () => getScheduledEmails(100),
    refetchInterval: 5000,
  });

  const { data: sentData, isLoading: sentLoading } = useQuery({
    queryKey: ["sent", refreshKey],
    queryFn: () => getSentEmails(100),
    refetchInterval: 5000,
  });

  const { data: statsData } = useQuery<{
    totalEmailsCreated: number;
    emailsSent: number;
    emailsFailed: number;
    pendingSchedules: number;
  }>({
    queryKey: ["stats", refreshKey],
    queryFn: getStats,
    refetchInterval: 5000,
  });

  const handleLogout = async () => {
    // Clear localStorage
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    
    // Sign out from NextAuth if authenticated
    if (status === "authenticated") {
      await signOut({ redirect: false });
    }
    
    router.push("/");
  };

  const handleComposeSave = () => {
    setRefreshKey((k) => k + 1);
    setIsComposeOpen(false);
  };

  const handleEmailClick = (email: ScheduledEmailResponse | SentEmailResponse) => {
    setSelectedEmail(email);
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
  };

  if (!userEmail) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        userEmail={userEmail}
        userName={userName}
        onLogout={handleLogout}
        onComposeClick={() => setIsComposeOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Search */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search emails..."
                className="w-full px-4 py-2 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <button 
              onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Email List or Detail View */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {selectedEmail ? (
            <EmailDetailView
              email={selectedEmail}
              onBack={handleBackToList}
              type={activeTab as "scheduled" | "sent"}
            />
          ) : (
            <div className="p-6">
              {activeTab === "scheduled" && (
                <EmailTable
                  emails={scheduledData?.data || []}
                  loading={scheduledLoading}
                  type="scheduled"
                  onEmailClick={handleEmailClick}
                />
              )}

              {activeTab === "sent" && (
                <EmailTable
                  emails={sentData?.data || []}
                  loading={sentLoading}
                  type="sent"
                  onEmailClick={handleEmailClick}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleComposeSave}
      />
    </div>
  );
}
