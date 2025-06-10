// src/app/chat/page.tsx

import { Suspense } from 'react';
import ChatClient from './ChatClient';

export default function ChatPage() {
  return (
    // Suspense는 배포를 위해 필수입니다.
    <Suspense fallback={<div className="flex h-screen items-center justify-center">페이지 로딩 중...</div>}>
      <ChatClient />
    </Suspense>
  );
}