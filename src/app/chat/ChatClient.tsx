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
  
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessages = (updated: Message[]) => {
    setMessages(updated);
    localStorage.setItem(`chat_${date}`, JSON.stringify(updated));
  };

  const handleDelete = (index: number) => {
    const currentMessages = [...messages];
    const userMessageToDelete = currentMessages[index];

    if (userMessageToDelete?.sender !== 'user') return;

    currentMessages.splice(index, 2);
    saveMessages(currentMessages);

    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    
    if (!map.Unsorted) {
      map.Unsorted = ['미분류'];
    }

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
    setMessages(prev => [...prev, userMessage, makeGptMessage('답변 생성 중...')]);
    
    setInput('');
    setImage(null);
    setImagePreview('');
    
    const map = JSON.parse(localStorage.getItem('question_unit_map') || '{}');
    
    const systemMessage = {
      role: 'system' as const,
      content: `You are an expert AI assistant. Your primary task is to classify the user's question (based on text and/or image) into one of the provided categories. After classification, you will answer the question.

- You MUST strictly follow the specified output format.
- The first line of your response MUST be the classification in "Subject,Unit" format. Do not add any other text.
- **Priority Rule:** It is more important to find the correct Subject than the perfect Unit. If a question is clearly related to a Subject but doesn't perfectly fit any of its listed Units, you must still choose the most plausible Unit from that relevant Subject.
- Only if the question is completely unrelated to ANY of the provided Subjects, you MUST classify it as "Unsorted,미분류".`
    };

    const userMessageContent = `[CANDIDATES]
${Object.entries(map).map(([subject, units]) => (units as string[]).map((u) => `- ${subject},${u}`).join('\n')).join('\n')}
- Unsorted,미분류

[INSTRUCTION]
First, classify the following user question (text and/or image) by choosing the single most relevant "Subject,Unit" pair from the candidates list, following the priority rules in the system message. Then, answer the question.

[USER QUESTION TEXT]
${questionText || '(텍스트 없음)'}`;

    const prompt = imagePreview 
      ? [
          systemMessage,
          {
            role: 'user' as const,
            content: [
              { type: 'text', text: userMessageContent },
              { type: 'image_url', image_url: { url: imagePreview } }
            ]
          }
        ]
      : [
          systemMessage,
          { role: 'user' as const, content: userMessageContent.replace('[USER QUESTION TEXT]', '[USER QUESTION]') }
        ];
    
    try {
      // [수정됨] 글자 깨짐 현상을 원천적으로 방지하기 위해, 텍스트 질문도 스트리밍이 아닌 chat-vision API로 요청합니다.
      // chat-vision API는 이미지와 텍스트를 모두 처리할 수 있습니다.
      const res = await fetch('/api/chat-vision', {
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

      // [수정됨] 모든 응답을 JSON으로 한 번에 받아 처리하는 방식으로 통일
      const data = await res.json();
      const fullResponseText = data.reply || '';
      
      let finalAnswer = fullResponseText.trim();
      let classification = "Unsorted,미분류"; 
      const parts = fullResponseText.split('\n');
      if (parts.length > 0 && parts[0].includes(',')) {
        classification = parts[0].trim();
        finalAnswer = parts.slice(1).join('\n').trim() || '답변을 확인해주세요.';
      }
      
      const finalMessages = [...initialMessages, userMessage, makeGptMessage(finalAnswer)];
      saveMessages(finalMessages);
      saveToUnitKey(userMessage, finalAnswer, classification);
  
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
                    {msg.text && <p>{msg.text}</p>}
                  </>
                )}

                {msg.sender === 'user' && !isSending && (
                  <button onClick={() => handleDelete(i)} className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-50 hover:opacity-100" title="삭제">&times;</button>
                )}
                {msg.sender === 'gpt' && !isSending && msg.text && msg.text !== '답변 생성 중...' && (
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