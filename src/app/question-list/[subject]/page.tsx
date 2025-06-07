'use client';

import { useEffect, useState } from 'react';

interface Props {
  params: { subject: string };
  searchParams: { unit?: string };
}

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
}

// 공백 제거 (저장된 키와 매칭되게)
const normalizeKey = (str: string) => str.replace(/\s+/g, '');

export default function SubjectDetailPage({ params, searchParams }: Props) {
  const subject = decodeURIComponent(params.subject);
  const normalizedSubject = normalizeKey(subject);
  const targetUnit = searchParams.unit ? decodeURIComponent(searchParams.unit) : null;

  const [unitMap, setUnitMap] = useState<Record<string, string[]>>({});
  const [questionsByUnit, setQuestionsByUnit] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    const savedMap = localStorage.getItem('question_unit_map');
    if (savedMap) setUnitMap(JSON.parse(savedMap));

    const questionData: Record<string, Message[]> = {};
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith('question_by_unit_')) {
        try {
          questionData[key] = JSON.parse(localStorage.getItem(key) || '[]');
        } catch {
          questionData[key] = [];
        }
      }
    });
    setQuestionsByUnit(questionData);
  }, []);

  const getKey = (subject: string, unit: string) => `question_by_unit_${normalizeKey(subject)}_${unit}`;

  const units = unitMap[subject] || [];
  const displayedUnits = targetUnit ? units.filter((u) => u === targetUnit) : units;

  return (
    <div className="flex h-screen">
      {/* 좌측: 단원 + 질문 리스트 */}
      <div className="w-1/2 border-r overflow-y-auto p-4">
        <h2 className="text-xl font-bold mb-4">📘 {subject} 질문</h2>
        {displayedUnits.map((unit) => {
          const key = getKey(subject, unit);
          const messages = questionsByUnit[key] || [];
          const onlyUserQuestions = messages.filter((m) => m.sender === 'user');
          return (
            <div key={unit} className="mb-4">
              <h3 className="text-md font-semibold mb-1">📘 {unit}</h3>
              <ul className="list-disc pl-4 text-sm space-y-1">
                {onlyUserQuestions.map((q, i) => {
                  const date = q.date ? new Date(q.date) : null;
                  const formatted = date ? `(${date.getMonth() + 1}/${date.getDate()})` : '';
                  return <li key={i}>{q.text} {formatted}</li>;
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* 우측: 채팅형 응답 보기 */}
      <div className="w-1/2 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">🧠 GPT 응답 보기</h2>
        {displayedUnits.map((unit) => {
          const key = getKey(subject, unit);
          const messages = questionsByUnit[key] || [];
          return messages.map((msg, i) => {
            const isGpt = msg.sender === 'gpt';
            let content = msg.text;
            if (isGpt) {
              const lines = content.trim().split('\n');
              if (lines.length > 0) {
                const trimmed = lines[0].startsWith('[')
                  ? lines[0].replace(/^\[[^\]]*\],?/, '')
                  : lines[0];
                const body = lines.slice(1).join('\n').replace(/^.{0,4}/, '');
                content = `${body}`.trim();
              }
            }
            return (
              <div key={`${unit}-${i}`} className="mb-4">
                <div className={`text-sm px-3 py-2 rounded inline-block ${msg.sender === 'user' ? 'bg-blue-100 text-right float-right' : 'bg-gray-100 text-left float-left'}`}>
                  {content}
                </div>
                <div className="clear-both h-1" />
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
