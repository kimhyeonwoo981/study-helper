'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
}

export default function QuestionListPage() {
  const [unitMap, setUnitMap] = useState<Record<string, string[]>>({});
  const [userQuestionsByUnit, setUserQuestionsByUnit] = useState<Record<string, Message[]>>({});
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingQuestion, setMovingQuestion] = useState<{ subject: string; unit: string; question: Message } | null>(null);
  const [targetSubject, setTargetSubject] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    loadUnitMap();
  }, []);

  const loadUnitMap = () => {
    const mapRaw = localStorage.getItem('question_unit_map');
    const map = mapRaw ? JSON.parse(mapRaw) : {};

    if (!map.Unsorted) {
      map.Unsorted = ['미분류'];
      localStorage.setItem('question_unit_map', JSON.stringify(map));
    }

    setUnitMap(map);

    const allQuestionTexts: Record<string, Message[]> = {};
    Object.entries(map).forEach(([subject, units]) => {
      (units as string[]).forEach((unit) => {
        const storageKey = `question_by_unit_${subject}_${unit}`;
        const stateKey = `${subject}-${unit}`;
        try {
          const raw = localStorage.getItem(storageKey);
          const messages: Message[] = raw ? JSON.parse(raw) : [];
          allQuestionTexts[stateKey] = messages.filter((msg) => msg.sender === 'user');
        } catch {
          allQuestionTexts[stateKey] = [];
        }
      });
    });
    setUserQuestionsByUnit(allQuestionTexts);
  };

  const filteredData = useMemo(() => {
    const filteredQuestions: Record<string, Message[]> = {};
    const filteredCounts: Record<string, number> = {};
    const lowerCaseFilter = filterText.toLowerCase();

    Object.entries(userQuestionsByUnit).forEach(([key, questions]) => {
      if (!filterText) {
        filteredQuestions[key] = questions;
        filteredCounts[key] = questions.length;
      } else {
        const filtered = questions.filter(q => q.text.toLowerCase().includes(lowerCaseFilter));
        filteredQuestions[key] = filtered;
        filteredCounts[key] = filtered.length;
      }
    });
    return { questions: filteredQuestions, counts: filteredCounts };
  }, [filterText, userQuestionsByUnit]);

  const handleDeleteQuestion = (subject: string, unit: string, questionToDelete: Message) => {
    if (!confirm('정말 이 질문과 답변을 삭제할까요?')) return;
    const key = `question_by_unit_${subject}_${unit}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;

    const messages: Message[] = JSON.parse(raw);
    const questionIndex = messages.findIndex(
      (msg) => msg.sender === 'user' && msg.text === questionToDelete.text && msg.date === questionToDelete.date
    );

    if (questionIndex !== -1) {
      messages.splice(questionIndex, 2);
      localStorage.setItem(key, JSON.stringify(messages));
      loadUnitMap();
    }
  };

  const openMoveModal = (subject: string, unit: string, question: Message) => {
    setMovingQuestion({ subject, unit, question });
    const firstSubject = Object.keys(unitMap)[0] || '';
    setTargetSubject(firstSubject);
    setTargetUnit(unitMap?.[firstSubject]?.[0] || '');
    setIsMoveModalOpen(true);
  };

  const handleExecuteMove = () => {
    if (!movingQuestion || !targetSubject || !targetUnit) return;
    const { subject: fromSubject, unit: fromUnit, question: questionToMove } = movingQuestion;
    
    const fromKey = `question_by_unit_${fromSubject}_${fromUnit}`;
    const toKey = `question_by_unit_${targetSubject}_${targetUnit}`;

    if (fromKey === toKey) return alert('현재 위치와 같은 단원으로는 이동할 수 없습니다.');

    const fromList: Message[] = JSON.parse(localStorage.getItem(fromKey) || '[]');
    const toList: Message[] = JSON.parse(localStorage.getItem(toKey) || '[]');

    const actualIndex = fromList.findIndex(
      (msg) => msg.sender === 'user' && msg.text === questionToMove.text && msg.date === questionToMove.date
    );

    if (actualIndex === -1) return alert('오류: 이동할 질문을 찾지 못했습니다.');

    const movedItems = fromList.splice(actualIndex, 2);
    localStorage.setItem(fromKey, JSON.stringify(fromList));
    localStorage.setItem(toKey, JSON.stringify([...toList, ...movedItems]));

    loadUnitMap();
    setIsMoveModalOpen(false);
    setMovingQuestion(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">📘 질문 리스트</h1>
        <button
          onClick={() => {
            const name = prompt('새 과목명을 입력하세요');
            if (name) {
              const map = { ...unitMap, [name]: [] };
              localStorage.setItem('question_unit_map', JSON.stringify(map));
              setUnitMap(map);
            }
          }}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          + 과목 추가
        </button>
      </div>
      
      <div className="mb-6">
        <input
          type="text"
          placeholder="질문 내용 검색..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      {Object.entries(unitMap).map(([subject, units]) => (
        <div key={subject} className="border rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">📚 {subject}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                const name = prompt('새 단원명을 입력하세요');
                if (name) {
                  const updated = { ...unitMap, [subject]: [...(unitMap?.[subject] || []), name] };
                  localStorage.setItem('question_unit_map', JSON.stringify(updated));
                  loadUnitMap();
                }
              }} className="text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
                + 단원 추가
              </button>
              <button onClick={() => {
                if (!confirm(`정말 과목 "${subject}"을 삭제할까요?`)) return;
                const updated = { ...unitMap };
                delete updated?.[subject];
                localStorage.setItem('question_unit_map', JSON.stringify(updated));
                Object.keys(localStorage).forEach((key) => {
                  if (key.startsWith(`question_by_unit_${subject}_`)) {
                    localStorage.removeItem(key);
                  }
                });
                loadUnitMap();
              }} className="text-sm bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
                과목 삭제
              </button>
              
              <Link
                href={`/question-list/${encodeURIComponent(subject)}`}
                className="text-sm bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
              >
                보기
              </Link>

            </div>
          </div>

          <ul className="pl-4 space-y-2">
            {(units as string[]).map((unit) => {
              const stateKey = `${subject}-${unit}`;
              const count = filteredData.counts[stateKey] || 0;
              const questionsToDisplay = filteredData.questions[stateKey] || [];
              
              // [수정됨] 검색어가 있을 때만 개수가 0인 단원을 숨깁니다.
              // 이렇게 하면 새로 추가된 빈 단원도 화면에 보이게 됩니다.
              if (filterText && count === 0) {
                return null;
              }

              return (
                <li key={unit} className="mb-1">
                  <div className="flex justify-between items-center text-blue-600 font-medium mb-1">
                    <span>📘 {unit} (<span className="text-gray-700 font-normal">{count}개 질문</span>)</span>
                    <button onClick={() => {
                      if (!confirm(`정말 단원 "${unit}"을 삭제할까요?`)) return;
                      const updated = { ...unitMap, [subject]: unitMap?.[subject]?.filter((u) => u !== unit) };
                      localStorage.setItem('question_unit_map', JSON.stringify(updated));
                      localStorage.removeItem(`question_by_unit_${subject}_${unit}`);
                      loadUnitMap();
                    }} className="text-xs text-red-500 hover:underline">
                      단원 삭제
                    </button>
                  </div>
                  <ul className="pl-6 list-disc text-sm text-gray-700">
                    {questionsToDisplay.map((q, i) => (
                      <li key={`${q.date}-${i}`} className="flex justify-between items-center py-1">
                        <span>{q.text} <span className="text-xs text-gray-500">{q.date ? `(${(new Date(q.date)).getMonth() + 1}/${(new Date(q.date)).getDate()})` : ''}</span></span>
                        <div className="flex gap-2 text-xs">
                          <button onClick={() => handleDeleteQuestion(subject, unit, q)} className="text-red-500 hover:underline">❌ 삭제</button>
                          <button onClick={() => openMoveModal(subject, unit, q)} className="text-green-500 hover:underline">➡ 이동</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {isMoveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">질문 이동</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이동할 과목</label>
                <select value={targetSubject} onChange={(e) => {
                  setTargetSubject(e.target.value);
                  setTargetUnit(unitMap?.[e.target.value]?.[0] || '');
                }} className="w-full p-2 border border-gray-300 rounded-md">
                  {Object.keys(unitMap).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이동할 단원</label>
                <select value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" disabled={!targetSubject || !unitMap?.[targetSubject]?.length}>
                  {targetSubject && unitMap?.[targetSubject]?.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={() => setIsMoveModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">취소</button>
              <button onClick={handleExecuteMove} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">이동 확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}