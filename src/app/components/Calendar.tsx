'use client';

import { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function CalendarComponent() {
  const [value, setValue] = useState<Date>(new Date());

  return (
    <div className="p-8">
      <Calendar
        onChange={(date) => setValue(date as Date)}
        value={value}
      />
    </div>
  );
}
