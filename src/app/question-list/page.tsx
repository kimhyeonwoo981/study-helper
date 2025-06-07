'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
}

const normalizeKey = (str: string) => str.replace(/\s+/g, '');

export default function QuestionListPage() {
  const [unitMap, setUnitMap] = useState<Record<string, string[]>>({});
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [userQuestionsByUnit, setUserQuestionsByUnit] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    loadUnitMap();
  }, []);

  const loadUnitMap = () => {
    const mapRaw = localStorage.getItem('question_unit_map');
    if (!mapRaw) return;

    const map = JSON.parse(mapRaw) as Record<string, string[]>;
    setUnitMap(map);

    const counts: Record<string, number> = {};
    const questionTexts: Record<string, Message[]> = {};

    Object.entries(map).forEach(([subject, units]) => {
      const normalizedSubject = normalizeKey(subject);
      units.forEach((unit) => {
        const key = `question_by_unit_${normalizedSubject}_${unit}`;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) {
            counts[key] = 0;
            questionTexts[key] = [];
            return;
          }
          const messages: Message[] = JSON.parse(raw);
          const userMessages = messages.filter((msg) => msg.sender === 'user');
          counts[key] = userMessages.length;
          questionTexts[key] = userMessages;
        } catch {
          counts[key] = 0;
          questionTexts[key] = [];
        }
      });
    });

    setQuestionCounts(counts);
    setUserQuestionsByUnit(questionTexts);
  };

  const handleEditQuestion = (subject: string, unit: string, index: number) => {
    const normalizedSubject = normalizeKey(subject);
    const key = `question_by_unit_${normalizedSubject}_${unit}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const messages: Message[] = JSON.parse(raw);
    const userMessages = messages.filter((msg) => msg.sender === 'user');
    const oldText = userMessages[index]?.text;
    const newText = prompt('질문을 수정하세요', oldText);
    if (!newText || newText === oldText) return;

    let userCount = 0;
    const updatedMessages = messages.map((msg) => {
      if (msg.sender === 'user') {
        if (userCount === index) {
          userCount++;
          return { ...msg, text: newText };
        }
        userCount++;
      }
      return msg;
    });

    localStorage.setItem(key, JSON.stringify(updatedMessages));
    loadUnitMap();
  };

  const handleDeleteQuestion = (subject: string, unit: string, index: number) => {
    if (!confirm('정말 이 질문을 삭제할까요?')) return;
    const normalizedSubject = normalizeKey(subject);
    const key = `question_by_unit_${normalizedSubject}_${unit}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const messages: Message[] = JSON.parse(raw);

    let userCount = 0;
    const updated = [...messages];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].sender === 'user') {
        if (userCount === index) {
          updated.splice(i, 2);
          break;
        }
        userCount++;
      }
    }
    localStorage.setItem(key, JSON.stringify(updated));
    loadUnitMap();
  };

  const handleMoveToUnit = (fromKey: string, index: number) => {
    const toSubject = prompt('옮길 과목명을 입력하세요');
    if (!toSubject) return;
    const toUnit = prompt('옮길 단원명을 입력하세요');
    if (!toUnit) return;
    const toKey = `question_by_unit_${normalizeKey(toSubject)}_${toUnit}`;

    const fromList = JSON.parse(localStorage.getItem(fromKey) || '[]');
    const toList = JSON.parse(localStorage.getItem(toKey) || '[]');

    const moved = fromList.slice(index, index + 2);
    const newFrom = [...fromList];
    newFrom.splice(index, 2);

    localStorage.setItem(fromKey, JSON.stringify(newFrom));
    localStorage.setItem(toKey, JSON.stringify([...toList, ...moved]));
    loadUnitMap();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📘 질문 리스트</h1>
      <button
        onClick={() => {
          const name = prompt('새 과목명을 입력하세요');
          if (!name) return;
          const map = { ...unitMap, [name]: [] };
          localStorage.setItem('question_unit_map', JSON.stringify(map));
          setUnitMap(map);
        }}
        className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        + 과목 추가
      </button>

      {Object.entries(unitMap).map(([subject, units]) => (
        <div key={subject} className="border rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">📚 {subject}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const name = prompt('새 단원명을 입력하세요');
                  if (!name) return;
                  const updated = { ...unitMap, [subject]: [...(unitMap[subject] || []), name] };
                  localStorage.setItem('question_unit_map', JSON.stringify(updated));
                  setUnitMap(updated);
                }}
                className="text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              >
                + 단원 추가
              </button>
              <button
                onClick={() => {
                  if (!confirm(`정말 과목 "${subject}"을 삭제할까요?`)) return;
                  const updated = { ...unitMap };
                  delete updated[subject];
                  localStorage.setItem('question_unit_map', JSON.stringify(updated));
                  setUnitMap(updated);

                  const normalizedSubject = normalizeKey(subject);
                  Object.keys(localStorage).forEach((key) => {
                    if (key.startsWith(`question_by_unit_${normalizedSubject}_`)) {
                      localStorage.removeItem(key);
                    }
                  });
                }}
                className="text-sm bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
              >
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

          <ul className="pl-4 space-y-4">
            {units.map((unit) => {
              const normalizedSubject = normalizeKey(subject);
              const key = `question_by_unit_${normalizedSubject}_${unit}`;
              const count = questionCounts[key] || 0;
              const userQuestions = userQuestionsByUnit[key] || [];

              return (
                <li key={unit}>
                  <div className="flex justify-between items-center text-blue-600 font-medium mb-1">
                    📘 {unit} ({count}개 질문)
                    <button
                      onClick={() => {
                        if (!confirm(`정말 단원 "${unit}"을 삭제할까요?`)) return;
                        const updated = {
                          ...unitMap,
                          [subject]: unitMap[subject].filter((u) => u !== unit),
                        };
                        localStorage.setItem('question_unit_map', JSON.stringify(updated));
                        setUnitMap(updated);
                        const normalizedSubject = normalizeKey(subject);
                        const key = `question_by_unit_${normalizedSubject}_${unit}`;
                        localStorage.removeItem(key);
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      단원 삭제
                    </button>
                  </div>
                  <ul className="pl-4 list-disc text-sm text-gray-700">
                    {userQuestions.map((q, i) => {
                      const formattedDate = q.date
                        ? (() => {
                            const d = new Date(q.date);
                            return `(${d.getMonth() + 1}/${d.getDate()})`;
                          })()
                        : '';
                      const moveButton = subject === 'Unsorted' ? (
                        <button
                          onClick={() => handleMoveToUnit(`question_by_unit_Unsorted_미분류`, i * 2)}
                          className="text-green-500 hover:underline ml-1"
                        >
                          ➡ 이동
                        </button>
                      ) : null;
                      return (
                        <li key={i} className="flex justify-between items-center">
                          <span>{q.text} {formattedDate}</span>
                          <div className="flex gap-1 text-xs">
                            <button
                              onClick={() => handleEditQuestion(subject, unit, i)}
                              className="text-blue-500 hover:underline"
                            >
                              ✏️ 수정
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(subject, unit, i)}
                              className="text-red-500 hover:underline"
                            >
                              ❌ 삭제
                            </button>
                            {moveButton}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
