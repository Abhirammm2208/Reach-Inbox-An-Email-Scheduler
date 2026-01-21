"use client";

import { useState, useRef, useEffect } from "react";
import { scheduleEmail, sendEmail as sendEmailNow } from "@/lib/api";
import Papa from "papaparse";
import { Upload, AlertCircle, X, Send, Clock, ChevronDown, Bold, Italic, Underline, List, ListOrdered, AlignLeft, Link2, Image as ImageIcon, Smile } from "lucide-react";

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ComposeEmailModal({ isOpen, onClose, onSuccess }: ComposeEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderEmail, setSenderEmail] = useState("wali.devlover786@gmail.com");
  const [emails, setEmails] = useState<string[]>([]);
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayBetweenSends, setDelayBetweenSends] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attachments, setAttachments] = useState<Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>>([]);
  
  const editorRef = useRef<HTMLDivElement>(null);

  const quickScheduleOptions = [
    { label: "Tomorrow", hours: 24 },
    { label: "Tomorrow, 10:00 AM", time: "10:00" },
    { label: "Tomorrow, 11:00 AM", time: "11:00" },
    { label: "Tomorrow, 3:00 PM", time: "15:00" },
  ];

  const handleQuickSchedule = (option: typeof quickScheduleOptions[0]) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (option.time) {
      const [hours, minutes] = option.time.split(":");
      tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      tomorrow.setHours(now.getHours(), now.getMinutes(), 0, 0);
    }
    
    setStartTime(tomorrow.toISOString().slice(0, 16));
    setShowDatePicker(false);
  };

  const handleManualEmailAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      const email = manualEmailInput.trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (!emails.includes(email)) {
          setEmails([...emails, email]);
        }
        setManualEmailInput("");
      } else if (email) {
        setError("Please enter a valid email address");
        setTimeout(() => setError(""), 3000);
      }
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newAttachments: typeof attachments = [];

    for (const file of fileArray) {
      // cap it at 5mb per file
      if (file.size > 5 * 1024 * 1024) {
        setError(`File ${file.name} is too large. Maximum size is 5MB.`);
        setTimeout(() => setError(""), 3000);
        continue;
      }

      // convert file to base64 for sending
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve(event.target?.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const content = base64.split(',')[1]; // get rid of the data url prefix

        newAttachments.push({
          filename: file.name,
          content,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        });
      } catch (error) {
        setError(`Failed to upload ${file.name}`);
        setTimeout(() => setError(""), 3000);
      }
    }

    // add all the new attachments
    if (newAttachments.length > 0) {
      setAttachments([...attachments, ...newAttachments]);
    }

    // clear the file input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // rich text editor commands
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleBold = () => execCommand('bold');
  const handleItalic = () => execCommand('italic');
  const handleUnderline = () => execCommand('underline');
  const handleUnorderedList = () => execCommand('insertUnorderedList');
  const handleOrderedList = () => execCommand('insertOrderedList');
  const handleAlignLeft = () => execCommand('justifyLeft');

  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleInsertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  const handleEmoji = (emoji: string) => {
    execCommand('insertText', emoji);
  };

  const handleEditorChange = () => {
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
  };

  const emojiList = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '👍', '👎', '👏', '🙌', '🎉', '🎊', '✨', '⭐', '🔥', '💯'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results: any) => {
        const parsedEmails = results.data
          .flat()
          .filter((item: string) => item && typeof item === "string")
          .map((item: string) => item.trim())
          .filter((item: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));

        if (parsedEmails.length === 0) {
          setError("No valid emails found in file. Please upload a CSV with email addresses.");
          return;
        }

        setEmails(parsedEmails);
      },
      error: () => {
        setError("Failed to parse CSV file");
      },
    });
  };

  const removeEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleSendNow = async () => {
    setError("");

    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!body.trim()) {
      setError("Body is required");
      return;
    }
    if (!senderEmail.trim()) {
      setError("Sender email is required");
      return;
    }
    if (emails.length === 0) {
      setError("Please add at least one recipient email");
      return;
    }

    setLoading(true);

    try {
      await sendEmailNow({
        subject,
        body,
        emails,
        senderEmail,
        delayBetweenSends: delayBetweenSends * 1000,
        attachments,
      });

      // Reset form
      setSubject("");
      setBody("");
      setEmails([]);
      setManualEmailInput("");
      setDelayBetweenSends(2);
      setHourlyLimit(0);
      setAttachments([]);

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send emails");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    setError("");

    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!body.trim()) {
      setError("Body is required");
      return;
    }
    if (!senderEmail.trim()) {
      setError("Sender email is required");
      return;
    }
    if (emails.length === 0) {
      setError("Please add at least one recipient email");
      return;
    }
    if (!startTime) {
      setError("Please select a schedule time using the clock icon");
      return;
    }

    // make sure they picked a time in the future
    const scheduledTime = new Date(startTime);
    if (scheduledTime <= new Date()) {
      setError("Scheduled time must be in the future");
      return;
    }

    setLoading(true);

    try {
      await scheduleEmail({
        subject,
        body,
        emails,
        senderEmail,
        startTime,
        delayBetweenSends: delayBetweenSends * 1000, // convert seconds to ms
        hourlyLimit,
        attachments,
      });

      // clear everything
      setSubject("");
      setBody("");
      setSenderEmail("wali.devlover786@gmail.com");
      setEmails([]);
      setManualEmailInput("");
      setStartTime("");
      setDelayBetweenSends(2);
      setHourlyLimit(0);
      setAttachments([]);

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule emails");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* top header with title and buttons */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Compose New Email</h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer" title="Attach files">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <input
                type="file"
                multiple
                onChange={handleAttachmentUpload}
                className="hidden"
                accept="*/*"
              />
            </label>
            <div className="relative">
              <button 
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Schedule send time"
              >
                <Clock className="w-5 h-5" />
              </button>
              {showDatePicker && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-10">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pick date & time</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 mb-2">Quick select:</p>
                    {quickScheduleOptions.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickSchedule(option)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="flex-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
            {startTime && (
              <button
                onClick={handleSchedule}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Schedule email for selected time"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    Send Later
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleSendNow}
              disabled={loading}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>

        {/* main form body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()} className="space-y-0">
            {/* sender email field */}
            <div className="flex items-center py-3 border-b border-gray-200">
              <label className="w-20 text-sm text-gray-600">From</label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="flex-1 outline-none text-gray-900"
                  placeholder="sender@example.com"
                  required
                />
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* recipient email field */}
            <div className="flex items-start py-3 border-b border-gray-200">
              <label className="w-20 text-sm text-gray-600 pt-1">To</label>
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 items-center">
                  {emails.slice(0, 3).map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(idx)}
                        className="hover:text-green-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {emails.length > 3 && (
                    <span className="inline-flex items-center px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm font-medium">
                      +{emails.length - 3}
                    </span>
                  )}
                  <input
                    type="text"
                    value={manualEmailInput}
                    onChange={(e) => setManualEmailInput(e.target.value)}
                    onKeyDown={handleManualEmailAdd}
                    className="flex-1 min-w-[200px] outline-none text-gray-900"
                    placeholder={emails.length === 0 ? "recipient@example.com" : "Add more..."}
                  />
                </div>
              </div>
              <label className="cursor-pointer">
                <span className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  Upload List
                </span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* subject line */}
            <div className="flex items-center py-3 border-b border-gray-200">
              <label className="w-20 text-sm text-gray-600">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 outline-none text-gray-900"
                placeholder="Subject"
                required
              />
            </div>

            {/* delay between sends and hourly rate limit */}
            <div className="flex items-center gap-6 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Delay between 2 emails</label>
                <input
                  type="number"
                  value={delayBetweenSends}
                  onChange={(e) => setDelayBetweenSends(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                  min="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Hourly Limit</label>
                <input
                  type="number"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                  min="0"
                />
              </div>
            </div>

            {/* rich text editor toolbar */}
            <div className="flex items-center gap-1 py-3 border-b border-gray-200">
              <button 
                type="button" 
                onClick={() => execCommand('undo')}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Undo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button 
                type="button" 
                onClick={() => execCommand('redo')}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Redo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1"></div>
              <button 
                type="button" 
                onClick={handleBold}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button 
                type="button" 
                onClick={handleItalic}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button 
                type="button" 
                onClick={handleUnderline}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Underline"
              >
                <Underline className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1"></div>
              <button 
                type="button" 
                onClick={handleAlignLeft}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button 
                type="button" 
                onClick={handleUnorderedList}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                type="button" 
                onClick={handleOrderedList}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1"></div>
              <button 
                type="button" 
                onClick={handleLink}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Insert Link"
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button 
                type="button" 
                onClick={handleInsertImage}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Insert Image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <div className="relative group">
                <button 
                  type="button"
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                  title="Insert Emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 hidden group-hover:block z-10 w-64">
                  <div className="grid grid-cols-8 gap-1">
                    {emojiList.map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleEmoji(emoji)}
                        className="text-xl hover:bg-gray-100 rounded p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* show attached files if any */}
            {attachments.length > 0 && (
              <div className="py-3 border-b border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-gray-700">{attachment.filename}</span>
                      <span className="text-gray-500">({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="ml-1 text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* main email body editor */}
            <div className="pt-4">
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorChange}
                className="w-full outline-none text-gray-900 min-h-[300px] prose prose-sm max-w-none focus:ring-0"
                style={{ 
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}
                suppressContentEditableWarning
                data-placeholder="Type Your Reply..."
              />
              <style jsx>{`
                [contenteditable]:empty:before {
                  content: attr(data-placeholder);
                  color: #9CA3AF;
                }
              `}</style>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
