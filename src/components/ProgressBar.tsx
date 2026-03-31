import React from 'react';
import { useApp } from '@/context/AppContext';

export const ProgressBar: React.FC = () => {
  const { tasks } = useApp();
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-foreground">Progress 📊</h3>
        <span className="text-sm font-medium text-primary">{done}/{total} done</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: 'var(--gradient-primary)',
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {pct === 100 ? 'All done! You\'re amazing! 🎉' : pct >= 50 ? 'Halfway there! Keep going! 💪' : pct > 0 ? 'Great start! Keep it up! ✨' : 'Let\'s get started! 🚀'}
      </p>
    </div>
  );
};
