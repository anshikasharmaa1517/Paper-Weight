"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { AppBar } from "@/components/ui/AppBar";

interface ReceivedResume {
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

export default function CreatorDashboard() {
  const [receivedResumes, setReceivedResumes] = useState<ReceivedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewerSlug, setReviewerSlug] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [conversations, setConversations] = useState<
    Record<string, { conversation: Conversation; messages: Message[] }>
  >({});
  const [newMessages, setNewMessages] = useState<Record<string, string>>({});
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);
  const [showConversationModal, setShowConversationModal] = useState<
    string | null
  >(null);
  const [currentReviewerId, setCurrentReviewerId] = useState<string | null>(
    null
  );
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadReceivedResumes() {
      try {
        const supabase = getBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        console.log("Current user ID:", user.id);
        setCurrentReviewerId(user.id);

        // Check if this is a redirect from reviewer setup
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("reviewer_setup") === "success") {
          console.log("Redirected from reviewer setup - verifying role...");
          setShowSuccessMessage(true);

          // Verify the user has reviewer role (check reviewers table since profiles.role may not exist)
          const { data: reviewerProfile } = await supabase
            .from("reviewers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          console.log("Reviewer profile verification:", reviewerProfile);

          if (!reviewerProfile) {
            console.log("Reviewer profile not found, refreshing session...");
            await supabase.auth.refreshSession();

            // Wait a bit and try again
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const { data: retryReviewerProfile } = await supabase
              .from("reviewers")
              .select("id")
              .eq("user_id", user.id)
              .maybeSingle();

            console.log(
              "Retry reviewer profile verification:",
              retryReviewerProfile
            );
          }

          // Clean up the URL parameter
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }

        // Use API route to get resumes with user details
        const response = await fetch("/api/creator/resumes");
        if (!response.ok) {
          console.error("Error fetching resumes:", response.statusText);
          return;
        }

        const { resumes } = await response.json();
        console.log("Found received resumes:", resumes);
        console.log("Number of resumes found:", resumes?.length || 0);

        // Debug each resume's user data
        resumes?.forEach((resume: any, index: number) => {
          console.log(`Resume ${index + 1} user data:`, resume.user);
        });

        setReceivedResumes(resumes || []);
      } catch (error) {
        console.error("Error loading received resumes:", error);
      } finally {
        setLoading(false);
      }
    }

    loadReceivedResumes();
  }, [router]);

  const toggleCardExpansion = (cardId: string) => {
    const newExpanded = expandedCard === cardId ? null : cardId;
    setExpandedCard(newExpanded);

    // Load conversation when expanding
    if (newExpanded && !conversations[cardId]) {
      loadConversation(cardId);
    }
  };

  const isCardExpanded = (cardId: string) => expandedCard === cardId;

  const openConversationModal = (resumeId: string) => {
    setShowConversationModal(resumeId);
    // Load conversation when opening modal
    if (!conversations[resumeId]) {
      loadConversation(resumeId);
    }
  };

  const closeConversationModal = () => {
    setShowConversationModal(null);
  };

  const loadConversation = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/conversations?resume_id=${resumeId}`);
      if (response.ok) {
        const data = await response.json();
        setConversations((prev) => ({
          ...prev,
          [resumeId]: data,
        }));
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const sendMessage = async (resumeId: string, message: string) => {
    if (!message.trim()) return;

    setSendingMessage(resumeId);
    try {
      const conversation = conversations[resumeId];
      if (!conversation) return;

      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversation.conversation.id,
          message: message.trim(),
          message_type: "text",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConversations((prev) => ({
          ...prev,
          [resumeId]: {
            ...prev[resumeId],
            messages: [...prev[resumeId].messages, data.message],
          },
        }));
        setNewMessages((prev) => ({
          ...prev,
          [resumeId]: "",
        }));
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(null);
    }
  };

  const sendQuickReply = async (resumeId: string, message: string) => {
    await sendMessage(resumeId, message);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AppBar />
        <div className="mx-auto max-w-6xl grid grid-cols-12 gap-6 px-4 py-6">
          <aside className="col-span-12 md:col-span-3">
            <nav className="rounded-2xl bg-white ring-1 ring-zinc-100 shadow-[0_1px_0_rgba(0,0,0,0.06)] p-2">
              <a
                className="block px-3 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-50"
                href="/creator/profile"
              >
                Edit Profile
              </a>
              <a
                className="block px-3 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white"
                href="#"
              >
                Resume Received
              </a>
              <a
                className="block px-3 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-50"
                href="/creator/reviews"
              >
                My Reviews
              </a>
            </nav>
          </aside>
          <main className="col-span-12 md:col-span-9">
            <div className="animate-pulse">
              <div className="h-8 bg-zinc-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-zinc-200 rounded-xl"></div>
                      <div className="flex-1">
                        <div className="h-5 bg-zinc-200 rounded w-1/3 mb-2"></div>
                        <div className="h-4 bg-zinc-200 rounded w-1/4"></div>
                      </div>
                      <div className="h-8 bg-zinc-200 rounded w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <AppBar />
      <div className="mx-auto max-w-6xl grid grid-cols-12 gap-6 px-4 py-6">
        <aside className="col-span-12 md:col-span-3">
          <nav className="rounded-2xl bg-white ring-1 ring-zinc-100 shadow-[0_1px_0_rgba(0,0,0,0.06)] p-2">
            <a
              className="block px-3 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-50"
              href="/creator/profile"
            >
              Edit Profile
            </a>
            <a
              className="block px-3 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white"
              href="#"
            >
              Resume Received
            </a>
            <a
              className="block px-3 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-50"
              href="/creator/reviews"
            >
              My Reviews
            </a>
          </nav>
        </aside>

        <main className="col-span-12 md:col-span-9">
          {showSuccessMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-green-800">
                    Reviewer Profile Created Successfully!
                  </h3>
                  <p className="text-sm text-green-700">
                    You can now receive and review resumes from users.
                  </p>
                </div>
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="ml-auto p-1 hover:bg-green-100 rounded-full"
                >
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
              Resume Received
            </h1>
            <p className="text-sm text-zinc-600">
              Resumes shared with you by users
            </p>
          </div>

          {receivedResumes.length > 0 ? (
            <div className="space-y-3">
              {receivedResumes.map((resume) => {
                const isViewed = resume.status !== "Pending";
                const isCompleted = resume.status === "Completed";

                return (
                  <div
                    key={resume.id}
                    className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer hover:shadow-md select-none ${
                      isViewed
                        ? "bg-zinc-50 border border-zinc-200"
                        : "bg-blue-50 border border-blue-200 shadow-sm"
                    }`}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/creator/review/${resume.id}`;
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* User Avatar */}
                      <div className="h-10 w-10 rounded-full border-2 border-white flex items-center justify-center overflow-hidden shadow-sm">
                        {resume.user?.avatar_url ? (
                          <img
                            src={resume.user.avatar_url}
                            alt={resume.user.full_name || "User"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-200 flex items-center justify-center">
                            <svg
                              className="h-5 w-5 text-zinc-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-zinc-900 truncate">
                            {resume.user?.full_name ||
                              resume.user?.email?.split("@")[0] ||
                              "Anonymous User"}
                          </h3>
                          {!isViewed && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          {isCompleted && (
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-sm text-zinc-600">
                          {isViewed
                            ? isCompleted
                              ? resume.review_status
                                ? `${resume.review_status} • Score: ${
                                    resume.score || "N/A"
                                  }/10`
                                : `Reviewed • Score: ${
                                    resume.score || "N/A"
                                  }/10`
                              : "Resume viewed"
                            : "New resume shared"}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="text-xs text-zinc-500">
                        {new Date(resume.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-3xl bg-white ring-1 ring-zinc-100 shadow-[0_1px_0_rgba(0,0,0,0.06)] p-10 flex flex-col items-center text-center">
              <div className="h-28 w-28 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6">
                <svg
                  className="h-10 w-10 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                No resumes received yet
              </h2>
              <p className="text-sm text-zinc-600 mt-2 max-w-md">
                Users will be able to share their resumes with you once they
                follow your profile. Make sure your profile is complete and
                visible to users.
              </p>
              <a
                href="/creator/profile"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-900 text-white px-5 py-2 text-sm font-semibold shadow-sm hover:bg-zinc-800 transition-colors duration-200"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Complete Profile
              </a>
            </div>
          )}
        </main>
      </div>

      {/* Conversation Modal */}
      {showConversationModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={closeConversationModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <h3 className="text-lg font-semibold text-zinc-800">
                  Messages
                </h3>
                {conversations[showConversationModal]?.messages?.length > 0 && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {conversations[showConversationModal].messages.length}{" "}
                    messages
                  </span>
                )}
              </div>
              <button
                onClick={closeConversationModal}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors group"
              >
                <svg
                  className="w-5 h-5 text-zinc-500 group-hover:text-zinc-700 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversations[showConversationModal]?.messages?.map(
                (message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender_id === currentReviewerId
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                        message.sender_id === currentReviewerId
                          ? "bg-blue-500 text-white"
                          : "bg-zinc-100 text-zinc-800"
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.sender_id === currentReviewerId
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
                )
              )}
              {(!conversations[showConversationModal]?.messages ||
                conversations[showConversationModal].messages.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-zinc-500 italic">
                    No messages yet. Send a message to get started!
                  </p>
                </div>
              )}
            </div>

            {/* Quick Reply Options */}
            <div className="p-6 border-t border-zinc-200">
              <p className="text-sm text-zinc-600 mb-3">Quick replies:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  "Thanks for sharing your resume!",
                  "I'll review this and get back to you.",
                  "Could you provide more details about...",
                  "Great work! Here's my feedback:",
                ].map((reply) => (
                  <button
                    key={reply}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await sendQuickReply(showConversationModal, reply);
                    }}
                    disabled={sendingMessage === showConversationModal}
                    type="button"
                    className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-full hover:bg-zinc-50 active:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Message Input */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessages[showConversationModal] || ""}
                  onChange={(e) =>
                    setNewMessages((prev) => ({
                      ...prev,
                      [showConversationModal]: e.target.value,
                    }))
                  }
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(
                        showConversationModal,
                        newMessages[showConversationModal] || ""
                      );
                    }
                  }}
                />
                <button
                  onClick={() =>
                    sendMessage(
                      showConversationModal,
                      newMessages[showConversationModal] || ""
                    )
                  }
                  disabled={
                    !(newMessages[showConversationModal] || "").trim() ||
                    sendingMessage === showConversationModal
                  }
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingMessage === showConversationModal ? "..." : "Send"}
                </button>
              </div>

              {/* Review Resume Button */}
              <div className="mt-4 pt-4 border-t border-zinc-200">
                <button
                  onClick={() => {
                    window.location.href = `/creator/review/${showConversationModal}`;
                  }}
                  className="w-full px-4 py-3 bg-white border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-2"
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="font-medium">Review Resume</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
