import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Task, TaskCategory } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const categories: { value: TaskCategory; label: string; emoji: string }[] = [
  { value: 'study', label: 'Study', emoji: '📚' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'personal', label: 'Personal', emoji: '🌸' },
];

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTask?: Task | null;
}

export const TaskDialog: React.FC<TaskDialogProps> = ({ open, onOpenChange, editTask }) => {
  const { addTask, updateTask } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description);
      setCategory(editTask.category);
      setDeadline(editTask.deadline.slice(0, 16));
    } else {
      setTitle('');
      setDescription('');
      setCategory('study');
      setDeadline('');
    }
  }, [editTask, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deadline) return;
    if (editTask) {
      updateTask(editTask.id, { title, description, category, deadline: new Date(deadline).toISOString() });
    } else {
      addTask({ title, description, category, deadline: new Date(deadline).toISOString() });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/30 rounded-2xl max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl gradient-text">
            {editTask ? 'Edit Task ✏️' : 'New Task ✨'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              placeholder="e.g. Finish calculus homework"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-11 rounded-xl bg-muted/50 border-border/50"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              placeholder="Add some details..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="rounded-xl bg-muted/50 border-border/50 min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Category</label>
            <div className="flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    category === cat.value
                      ? `tag-${cat.value} ring-2 ring-primary/30 scale-[1.02]`
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Deadline</label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="h-11 rounded-xl bg-muted/50 border-border/50"
              required
            />
          </div>
          <Button type="submit" variant="gradient" size="lg" className="w-full">
            {editTask ? 'Save Changes 💾' : 'Add Task 🚀'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
