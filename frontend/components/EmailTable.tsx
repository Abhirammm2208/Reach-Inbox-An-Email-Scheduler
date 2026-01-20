"use client";

import { ScheduledEmailResponse, SentEmailResponse } from "@/lib/api";
import { format } from "date-fns";
import { CheckCircle, AlertCircle, Clock, Trash2, Mail } from "lucide-react";
import clsx from "clsx";

interface EmailTableProps {
  emails: ScheduledEmailResponse[] | SentEmailResponse[];
  loading?: boolean;
  type: "scheduled" | "sent";
  onDeleteClick?: (id: string) => void;
  onEmailClick?: (email: ScheduledEmailResponse | SentEmailResponse) => void;
}

export function EmailTable({ emails, loading, type, onDeleteClick, onEmailClick }: EmailTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="flex justify-center mb-4">
          <div className="bg-gray-100 p-4 rounded-full">
            <Mail className="w-12 h-12 text-gray-400" />
          </div>
        </div>
        <p className="text-gray-700 text-lg font-medium">No {type} emails yet</p>
        <p className="text-gray-500 text-sm mt-2">
          {type === "scheduled"
            ? "Create your first scheduled email to get started"
            : "Scheduled emails will appear here once sent"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {emails.map((email) => {
        const isScheduled = type === "scheduled";
        const recipientEmails = isScheduled
          ? (email as ScheduledEmailResponse).recipientEmails
          : [(email as SentEmailResponse).recipientEmail];
        const timeField = isScheduled
          ? (email as ScheduledEmailResponse).scheduledAt
          : (email as SentEmailResponse).sentAt;
        const status = isScheduled
          ? (email as ScheduledEmailResponse).status
          : (email as SentEmailResponse).status;
        const sentCount = isScheduled
          ? (email as ScheduledEmailResponse).sentCount
          : undefined;

        return (
          <div
            key={email.id}
            onClick={() => onEmailClick?.(email)}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Time Badge */}
                <div className="mb-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    <Clock className="w-3 h-3 mr-1" />
                    {format(new Date(timeField), "EEE M/dd:hh:mm a")}
                  </span>
                </div>

                {/* Recipients */}
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    To: {recipientEmails.slice(0, 2).join(", ")}
                    {recipientEmails.length > 2 && ` +${recipientEmails.length - 2} more`}
                  </span>
                </div>

                {/* Subject */}
                <h3 className="text-gray-900 font-semibold text-base mb-1">
                  {email.subject}
                </h3>

                {/* Preview */}
                <p className="text-gray-500 text-sm line-clamp-2">
                  {sentCount !== undefined && `${sentCount}/${recipientEmails.length} sent • `}
                  Email scheduled for delivery
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                {onDeleteClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(email.id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "sent":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle className="w-3.5 h-3.5" />
          Sent
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Clock className="w-3.5 h-3.5" />
          Pending
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle className="w-3.5 h-3.5" />
          Failed
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <div className="w-3.5 h-3.5 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
          Processing
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          {status}
        </span>
      );
  }
}
