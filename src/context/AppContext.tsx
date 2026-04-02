import React, { createContext, useContext, useState, useEffect } from 'react';
import { Task, User } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AppContextType {
  user: User | null;
  tasks: Task[];
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'user_id'>) => void;
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

const mapUser = (session: Session | null): User | null => {
  if (!session?.user) return null;
  const u = session.user;
  return {
    id: u.id,
    name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Student',
    email: u.email || '',
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session));
      if (session?.user) {
        fetchTasks(session.user.id);
      } else {
        setTasks([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(mapUser(session));
      if (session?.user) {
        fetchTasks(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTasks = async (userId: string) => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setTasks(data.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        deadline: t.deadline,
        completed: t.completed,
        createdAt: t.created_at,
        user_id: t.user_id,
      })));
    }
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signup = async (name: string, email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return error ? error.message : null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTasks([]);
  };

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'user_id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('tasks').insert({
      title: task.title,
      description: task.description,
      category: task.category,
      deadline: task.deadline,
      user_id: user.id,
    }).select().single();

    if (data && !error) {
      setTasks(prev => [{
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        deadline: data.deadline,
        completed: data.completed,
        createdAt: data.created_at,
        user_id: data.user_id,
      }, ...prev]);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;

    const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', id);
    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateTask(id, { completed: !task.completed });
  };

  return (
    <AppContext.Provider value={{ user, tasks, loading, login, signup, logout, addTask, updateTask, deleteTask, toggleTask }}>
      {children}
    </AppContext.Provider>
  );
};
