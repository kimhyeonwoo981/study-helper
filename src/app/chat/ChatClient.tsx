// src/app/chat/ChatClient.tsx

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';

// 메시지 타입을 정의합니다. sender는 'user' 또는 'gpt'만 가능합니다.
interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
  collapsed?: boolean;
}

// GPT 메시지를 생성하는 헬퍼 함수입니다.
const makeGptMessage = (text: string): Message => ({
  sender: 'gpt',
  text,
});

// 컴포넌트 이름을 ChatClient로 변경합니다.
export default function ChatClient() {
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || 'no-date';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 로컬 스토리지에서 기록 불러오기
  useEffect(() => {
    const key = `chat_${date}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('대화 기록 불러오기 실패:', e);
      }
    }
  }, [date]);

  // 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 저장 함수
  const saveMessages = (updated: Message[]) => {
    setMessages(updated);
    localStorage.setItem(`chat_${date}`, JSON.stringify(updated));
  };

  const handleDelete = (index: number) => {
    const next = [...messages];
    const removed = next[index];
    next.splice(index, 1);
    if (next[index]?.sender === 'gpt') next.splice(index, 1);
    saveMessages(next);

    if (removed?.sender === 'user') {
      const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
      for (const [subject, unitsRaw] of Object.entries(map)) {
        const units = unitsRaw as string[];
        for (const unit of units) {
          const key = `question_by_unit_${subject}_${unit}`;
          const existing: Message[] = JSON.parse(localStorage.getItem(key) || '[]');
          const idx = existing.findIndex(
            (m) => m.sender === 'user' && m.text === removed.text
          );
          if (idx !== -1 && existing[idx + 1]?.sender === 'gpt') {
            existing.splice(idx, 2);
            localStorage.setItem(key, JSON.stringify(existing));
            break;
          }
        }
      }
    }
  };

  const toggleCollapse = (index: number) => {
    const next = [...messages];
    if (next[index]?.sender === 'gpt') {
      next[index].collapsed = !next[index].collapsed;
      saveMessages(next);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveToUnitKey = (userMessage: Message, answer: string) => {
    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    if (!map.Unsorted || !map.Unsorted.includes('미분류')) {
      map.Unsorted = ['미분류'];
      localStorage.setItem('question_unit_map', JSON.stringify(map));
    }
    const key = `question_by_unit_Unsorted_미분류`;
    const existing: Message[] = JSON.parse(localStorage.getItem(key) || '[]');
    const gptMessage: Message = { sender: 'gpt', text: answer.trim() };
    localStorage.setItem(key, JSON.stringify([...existing, userMessage, gptMessage]));
  };

  const handleSend = async () => {
    if ((!input.trim() && !imagePreview) || isSending) return;

    setIsSending(true);
    const questionText = input.trim();
    const userMessage: Message = {
      sender: 'user',
      text: (image ? `[이미지 첨부됨]\n` : '') + questionText,
      date,
    };
    
    const initialMessages = [...messages]; 

    setMessages(prev => [...prev, userMessage, makeGptMessage('')]);
    
    setInput('');
    setImage(null);
    setImagePreview('');
    
    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    const prompt = imagePreview
      ? [ { role: 'user', content: [ { type: 'image_url', image_url: { url: imagePreview } }, { type: 'text', text: questionText }, ], }, ]
      : [ { role: 'user', content: `아래는 사용자의 질문입니다. 이 질문은 다음 과목의 한 단원에만 해당합니다.\n후보: ${Object.entries(map).map(([subject, units]) => (units as string[]).map((u) => `${subject} > ${u}`).join(', ')).join(', ')}\n\n질문과 가장 관련이 있다고 판단되는 과목의 단원 하나만 아래 형식으로 먼저 알려주세요.\n예시: 과목명,단원명\n\n그 다음 줄부터는 해당 단원의 관점에서 질문에 대한 답을 해주세요.\n\n질문: ${questionText}`.trim(), }, ];
    
    try {
      const res = await fetch(imagePreview ? '/api/chat-vision' : '/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: prompt, model: 'gpt-4o' }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      if (imagePreview) {
        const data = await res.json();
        const answer = data.reply || '응답 없음';
        const gptMessage = makeGptMessage(answer);
        saveToUnitKey(userMessage, answer);
        saveMessages([...initialMessages, userMessage, gptMessage]);
        return;
      }
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error('ReadableStream not available');
      const decoder = new TextDecoder();
      let streamedAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamedAnswer += decoder.decode(value);

        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];

          if (lastMessage && lastMessage.sender === 'gpt') {
            lastMessage.text = streamedAnswer;
          }
          return newMessages;
        });
      }
      
      saveToUnitKey(userMessage, streamedAnswer);
      const finalMessages = [...initialMessages, userMessage, makeGptMessage(streamedAnswer)];
      localStorage.setItem(`chat_${date}`, JSON.stringify(finalMessages));

    } catch (error) {
      console.error('❌ GPT 응답 실패:', error);
      alert('GPT 응답에 실패했습니다.');
      saveMessages(initialMessages);
    } finally {
      setIsSending(false);
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="p-2 border-b text-sm text-center font-semibold">📅 {date}</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`relative max-w-lg px-3 py-2 rounded-lg whitespace-pre-wrap break-words ${
                msg.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {msg.text === '' && msg.sender === 'gpt' ? "답변 생성 중..." : (msg.collapsed ? '[답변 내용 숨김]' : msg.text)}
              
              {msg.sender === 'user' && !isSending && (
                <button
                  onClick={() => handleDelete(i)}
                  className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-50 hover:opacity-100"
                  title="삭제"
                >
                  &times;
                </button>
              )}
              {msg.sender === 'gpt' && !isSending && (
                <button
                  onClick={() => toggleCollapse(i)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-blue-400 text-white rounded-full text-xs flex items-center justify-center opacity-50 hover:opacity-100"
                  title={msg.collapsed ? '펴기' : '접기'}
                >
                  {msg.collapsed ? '+' : '-'}
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {imagePreview && (
        <div className="p-2 border-t text-center">
          <img src={imagePreview} alt="Preview" className="max-h-32 inline-block" />
          <button onClick={() => { setImage(null); setImagePreview(''); }} className="text-red-500 ml-2" disabled={isSending}>취소</button>
        </div>
      )}

      <div className="p-2 flex gap-2 border-t bg-gray-50">
        <label className={`cursor-pointer flex items-center justify-center px-3 bg-gray-200 rounded-md ${isSending ? 'cursor-not-allowed bg-gray-100' : 'hover:bg-gray-300'}`}>
          📷
          <input type="file" accept="image/*" onChange={handleImageChange} hidden disabled={isSending} />
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isSending ? "응답을 기다리는 중..." : "질문을 입력하세요"}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 border p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
          disabled={(!input.trim() && !imagePreview) || isSending}
        >
          {isSending ? "전송 중..." : "전송"}
        </button>
      </div>
    </div>
  );
}