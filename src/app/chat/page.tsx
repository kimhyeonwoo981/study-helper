'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
  collapsed?: boolean;
}

// ✅ 여기에 타입 명시 확실하게 추가!
const makeGptMessage = (text: string): Message => ({
  sender: 'gpt',
  text,
});

export default function ChatPage() {
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || 'no-date';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = `chat_${date}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed: Message[] = JSON.parse(saved);
        setMessages(parsed);
      } catch (e) {
        console.error('불러오기 실패:', e);
      }
    }
  }, [date]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    const gptMessage = makeGptMessage(answer.trim());
    localStorage.setItem(key, JSON.stringify([...existing, userMessage, gptMessage]));
  };

  const handleSend = async () => {
    if (!input.trim() && !imagePreview) return;

    const questionText = input.trim();
    const userMessage: Message = {
      sender: 'user',
      text: (image ? '[이미지 첨부됨]\n' : '') + questionText,
      date,
    };
    const updatedMessages = [...messages, userMessage];
    saveMessages(updatedMessages);

    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    const prompt = imagePreview
      ? [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imagePreview } },
              { type: 'text', text: questionText },
            ],
          },
        ]
      : [
          {
            role: 'user',
            content: `아래는 사용자의 질문입니다. 이 질문은 다음 과목의 한 단원에만 해당합니다.\n후보: ${Object.entries(map)
              .map(([subject, units]) => (units as string[]).map((u) => `${subject} > ${u}`).join(', '))
              .join(', ')}\n\n질문과 가장 관련이 있다고 판단되는 과목의 단원 하나만 아래 형식으로 먼저 알려주세요.\n예시: 과목명,단원명\n\n그 다음 줄부터는 해당 단원의 관점에서 질문에 대한 답을 해주세요.\n\n질문: ${questionText}`.trim(),
          },
        ];

    const res = await fetch(imagePreview ? '/api/chat-vision' : '/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: prompt, model: 'gpt-4o' }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ GPT 응답 실패:', errorText);
      alert('GPT 응답 실패:\n' + errorText);
      return;
    }

    if (imagePreview) {
      const data = await res.json();
      const answer = data.reply || '응답 없음';
      saveToUnitKey(userMessage, answer);
      saveMessages([...updatedMessages, makeGptMessage(answer)]);
      setImage(null);
      setImagePreview('');
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let answer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      answer += decoder.decode(value);

      setMessages((prev): Message[] => {
        const last = prev[prev.length - 1];
        const updated: Message[] =
          last?.sender === 'gpt'
            ? [...prev.slice(0, -1), { ...last, text: answer }]
            : [...prev, makeGptMessage(answer)];
        localStorage.setItem(`chat_${date}`, JSON.stringify(updated));
        return updated;
      });
    }

    saveToUnitKey(userMessage, answer);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-2 border-b text-sm">📅 {date}</div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-2 relative ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}
          >
            {msg.sender === 'user' && (
              <button
                onClick={() => handleDelete(i)}
                className="absolute top-1 right-2 text-xs text-gray-500 hover:text-red-500"
              >
                ❌
              </button>
            )}

            {msg.sender === 'gpt' && (
              <button
                onClick={() => toggleCollapse(i)}
                className="absolute top-1 right-2 text-xs text-gray-500 hover:text-blue-500"
              >
                {msg.collapsed ? '[+]' : '[-]'}
              </button>
            )}

            <span
              className={`inline-block px-2 py-1 rounded whitespace-pre-wrap break-words ${msg.sender === 'user' ? 'bg-blue-100' : 'bg-gray-100'}`}
            >
              {msg.sender === 'gpt' && msg.collapsed ? '[+]' : msg.text}
            </span>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 flex gap-2 border-t">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요"
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 border p-2 rounded"
        />

        <label className="cursor-pointer px-2 py-1 bg-gray-200 rounded">
          +
          <input type="file" accept="image/*" onChange={handleImageChange} hidden />
        </label>

        <button
          onClick={handleSend}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          전송
        </button>
      </div>
    </div>
  );
}
