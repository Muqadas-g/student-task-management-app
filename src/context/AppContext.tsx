import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';

export type TaskCategory = 'study' | 'work' | 'personal';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  deadline: string;
  completed: boolean;
  created_at: string;
}

interface AppContextType {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  tasks: Task[];
  tasksLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'completed'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch tasks when user changes
  useEffect(() => {
    if (user) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [user]);

  const fetchTasks = async () => {
    setTasksLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load tasks');
      console.error(error);
    } else {
      setTasks((data ?? []).map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category as TaskCategory,
        deadline: t.deadline,
        completed: t.completed,
        created_at: t.created_at,
      })));
    }
    setTasksLoading(false);
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const addTask = async (task: Omit<Task, 'id' | 'created_at' | 'completed'>) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user!.id,
        title: task.title,
        description: task.description,
        category: task.category,
        deadline: task.deadline,
        completed: false,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add task');
      console.error(error);
      return;
    }

    setTasks(prev => [{
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category as TaskCategory,
      deadline: data.deadline,
      completed: data.completed,
      created_at: data.created_at,
    }, ...prev]);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update task');
      console.error(error);
      return;
    }

    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete task');
      console.error(error);
      return;
    }

    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateTask(id, { completed: !task.completed });
  };

  return (
    <AppContext.Provider value={{ user, session, loading, tasks, tasksLoading, login, signup, logout, addTask, updateTask, deleteTask, toggleTask }}>
      {children}
    </AppContext.Provider>
  );
};
