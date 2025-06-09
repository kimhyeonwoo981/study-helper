'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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

export default function ChatPage() {
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || 'no-date';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 페이지 로드 시 localStorage에서 대화 기록 불러오기
  useEffect(() => {
    const key = `chat_${date}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed: Message[] = JSON.parse(saved);
        setMessages(parsed);
      } catch (e) {
        console.error('대화 기록 불러오기 실패:', e);
      }
    }
  }, [date]);

  // 새 메시지가 추가될 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 상태를 업데이트하고 localStorage에 저장하는 함수
  const saveMessages = (updated: Message[]) => {
    setMessages(updated);
    localStorage.setItem(`chat_${date}`, JSON.stringify(updated));
  };

  const handleDelete = (index: number) => {
    const next = [...messages];
    const removed = next[index];
    next.splice(index, 1);
    // 사용자 메시지와 짝이 되는 GPT 메시지도 함께 삭제
    if (next[index]?.sender === 'gpt') next.splice(index, 1);
    saveMessages(next);

    // 연결된 질문 리스트에서도 해당 내용 삭제
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

  // GPT 답변 접기/펴기
  const toggleCollapse = (index: number) => {
    const next = [...messages];
    if (next[index]?.sender === 'gpt') {
      next[index].collapsed = !next[index].collapsed;
      saveMessages(next);
    }
  };

  // 이미지 파일 변경 처리
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // 미분류 키로 질문/답변 저장
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

  // 메시지 전송 처리
  const handleSend = async () => {
    if (!input.trim() && !imagePreview) return;

    const questionText = input.trim();
    const userMessage: Message = {
      sender: 'user',
      text: (image ? `[이미지 첨부됨]\n` : '') + questionText,
      date,
    };
    
    // 사용자 메시지를 먼저 화면에 표시
    const updatedMessages = [...messages, userMessage];
    saveMessages(updatedMessages);
    setInput(''); // 입력창 비우기

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
      // 실패 시 사용자 메시지 제거
      saveMessages(messages);
      return;
    }

    // 이미지 질문 처리
    if (imagePreview) {
      const data = await res.json();
      const answer = data.reply || '응답 없음';
      saveToUnitKey(userMessage, answer);
      saveMessages([...updatedMessages, makeGptMessage(answer)]);
      setImage(null);
      setImagePreview('');
      return;
    }

    // 스트리밍 텍스트 답변 처리
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let answer = '';
    
    // GPT 답변을 받을 초기 메시지를 먼저 추가
    setMessages((prev) => [...prev, makeGptMessage('')]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // 스트리밍이 끝나면 최종본을 localStorage에 저장
        saveToUnitKey(userMessage, answer);
        break;
      }
      answer += decoder.decode(value);
      
      // ❗ [최종 수정된 부분] 타입 에러 해결을 위한 명확한 상태 업데이트
      setMessages((prevMessages) => {
        // 1. 마지막 메시지가 GPT 메시지인지 확인
        if (prevMessages.length > 0 && prevMessages[prevMessages.length - 1].sender === 'gpt') {
            // 2. 새로운 메시지 객체를 명시적으로 생성 (불변성 유지)
            const updatedLastMessage: Message = {
                ...prevMessages[prevMessages.length - 1],
                text: answer,
            };
            // 3. 배열의 마지막 요소를 새로운 객체로 교체한 새 배열을 반환
            return [...prevMessages.slice(0, -1), updatedLastMessage];
        }
        return prevMessages;
      });
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
              {msg.text || "..."}
              
              {msg.sender === 'user' && (
                <button
                  onClick={() => handleDelete(i)}
                  className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-50 hover:opacity-100"
                  title="삭제"
                >
                  &times;
                </button>
              )}
              {msg.sender === 'gpt' && (
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
          <button onClick={() => { setImage(null); setImagePreview(''); }} className="text-red-500 ml-2">취소</button>
        </div>
      )}

      <div className="p-2 flex gap-2 border-t bg-gray-50">
        <label className="cursor-pointer flex items-center justify-center px-3 bg-gray-200 rounded-md hover:bg-gray-300">
          📷
          <input type="file" accept="image/*" onChange={handleImageChange} hidden />
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 border p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
          disabled={(!input.trim() && !imagePreview) || messages[messages.length-1]?.text === ''}
        >
          전송
        </button>
      </div>
    </div>
  );
}