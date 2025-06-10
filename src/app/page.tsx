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
  Tooltip,
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
    const past7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return d;
    }).reverse();

    const subjectMapRaw = localStorage.getItem('question_unit_map');
    if (!subjectMapRaw) return;
    const subjectMap = JSON.parse(subjectMapRaw) as Record<string, string[]>;
    const subjectNames = Object.keys(subjectMap);

    const countsByDate: Record<string, Record<string, number>> = {};

    Object.entries(subjectMap).forEach(([subject, units]) => {
      (units as string[]).forEach(unit => {
        const key = `question_by_unit_${subject}_${unit}`;
        const rawMessages = localStorage.getItem(key);

        if (rawMessages) {
          const messages: Message[] = JSON.parse(rawMessages);
          messages.forEach(msg => {
            if (msg.sender === 'user' && msg.date) {
              const datePart = msg.date.split('T')[0];

              if (!countsByDate[datePart]) {
                countsByDate[datePart] = {};
              }
              if (!countsByDate[datePart][subject]) {
                countsByDate[datePart][subject] = 0;
              }
              countsByDate[datePart][subject]++;
            }
          });
        }
      });
    });

    const finalChartData: GraphData[] = past7Days.map((d) => {
      const isoDate = d.toISOString().split('T')[0];
      const formattedDate = `${d.getMonth() + 1}/${d.getDate()}`;
      
      const entry: GraphData = { date: formattedDate };
      
      subjectNames.forEach((subjectName) => {
        entry[subjectName] = countsByDate[isoDate]?.[subjectName] || 0;
      });

      return entry;
    });

    setGraphData(finalChartData);
  }, []);

  const barColors = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316'];

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
        <h2 className="text-lg font-semibold text-center mb-2">최근 7일간 질문 수</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={graphData}>
            <XAxis dataKey="date" fontSize={12} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            {(graphData[0] ? Object.keys(graphData[0]) : [])
              .filter((k) => k !== 'date')
              .map((subject, idx) => (
                <Bar
                  key={subject}
                  dataKey={subject}
                  // [수정됨] stackId="a" 속성을 제거하여 막대가 옆으로 나란히 표시되도록 합니다.
                  fill={barColors[idx % barColors.length]}
                />
              ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}