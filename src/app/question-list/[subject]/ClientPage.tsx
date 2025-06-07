'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
}

const normalizeKey = (str: string) => str.replace(/\s+/g, '');

export default function ClientPage() {
  const params = useParams();
  const subject = decodeURIComponent(params.subject as string);
  const [questions, setQuestions] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    const mapRaw = localStorage.getItem('question_unit_map');
    if (!mapRaw) return;

    const map = JSON.parse(mapRaw) as Record<string, string[]>;
    const normalizedSubject = normalizeKey(subject);
    const loaded: Record<string, Message[]> = {};

    (map[subject] || []).forEach((unit) => {
      const key = `question_by_unit_${normalizedSubject}_${unit}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const messages: Message[] = JSON.parse(raw);
        loaded[unit] = messages;
      } catch {
        loaded[unit] = [];
      }
    });

    setQuestions(loaded);
  }, [subject]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">📘 {subject} 질문</h1>
      {Object.entries(questions).map(([unit, msgs]) => (
        <div key={unit} className="mb-6">
          <h2 className="text-lg font-semibold text-blue-600 mb-2">📚 {unit}</h2>
          <ul className="list-disc pl-4 space-y-1 text-sm text-gray-800">
            {msgs
              .filter((m) => m.sender === 'user')
              .map((msg, i) => {
                const date = msg.date
                  ? (() => {
                      const d = new Date(msg.date);
                      return `(${d.getMonth() + 1}/${d.getDate()})`;
                    })()
                  : '';
                return (
                  <li key={i}>
                    {msg.text} {date}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
