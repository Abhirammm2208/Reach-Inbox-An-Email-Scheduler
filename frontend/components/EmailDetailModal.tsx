"use client";

import { ArrowLeft, Paperclip, Download, Calendar, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { SentEmailResponse, ScheduledEmailResponse } from "@/lib/api";

interface EmailDetailViewProps {
  email: SentEmailResponse | ScheduledEmailResponse;
  onBack: () => void;
  type: "scheduled" | "sent";
}

export function EmailDetailView({ email, onBack, type }: EmailDetailViewProps) {
  const isScheduled = type === "scheduled";
  const recipientEmails = isScheduled
    ? (email as ScheduledEmailResponse).recipientEmails
    : [(email as SentEmailResponse).recipientEmail];
  const timeField = isScheduled
    ? (email as ScheduledEmailResponse).scheduledAt
    : (email as SentEmailResponse).sentAt;
  
  // grab attachments if there are any
  const attachments = (email as any).attachments || [];

  const handleDownloadAttachment = (attachment: any) => {
    try {
      // convert base64 back to a blob
      const byteCharacters = atob(attachment.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.contentType });
      
      // create download link and click it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download attachment:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* top header with back button */}
      <div className="border-b border-gray-200 px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to emails</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{email.subject}</h1>
      </div>

      {/* main email content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* sender and recipient info */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
          <div className="space-y-4">
            {/* from field */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {email.senderEmail.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{email.senderEmail}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isScheduled ? "Scheduled for" : "Sent on"} {timeField ? format(new Date(timeField), "EEEE, MMMM d, yyyy 'at' h:mm a") : "Date not available"}
                </p>
              </div>
            </div>

            {/* to field */}
            <div className="pl-14">
              <p className="text-xs text-gray-500 mb-2">To</p>
              <div className="flex flex-wrap gap-2">
                {recipientEmails.map((recipient, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-sm"
                  >
                    {recipient}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* the actual email body */}
        <div className="mb-8">
          <div
            className="prose prose-base max-w-none text-gray-800"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />
        </div>

        {/* attachments if any */}
        {attachments.length > 0 && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              Attachments ({attachments.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {attachments.map((attachment: any, index: number) => {
                const isImage = attachment.contentType?.startsWith('image/');
                
                if (isImage) {
                  // image with preview
                  return (
                    <div
                      key={index}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleDownloadAttachment(attachment)}
                    >
                      <div className="relative h-32 bg-gray-100">
                        <img
                          src={`data:${attachment.contentType};base64,${attachment.content}`}
                          alt={attachment.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-900 truncate">{attachment.filename}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  );
                } else {
                  // regular file with download button
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Paperclip className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{attachment.filename}</p>
                          <p className="text-xs text-gray-500">
                            {(attachment.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadAttachment(attachment)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors ml-3 flex-shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
