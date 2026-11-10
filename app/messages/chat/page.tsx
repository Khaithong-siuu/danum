"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ChatIdContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  // If you need to validate the UUID format on the client:
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!id || !UUID_REGEX.test(id)) {
    return <div className="p-10 text-center">Invalid chat ID.</div>;
  }

  // Render your chat client logic here using `id`
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Chat Room: {id}</h1>
      {/* Insert your ChatRoom component here */}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading chat...</div>}>
      <ChatIdContent />
    </Suspense>
  );
}