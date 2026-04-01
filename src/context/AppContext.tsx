import React, { createContext, useContext, useState, useEffect } from 'react';
import { Task, User } from '@/types/task';
import { getTasks, saveTasks, getUser, saveUser, clearUser } from '@/lib/store';

interface AppContextType {
  user: User | null;
  tasks: Task[];
  login: (user: User) => void;
  logout: () => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getUser());
  const [tasks, setTasks] = useState<Task[]>(getTasks());

  useEffect(() => { saveTasks(tasks); }, [tasks]);

  const login = (u: User) => { saveUser(u); setUser(u); };
  const logout = () => { clearUser(); setUser(null); };

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => {
    setTasks(prev => [...prev, {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completed: false,
    }]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  return (
    <AppContext.Provider value={{ user, tasks, login, logout, addTask, updateTask, deleteTask, toggleTask }}>
      {children}
    </AppContext.Provider>
  );
};
