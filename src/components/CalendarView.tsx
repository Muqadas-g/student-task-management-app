import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const CalendarView: React.FC = () => {
  const { tasks } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getTasksForDay = (day: Date) => tasks.filter(t => isSameDay(new Date(t.deadline), day));

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground">Calendar 📅</h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[120px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
          <button onClick={nextMonth} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
        {days.map((day, i) => {
          const dayTasks = getTasksForDay(day);
          const inMonth = day.getMonth() === currentMonth.getMonth();
          return (
            <div
              key={i}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                isToday(day) ? 'bg-primary/15 font-bold text-primary' : inMonth ? 'text-foreground hover:bg-muted' : 'text-muted-foreground/40'
              }`}
            >
              {format(day, 'd')}
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayTasks.slice(0, 3).map((t, j) => (
                    <div key={j} className={`h-1 w-1 rounded-full ${t.category === 'study' ? 'bg-tag-study' : t.category === 'work' ? 'bg-tag-work' : 'bg-tag-personal'}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
