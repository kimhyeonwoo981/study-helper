// 📄 src/app/components/ChatBox.tsx
'use client';

import React from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';

interface Props {
  sender: 'user' | 'gpt';
  text: string;
}

export default function ChatBox({ sender, text }: Props) {
  const isUser = sender === 'user';

  return (
    <div className={`mb-2 p-2 rounded whitespace-pre-wrap ${isUser ? 'bg-blue-100 text-right' : 'bg-gray-100 text-left'}`}>
      <MathJaxContext version={3}>
        <MathJax>{text}</MathJax>
      </MathJaxContext>
    </div>
  );
}
