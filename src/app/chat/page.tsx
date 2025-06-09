// src/app/chat/page.tsx 왜안대...

import { Suspense } from 'react';
import ChatClient from './ChatClient';

export default function ChatPage() {
  return (
    // Suspense로 감싸고, 로딩 중에 보여줄 fallback UI를 설정합니다.
    <Suspense fallback={<div className="flex h-screen items-center justify-center">로딩 중...</div>}>
      <ChatClient />
    </Suspense>
  );
}
///ㄴㅁㅇㅇㄻㄴㄴㅇㅁㄹ