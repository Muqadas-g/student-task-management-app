import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  user_id: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState('user');
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', due_date: '' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    getUserAndRole();
  }, []);

  useEffect(() => {
    if (!user) return;
    const subscription = supabase
      .channel('tasks-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          loadTasks(userRole, user.id);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, userRole]);

  const getUserAndRole = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = '/';
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile as UserProfile);
        setUserRole(profile.role || 'user');
      }

      await loadTasks(profile?.role || 'user', authUser.id);
      if (profile?.role === 'admin') {
        await loadAllUsers();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (role: string, userId: string) => {
    let query = supabase.from('tasks').select('*');

    if (role !== 'admin') {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      toast.error('Error loading tasks: ' + error.message);
    } else {
      setTasks((data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        status: t.status || 'pending',
        priority: t.priority || 'medium',
        due_date: t.due_date,
        user_id: t.user_id,
        created_at: t.created_at,
      })));
    }
  };

  const loadAllUsers = async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (!error) {
      setUsers((data || []) as UserProfile[]);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    const { error } = await supabase.from('tasks').insert([
      {
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        status: 'pending',
        user_id: user?.id,
        deadline: newTask.due_date || new Date().toISOString(),
      }
    ]);

    if (error) {
      toast.error('Error creating task: ' + error.message);
    } else {
      toast.success('Task created successfully! 🎉');
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
      await loadTasks(userRole, user?.id || '');
    }
  };

  const updateTask = async (taskId: string, updatedData: Partial<Task>) => {
    const { error } = await supabase
      .from('tasks')
      .update(updatedData)
      .eq('id', taskId);

    if (error) {
      toast.error('Error updating task: ' + error.message);
      return false;
    }

    toast.success('Task updated successfully!');
    await loadTasks(userRole, user?.id || '');
    return true;
  };

  const deleteTask = async (taskId: string) => {
    if (userRole !== 'admin') {
      toast.error('❌ Only Admin can delete tasks!');
      return;
    }

    if (!confirm('⚠️ Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      toast.error('Error deleting task: ' + error.message);
    } else {
      toast.success('Task deleted successfully!');
      await loadTasks(userRole, user?.id || '');
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    await updateTask(taskId, { status: newStatus } as any);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/15 text-destructive';
      case 'medium': return 'bg-accent/15 text-accent-foreground';
      case 'low': return 'bg-primary/15 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-primary/15 text-primary';
      case 'in-progress': return 'bg-accent/15 text-accent-foreground';
      case 'pending': return 'bg-secondary/50 text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Decorative blobs */}
      <div className="fixed top-[-15%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      {/* Navbar */}
      <nav className="glass-card border-b border-border/30 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-heading gradient-text">📋 Task Manager</h1>
              {userRole === 'admin' && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
                  👑 Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-muted-foreground">
                {user?.full_name || user?.email}
              </span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/';
                }}
                className="text-sm text-destructive hover:text-destructive/80 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Create Task Form */}
        <div className="glass-card rounded-2xl p-6 mb-8 animate-scale-in">
          <h2 className="text-lg font-semibold font-heading text-foreground mb-4">➕ Create New Task</h2>
          <form onSubmit={createTask} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                required
              />
            </div>
            <div>
              <textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="low">🟢 Low Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="high">🔴 High Priority</option>
              </select>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                className="p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full gradient-btn py-3 rounded-xl font-medium transition-all hover:scale-[1.01]"
            >
              Create Task
            </button>
          </form>
        </div>

        {/* Admin Panel - Show all users */}
        {userRole === 'admin' && users.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-8 animate-slide-up">
            <h2 className="text-lg font-semibold font-heading text-foreground mb-4">👥 All Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium">Email</th>
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium">Name</th>
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/20">
                      <td className="px-4 py-2 text-foreground">{u.email}</td>
                      <td className="px-4 py-2 text-foreground">{u.full_name || '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {u.role || 'user'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className="glass-card rounded-2xl p-6 animate-slide-up">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold font-heading text-foreground">📝 Tasks</h2>
            <span className="text-sm text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-muted-foreground">No tasks yet. Create your first task above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="glass-card rounded-xl p-4 hover:shadow-lg transition-all duration-300 animate-slide-up">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold font-heading text-foreground">{task.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      )}
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📅 Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      )}
                      {userRole === 'admin' && task.user_id !== user?.id && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          👤 Assigned to: {users.find(u => u.id === task.user_id)?.email || 'Unknown'}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="text-sm border border-border/50 rounded-lg p-1 bg-background text-foreground outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>

                      {userRole === 'admin' && (
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-destructive hover:text-destructive/80 px-2 transition-colors"
                          title="Delete Task"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Information Footer */}
        <div className="mt-6 p-4 glass-card rounded-xl">
          <p className="text-sm text-muted-foreground">
            {userRole === 'admin' ? (
              <>
                👑 <strong className="text-foreground">Admin Access:</strong> You can view all users' tasks, update any task, and delete any task.
              </>
            ) : (
              <>
                👤 <strong className="text-foreground">User Access:</strong> You can only view, create, and update your own tasks.
                <strong className="block mt-1 text-destructive">❌ You cannot delete tasks. Only Admin can delete tasks.</strong>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
