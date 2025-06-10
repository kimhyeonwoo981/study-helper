// src/app/chat/ChatClient.tsx

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
  collapsed?: boolean;
  image?: string; 
}

const makeGptMessage = (text: string): Message => ({ sender: 'gpt', text });

export default function ChatClient() {
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = `chat_${date}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      } catch (e) {
        console.error('불러오기 실패:', e);
      }
    }
  }, [date]);

  // 자동 스크롤 기능 제거
  // useEffect(() => {
  //   scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  // }, [messages]);

  const saveMessages = (updated: Message[]) => {
    setMessages(updated);
    localStorage.setItem(`chat_${date}`, JSON.stringify(updated));
  };

  const handleDelete = (index: number) => {
    const currentMessages = [...messages];
    const userMessageToDelete = currentMessages[index];

    if (userMessageToDelete?.sender !== 'user') return;

    // 1. 현재 채팅창에서 메시지 삭제
    currentMessages.splice(index, 2);
    saveMessages(currentMessages);

    // 2. 'question_by_unit' 데이터에서도 해당 메시지 찾아 삭제
    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    
    // [수정됨] 검색 대상 map에 'Unsorted' 과목이 항상 포함되도록 보장
    if (!map.Unsorted) {
      map.Unsorted = ['미분류'];
    }

    // 수정된 map을 기준으로 순회
    for (const subject in map) {
      const units = map[subject] as string[];
      for (const unit of units) {
        const key = `question_by_unit_${subject}_${unit}`;
        const rawData = localStorage.getItem(key);
        if (!rawData) continue;

        let unitMessages: Message[] = JSON.parse(rawData);
        const messageIndex = unitMessages.findIndex(
          (msg) => msg.sender === 'user' && msg.text === userMessageToDelete.text && msg.date === userMessageToDelete.date
        );

        if (messageIndex !== -1) {
          unitMessages.splice(messageIndex, 2);
          localStorage.setItem(key, JSON.stringify(unitMessages));
          return; 
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

  const saveToUnitKey = (userMessage: Message, answer: string, classification: string) => {
    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    const [subject, unit] = classification.split(',').map(s => s.trim());

    if (subject && unit && map[subject]?.includes(unit)) {
      const key = `question_by_unit_${subject}_${unit}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...existing, userMessage, makeGptMessage(answer)]));
    } else {
      if (!map.Unsorted) {
          map.Unsorted = [];
      }
      if (!map.Unsorted.includes('미분류')) {
        map.Unsorted.push('미분류');
      }
      localStorage.setItem('question_unit_map', JSON.stringify(map));
      const key = `question_by_unit_Unsorted_미분류`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...existing, userMessage, makeGptMessage(answer)]));
    }
  };
  
  const handleSend = async () => {
    if ((!input.trim() && !imagePreview) || isSending) return;
  
    setIsSending(true);
    const questionText = input.trim();
    const userMessage: Message = { 
      sender: 'user', 
      text: questionText,
      date: new Date().toISOString(),
      image: imagePreview || undefined,
    };
    
    const initialMessages = [...messages];
    setMessages(prev => [...prev, userMessage, makeGptMessage('')]);
    
    setInput('');
    setImage(null);
    setImagePreview('');
    
    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    const prompt = imagePreview
      ? [ { role: 'user' as const, content: [ { type: 'image_url', image_url: { url: imagePreview } }, { type: 'text', text: questionText }, ], }, ]
      : [ { role: 'user' as const, content: `아래는 사용자의 질문입니다. 이 질문은 다음 과목의 한 단원에만 해당합니다.\n후보: ${Object.entries(map).map(([subject, units]) => (units as string[]).map((u) => `${subject} > ${u}`).join(', ')).join(', ')}\n\n질문과 가장 관련이 있다고 판단되는 과목의 단원 하나만 아래 형식으로 먼저 알려주세요.\n예시: 과목명,단원명\n\n그 다음 줄부터는 해당 단원의 관점에서 질문에 대한 답을 해주세요.\n\n질문: ${questionText}`.trim(), }, ];
    
    try {
      const res = await fetch(imagePreview ? '/api/chat-vision' : '/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: prompt, model: 'gpt-4o' }),
      });
  
      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'API 서버에서 에러가 발생했습니다.');
        } catch {
          throw new Error(errorText || 'API 서버에서 알 수 없는 에러가 발생했습니다.');
        }
      }

      if (imagePreview) {
        const data = await res.json();
        const finalAnswer = data.reply || '이미지에 대한 답변을 받지 못했습니다.';
        const classification = "Unsorted,미분류"; 

        const finalMessages = [...initialMessages, userMessage, makeGptMessage(finalAnswer)];
        saveMessages(finalMessages);
        saveToUnitKey(userMessage, finalAnswer, classification);

      } else {
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
        
        let finalAnswer = streamedAnswer.trim();
        let classification = "Unsorted,미분류"; 
        const parts = streamedAnswer.split('\n\n');
        if (parts.length > 1 && parts[0].includes(',')) {
          classification = parts[0].trim();
          finalAnswer = parts.slice(1).join('\n\n').trim();
        }
        
        const finalMessages = [...initialMessages, userMessage, makeGptMessage(finalAnswer)];
        saveMessages(finalMessages);
        saveToUnitKey(userMessage, finalAnswer, classification);
      }
  
    } catch (error: any) {
      console.error('❌ GPT 응답 실패:', error);
      alert(`GPT 응답에 실패했습니다:\n\n${error.message}`);
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
            <div key={i} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative max-w-lg px-3 py-2 rounded-lg whitespace-pre-wrap break-words ${ msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800' }`}>
                
                {msg.sender === 'gpt' && msg.collapsed ? (
                  '[답변 내용 숨김]'
                ) : (
                  <>
                    {msg.image && <img src={msg.image} alt="첨부 이미지" className="max-w-xs rounded-lg mb-2" />}
                    {msg.text ? <p>{msg.text}</p> : (msg.sender === 'gpt' && !msg.image && '...')}
                  </>
                )}

                {msg.sender === 'user' && !isSending && (
                  <button onClick={() => handleDelete(i)} className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-50 hover:opacity-100" title="삭제">&times;</button>
                )}
                {msg.sender === 'gpt' && !isSending && (msg.text || msg.image) && (
                  <button onClick={() => toggleCollapse(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-blue-400 text-white rounded-full text-xs flex items-center justify-center opacity-50 hover:opacity-100" title={msg.collapsed ? '펴기' : '접기'}>
                    {msg.collapsed ? '➕' : '➖'}
                  </button>
                )}
              </div>
            </div>
          ))}
        <div ref={scrollRef} />
        </div>
        <div className="border-t bg-gray-50">
          {imagePreview && (
             <div className="p-2 text-center">
               <img src={imagePreview} alt="Preview" className="max-h-24 inline-block rounded" />
               <button onClick={() => { setImage(null); setImagePreview(''); }} className="ml-2 text-red-500 text-xs align-top">x</button>
             </div>
          )}
          <div className="p-2 flex gap-2">
            <label className={`cursor-pointer flex items-center justify-center px-3 bg-gray-200 rounded-md ${isSending ? 'cursor-not-allowed bg-gray-100' : 'hover:bg-gray-300'}`}>
              📷 <input type="file" accept="image/*" onChange={handleImageChange} hidden disabled={isSending} />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isSending ? "답변을 생성하는 중입니다..." : "질문을 입력하세요"}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="flex-1 border p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={(!input.trim() && !imagePreview) || isSending}
            >
              {isSending ? "전송중" : "전송"}
            </button>
          </div>
        </div>
    </div>
  );
}