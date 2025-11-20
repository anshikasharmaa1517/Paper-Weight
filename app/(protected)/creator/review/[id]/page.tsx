"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { AppBar } from "@/components/ui/AppBar";

interface Message {
  id: string;
  sender_id: string;
  message: string;
  message_type: string;
  created_at: string;
}

interface Conversation {
  id: string;
  resume_id: string;
  user_id: string;
  reviewer_id: string;
  created_at: string;
  updated_at: string;
}

interface ReviewData {
  id: string;
  file_url: string;
  status: string;
  review_status: string | null;
  score: number | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  user: {
    email: string;
    full_name?: string;
    avatar_url?: string;
  } | null;
}

export default function ReviewPage() {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Conversation states
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Interactive rating and status states
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const params = useParams();
  const resumeId = params.id as string;

  useEffect(() => {
    async function loadReviewData() {
      console.log("Review page loading with resumeId:", resumeId);
      try {
        const supabase = getBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        console.log("User in review page:", user?.id);

        if (!user) {
          console.log("No user, redirecting to login");
          router.push("/login");
          return;
        }

        // Get resume data
        console.log("Fetching resume data from API...");
        const response = await fetch(`/api/creator/resumes/${resumeId}`);
        console.log("API response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error:", errorText);
          setError("Resume not found");
          return;
        }

        const { resume } = await response.json();
        console.log("Received resume data:", resume);
        setReviewData(resume);

        // Initialize interactive states
        setSelectedRating(resume.score || null);
        setSelectedStatus(resume.review_status || null);

        // Set current user ID
        setCurrentUserId(user.id);

        // Load conversation
        await loadConversation();
      } catch (error) {
        console.error("Error loading review data:", error);
        setError("Failed to load resume");
      } finally {
        setLoading(false);
      }
    }

    async function loadConversation() {
      try {
        const response = await fetch(
          `/api/conversations?resume_id=${resumeId}`
        );
        if (response.ok) {
          const { conversation, messages } = await response.json();
          setConversation(conversation);
          setMessages(messages || []);
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
      }
    }

    if (resumeId) {
      loadReviewData();
    }
  }, [resumeId, router]);

  const sendMessage = async (message: string) => {
    if (!message.trim() || !conversation || sendingMessage) return;

    setSendingMessage(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversation.id,
          message: message.trim(),
          message_type: "text",
        }),
      });

      if (response.ok) {
        const { message: newMessage } = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setNewMessage("");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  const sendQuickReply = async (message: string) => {
    await sendMessage(message);
  };

  const saveRatingAndStatus = async () => {
    if (!selectedRating || !selectedStatus || saving) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/creator/reviews/${resumeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: selectedRating,
          review_status: selectedStatus,
          status: "Completed",
          feedback: `Rated ${selectedRating}/10 - ${selectedStatus}`,
        }),
      });

      if (response.ok) {
        // Update local state
        setReviewData((prev) =>
          prev
            ? {
                ...prev,
                score: selectedRating,
                review_status: selectedStatus,
              }
            : null
        );

        // Send a message about the review
        await sendMessage(
          `I've rated this resume ${selectedRating}/10 and marked it as "${selectedStatus}".`
        );
      } else {
        const errorData = await response.json();
        console.error("Failed to save rating and status:", errorData);
        alert(`Failed to save review: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error saving rating and status:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AppBar />
        <main className="mx-auto max-w-7xl px-6 py-8 w-3/4">
          <div className="animate-pulse">
            <div className="h-8 bg-zinc-200 rounded w-1/4 mb-4"></div>
            <div className="bg-white rounded-2xl p-6">
              <div className="h-4 bg-zinc-200 rounded w-1/2 mb-4"></div>
              <div className="h-64 bg-zinc-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AppBar />
        <main className="mx-auto max-w-7xl px-6 py-8 w-3/4">
          <div className="bg-white rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-semibold text-zinc-900 mb-2">
              Resume Not Found
            </h1>
            <p className="text-zinc-600 mb-6">{error}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppBar />
      <main className="mx-auto max-w-7xl px-8 py-12 w-3/4">
        {/* Header */}
        <div className="flex items-center gap-6 mb-12">
          <button
            onClick={() => router.back()}
            className="p-3 hover:bg-white/60 rounded-2xl transition-all duration-200 hover:shadow-sm group"
          >
            <svg
              className="w-6 h-6 text-slate-600 group-hover:text-slate-900 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">
              Review Resume
            </h1>
            <p className="text-xl text-slate-600 font-medium">
              From {reviewData.user?.full_name || "User"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Resume Preview - Moved to Left */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 lg:col-span-1">
            {/* Resume Rating and Status */}
            <div className="mb-6 space-y-4">
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Rating
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSelectedRating(num)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-110 ${
                        selectedRating && num <= selectedRating
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                {selectedRating && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedRating}/10
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Status
                </label>
                <div className="flex items-center gap-2">
                  {["Approved", "Needs Revision"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
                        selectedStatus === status
                          ? status === "Approved"
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-amber-500 text-white shadow-sm"
                          : status === "Approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
                          : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              {selectedStatus && (
                <div className="pt-4">
                  <button
                    onClick={saveRatingAndStatus}
                    disabled={saving || !selectedRating}
                    className="w-full px-3 py-2 bg-transparent border-2 border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium disabled:border-gray-300 disabled:text-gray-400"
                  >
                    {saving
                      ? "Saving..."
                      : selectedRating
                      ? "Save Review"
                      : "Select Rating to Save"}
                  </button>
                </div>
              )}
            </div>

            <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center">
              <svg
                className="w-12 h-12 text-zinc-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-zinc-600 mb-4">Resume PDF</p>
              <a
                href={reviewData.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Open Resume
              </a>
            </div>
          </div>

          {/* Chatbox - Right Side */}
          <div className="bg-white rounded-2xl p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <h2 className="text-lg font-semibold text-zinc-900">Messages</h2>
            </div>

            {/* Messages Area */}
            <div className="h-96 overflow-y-auto border border-zinc-200 rounded-lg p-4 mb-4 bg-zinc-50">
              {messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_id === currentUserId
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs px-4 py-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                          message.sender_id === currentUserId
                            ? "bg-blue-500 text-white"
                            : "bg-white border border-zinc-200 text-zinc-800"
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.sender_id === currentUserId
                              ? "text-blue-100"
                              : "text-zinc-500"
                          }`}
                        >
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-zinc-500 italic">
                  No messages yet. Send a message to get started!
                </div>
              )}
            </div>

            {/* Quick Reply Options */}
            <div className="mb-4">
              <p className="text-sm text-zinc-600 mb-2">Quick replies:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Thanks for sharing your resume!",
                  "I'll review this and get back to you.",
                  "Could you provide more details about...",
                  "Great work! Here's my feedback:",
                ].map((reply) => (
                  <button
                    key={reply}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      sendQuickReply(reply);
                    }}
                    disabled={sendingMessage}
                    type="button"
                    className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(newMessage);
                  }
                }}
              />
              <button
                onClick={() => sendMessage(newMessage)}
                disabled={!newMessage.trim() || sendingMessage}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingMessage ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
