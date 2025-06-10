'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  memo?: string;
  date?: string;
  collapsed?: boolean;
  image?: string;
}

export default function ClientPage() {
  const params = useParams();
  const subject = decodeURIComponent(params.subject as string);
  const [questions, setQuestions] = useState<Record<string, Message[]>>({});
  
  const [editingMemo, setEditingMemo] = useState<{ unit: string; index: number; text: string } | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualImage, setManualImage] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string>('');
  const [targetUnit, setTargetUnit] = useState<string>('');

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevQuestionCountRef = useRef(0);

  useEffect(() => {
    const mapRaw = localStorage.getItem('question_unit_map');
    if (!mapRaw) return;
    const map = JSON.parse(mapRaw) as Record<string, string[]>;
    
    const unitsForSubject = map[subject] || [];
    
    const loaded: Record<string, Message[]> = {};
    unitsForSubject.forEach((unit: string) => {
      const key = `question_by_unit_${subject}_${unit}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try { loaded[unit] = JSON.parse(raw); } catch { loaded[unit] = []; }
      }
    });
    setQuestions(loaded);
    prevQuestionCountRef.current = Object.values(loaded).flat().length;

    if (unitsForSubject.length > 0 && !targetUnit) {
      setTargetUnit(unitsForSubject[0]);
    }
  }, [subject, targetUnit]);

  useEffect(() => {
    const currentQuestionCount = Object.values(questions).flat().length;
    if (chatContainerRef.current && currentQuestionCount > prevQuestionCountRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    prevQuestionCountRef.current = currentQuestionCount;
  }, [questions]);
  
  const handleQuestionClick = (messageId: string) => {
    const element = document.getElementById(messageId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const updateUnitData = (unit: string, newMessages: Message[]) => {
    const newQuestions = { ...questions, [unit]: newMessages };
    setQuestions(newQuestions);
    const key = `question_by_unit_${subject}_${unit}`;
    localStorage.setItem(key, JSON.stringify(newMessages));
  };
  
  const handleDelete = (unit: string, index: number) => {
    const unitMessages = [...questions[unit]];
    unitMessages.splice(index, 2);
    updateUnitData(unit, unitMessages);
  };

  const handleToggleCollapse = (unit: string, index: number) => {
    const unitMessages = JSON.parse(JSON.stringify(questions[unit]));
    const message = unitMessages[index];
    message.collapsed = !message.collapsed;
    updateUnitData(unit, unitMessages);
  };

  const handleEditMemoClick = (unit: string, index: number) => {
    const currentMemo = questions[unit][index].memo || '';
    setEditingMemo({ unit, index, text: currentMemo });
  };

  const handleSaveMemo = () => {
    if (!editingMemo) return;
    const { unit, index, text } = editingMemo;
    const unitMessages = JSON.parse(JSON.stringify(questions[unit]));
    unitMessages[index].memo = text;
    updateUnitData(unit, unitMessages);
    setEditingMemo(null);
  };

  const handleCancelEditMemo = () => {
    setEditingMemo(null);
  };
  
  const handleManualImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setManualImage(file);
    const reader = new FileReader();
    reader.onload = () => setManualImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleManualAdd = () => {
    if (!targetUnit || (!manualInput.trim() && !manualImagePreview)) return;
    const userMessage: Message = {
      sender: 'user',
      text: manualInput.trim(),
      date: new Date().toISOString(),
      image: manualImagePreview,
    };
    const gptPlaceholder: Message = {
      sender: 'gpt',
      text: '...',
      collapsed: false
    };
    const unitMessages = [...(questions[targetUnit] || []), userMessage, gptPlaceholder];
    updateUnitData(targetUnit, unitMessages);
    setManualInput('');
    setManualImage(null);
    setManualImagePreview('');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 sticky top-0 bg-gray-50 py-4">📘 {subject} 질문</h1>
        {Object.entries(questions).map(([unit, msgs]) => (
          <div key={unit} className="mb-6">
            <h2 className="text-lg font-bold text-blue-600 mb-3">📚 {unit}</h2>
            <ul className="space-y-2">
              {msgs.filter(msg => msg.sender === 'user').map((msg) => {
                  const index = msgs.findIndex(m => m === msg);
                  const messageId = `message-${unit}-${index}`;
                  const isEditing = editingMemo?.unit === unit && editingMemo?.index === index;
                  const dateString = msg.date ? new Date(msg.date).toLocaleDateString('ko-KR') : '';

                  return (
                    <li key={messageId} className="text-sm p-2 rounded-md hover:bg-gray-100 flex flex-col">
                      {isEditing ? (
                        <div className="w-full">
                          <textarea
                            value={editingMemo.text}
                            onChange={(e) => setEditingMemo({ ...editingMemo, text: e.target.value })}
                            // [수정됨] 메모 입력창의 타이핑 글자색과 플레이스홀더 색상을 진하게 변경
                            className="w-full p-2 border rounded-md text-sm text-gray-900 placeholder:text-gray-500"
                            placeholder="메모를 입력하세요..."
                            rows={3}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={handleCancelEditMemo} className="text-xs px-2 py-1 bg-gray-200 rounded">취소</button>
                            <button onClick={handleSaveMemo} className="text-xs px-2 py-1 bg-blue-500 text-white rounded">저장</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <span onClick={() => handleQuestionClick(messageId)} className="flex-1 truncate pr-2 cursor-pointer font-medium text-gray-800">
                            {msg.memo || msg.text || '[이미지]'}
                          </span>
                          <div className="flex items-center flex-shrink-0">
                            <span className="text-xs text-gray-400 mr-2">({dateString})</span>
                            <button onClick={() => handleEditMemoClick(unit, index)} className="text-xs opacity-50 hover:opacity-100" title="메모 수정">✏️</button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col h-screen">
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {Object.entries(questions).map(([unit, msgs]) => (
              <div key={`chat-unit-${unit}`}>
                <h2 className="text-xl font-bold text-center my-4 p-2 bg-white rounded-lg shadow-sm text-gray-700">{unit}</h2>
                {msgs.map((msg, index) => {
                  const messageId = `message-${unit}-${index}`;
                  return (
                    <div key={index}>
                      {msg.sender === 'user' && msg.memo && (
                        <div className="flex justify-end mb-1">
                          <div className="text-sm text-gray-700 bg-yellow-100 border-l-4 border-yellow-400 p-2 rounded-r-lg max-w-2xl">
                            <span className="font-semibold">📝 내가 남긴 메모:</span> {msg.memo}
                          </div>
                        </div>
                      )}
                      <div id={messageId} className={`flex items-end gap-2 my-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`relative max-w-2xl px-4 py-2 rounded-lg shadow-md ${ msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800' }`}>
                          <div>
                            {msg.image && <img src={msg.image} alt="첨부된 이미지" className="mt-1 mb-2 rounded-lg max-w-sm" />}
                            <p className="whitespace-pre-wrap break-words">
                              {msg.collapsed ? '[답변 내용 숨김]' : msg.text}
                            </p>
                          </div>
                          {msg.sender === 'user' && ( <button onClick={() => handleDelete(unit, index)} className="absolute top-1 right-2 text-xs opacity-50 hover:opacity-100" title="삭제">❌</button> )}
                          {msg.sender === 'gpt' && (
                            <button onClick={() => handleToggleCollapse(unit, index)} className="absolute top-1 right-2 text-xs text-gray-400 opacity-50 hover:opacity-100" title={msg.collapsed ? "펼치기" : "숨기기"}>
                              {msg.collapsed ? '➕' : '➖'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t bg-white shadow-md">
            {manualImagePreview && (
              <div className="mb-2 text-center">
                <img src={manualImagePreview} alt="미리보기" className="max-h-24 inline-block rounded-md" />
                <button onClick={() => { setManualImage(null); setManualImagePreview(''); }} className="text-xs text-red-500 ml-2">취소</button>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <select 
                value={targetUnit} 
                onChange={(e) => setTargetUnit(e.target.value)}
                className="p-2 border rounded-md text-sm bg-gray-100 text-gray-800"
              >
                {Object.keys(questions).length > 0 ? (
                  Object.keys(questions).map(unit => <option key={unit} value={unit}>{unit}</option>)
                ) : (
                  <option disabled>단원을 추가하세요</option>
                )}
              </select>
              <label className="cursor-pointer flex items-center justify-center px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300">
                📷 <input type="file" accept="image/*" onChange={handleManualImageChange} hidden />
              </label>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="선택된 단원에 질문/메모 추가"
                className="flex-1 border p-2 rounded-md text-sm placeholder:text-gray-500 text-gray-900"
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualAdd(); }}
              />
              <button onClick={handleManualAdd} className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-semibold">추가</button>
            </div>
        </div>
      </div>
    </div>
  );
}