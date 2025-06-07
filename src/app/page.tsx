'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Message {
  sender: 'user' | 'gpt';
  text: string;
  date?: string;
}

interface GraphData {
  date: string;
  [subject: string]: number | string;
}

const normalizeKey = (str: string) => str.replace(/\s+/g, '');

export default function HomePage() {
  const [value, setValue] = useState(new Date());
  const [graphData, setGraphData] = useState<GraphData[]>([]);
  const router = useRouter();

  const handleDateClick = (date: Date) => {
    const formatted =
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0');
    router.push(`/chat?date=${formatted}`);
  };

  useEffect(() => {
    const today = new Date();
    const past7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const subjectMapRaw = localStorage.getItem('question_unit_map');
    if (!subjectMapRaw) return;
    const subjectMap = JSON.parse(subjectMapRaw) as Record<string, string[]>;
    const subjectNames = Object.keys(subjectMap);

    const dateMap: Record<string, Record<string, number>> = {};

    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith('question_by_unit_')) return;
      const messages: Message[] = JSON.parse(localStorage.getItem(key) || '[]');
      const parts = key.replace('question_by_unit_', '').split('_');
      const subjectKey = parts[0];
      const subjectName = subjectNames.find(
        (s) => normalizeKey(s) === subjectKey
      );
      if (!subjectName) return;

      messages.forEach((msg) => {
        if (msg.sender !== 'user' || !msg.date) return;

        if (!dateMap[msg.date]) dateMap[msg.date] = {};
        if (!dateMap[msg.date][subjectName])
          dateMap[msg.date][subjectName] = 0;
        dateMap[msg.date][subjectName]++;
      });
    });

    const final: GraphData[] = past7.map((d) => {
      const iso = d.toISOString().split('T')[0];
      const formatted = `${d.getMonth() + 1}/${d.getDate()}`;
      const entry: GraphData = { date: formatted };
      subjectNames.forEach((s) => {
        entry[s] = dateMap[iso]?.[s] || 0;
      });
      return entry;
    });

    setGraphData(final);
  }, []);

  return (
    <div className="flex flex-col items-center pt-12 min-h-screen bg-white">
      <h1 className="text-2xl font-bold mb-6">📅 STUDY_HELPER</h1>

      <div className="scale-110 mb-6">
        <Calendar onClickDay={handleDateClick} value={value} />
      </div>

      <button
        className="mb-10 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => router.push('/question-list')}
      >
        질문 리스트 보기
      </button>

      <div className="w-[60%] h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={graphData}>
            <XAxis dataKey="date" />
            <YAxis />
            <Legend />
            {Object.keys(graphData[0] || {})
              .filter((k) => k !== 'date')
              .map((subject, idx) => (
                <Bar
                  key={subject}
                  dataKey={subject}
                  fill={
                    ['#e11d48', '#1e293b', '#10b981', '#6366f1'][idx % 4]
                  }
                />
              ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
