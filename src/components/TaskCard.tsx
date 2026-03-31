import React from 'react';
import { Task } from '@/types/task';
import { useApp } from '@/context/AppContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit3, Clock, Bell } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

const categoryConfig = {
  study: { class: 'tag-study', emoji: '📚' },
  work: { class: 'tag-work', emoji: '💼' },
  personal: { class: 'tag-personal', emoji: '🌸' },
};

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit }) => {
  const { toggleTask, deleteTask } = useApp();
  const cat = categoryConfig[task.category];
  const deadlineDate = new Date(task.deadline);
  const overdue = !task.completed && isPast(deadlineDate) && !isToday(deadlineDate);
  const dueToday = isToday(deadlineDate);

  return (
    <div className={`glass-card rounded-2xl p-4 animate-slide-up transition-all duration-300 hover:shadow-lg group ${task.completed ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => toggleTask(task.id)}
            className="h-5 w-5 rounded-md border-2 border-primary/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cat.class}`}>
              {cat.emoji} {task.category}
            </span>
            {overdue && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                ⚠️ Overdue
              </span>
            )}
            {dueToday && !task.completed && (
              <Bell className="h-3.5 w-3.5 text-accent animate-pulse-soft" />
            )}
          </div>
          <h3 className={`font-semibold font-heading text-foreground ${task.completed ? 'line-through' : ''}`}>
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{format(deadlineDate, 'MMM d, yyyy · h:mm a')}</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(task)}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => deleteTask(task.id)}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>
    </div>
  );
};
