import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Task, TaskCategory } from '@/types/task';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TaskCard } from '@/components/TaskCard';
import { TaskDialog } from '@/components/TaskDialog';
import { ProgressBar } from '@/components/ProgressBar';
import { CalendarView } from '@/components/CalendarView';
import { getRandomQuote } from '@/lib/constants';
import { Search, LogOut, Plus, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';

const filters: { value: TaskCategory | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '🗂️' },
  { value: 'study', label: 'Study', emoji: '📚' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'personal', label: 'Personal', emoji: '🌸' },
];

export const Dashboard: React.FC = () => {
  const { user, tasks, logout } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TaskCategory | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [quote] = useState(getRandomQuote);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => filter === 'all' || t.category === filter)
      .filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [tasks, filter, search]);

  const handleEdit = (task: Task) => {
    setEditTask(task);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditTask(null);
    setDialogOpen(true);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Decorative blobs */}
      <div className="fixed top-[-15%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto px-4 pb-24 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">
              {greeting()}, <span className="gradient-text">{user?.user_metadata?.display_name || 'Student'}</span> 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{quote}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              className="h-10 w-10 rounded-xl glass-card flex items-center justify-center hover:bg-destructive/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11 pl-10 rounded-xl glass-card border-border/30"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                filter === f.value
                  ? 'gradient-btn scale-[1.02]'
                  : 'glass-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <ProgressBar />
        </div>

        {/* Tasks */}
        <div className="space-y-3 mb-6">
          <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
            Tasks <span className="text-sm text-muted-foreground font-normal">({filteredTasks.length})</span>
          </h2>
          {filteredTasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center animate-scale-in">
              <p className="text-4xl mb-3">😴</p>
              <p className="font-heading font-semibold text-foreground">No tasks yet</p>
              <p className="text-sm text-muted-foreground mt-1">Tap the + button to add your first task!</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskCard key={task.id} task={task} onEdit={handleEdit} />
            ))
          )}
        </div>

        {/* Calendar */}
        <CalendarView />
      </div>

      {/* FAB */}
      <button onClick={handleAdd} className="float-btn animate-pulse-soft">
        <Plus className="h-6 w-6" />
      </button>

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} editTask={editTask} />
    </div>
  );
};
