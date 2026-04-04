import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  description: string;
  project_link: string;
  status: string;
  priority: string;
  due_date: string;
  assigned_to: string;
  assigned_user_name?: string;
  user_id: string;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string;
}

export const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'analytics'>('tasks');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assigned_to: '',
    due_date: ''
  });
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    project_link: '',
    priority: 'medium',
    due_date: '',
    assigned_to: ''
  });

  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completionRate: 0,
    tasksByPriority: { low: 0, medium: 0, high: 0 },
    tasksByStatus: { pending: 0, 'in-progress': 0, completed: 0 }
  });

  useEffect(() => {
    getUserAndRole();
    setupRealtimeSubscriptions();
  }, []);

  const getUserAndRole = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        window.location.href = '/login';
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile as User);
        setUserRole(profile.role || 'member');
      }

      await loadAllUsers();
      await loadTasks();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data as User[]);
  };

  const loadTasks = async () => {
    let query = supabase.from('tasks').select(`
      *,
      assigned_user:assigned_to(id, full_name, email)
    `);
    
    if (userRole !== 'admin') {
      query = query.or(`user_id.eq.${user?.id},assigned_to.eq.${user?.id}`);
    }
    
    const { data, error } = await query;
    if (!error && data) {
      const tasksWithNames = data.map((task: any) => ({
        ...task,
        assigned_user_name: task.assigned_user?.full_name || 'Unassigned'
      }));
      setTasks(tasksWithNames);
      calculateStats(tasksWithNames);
    }
  };

  const calculateStats = (tasksData: Task[]) => {
    const total = tasksData.length;
    const completed = tasksData.filter(t => t.status === 'completed').length;
    const pending = tasksData.filter(t => t.status === 'pending').length;
    const inProgress = tasksData.filter(t => t.status === 'in-progress').length;
    
    setStats({
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      inProgressTasks: inProgress,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      tasksByPriority: {
        low: tasksData.filter(t => t.priority === 'low').length,
        medium: tasksData.filter(t => t.priority === 'medium').length,
        high: tasksData.filter(t => t.priority === 'high').length
      },
      tasksByStatus: {
        pending,
        'in-progress': inProgress,
        completed
      }
    });
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
        assigned_to: newTask.assigned_to || null,
        status: 'pending',
        user_id: user?.id,
        deadline: newTask.due_date || new Date().toISOString(),
        project_link: newTask.project_link || null
      }
    ]);

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Task created with project link! 🎉');
      setNewTask({ title: '', description: '', project_link: '', priority: 'medium', due_date: '', assigned_to: '' });
      await loadTasks();
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);
    
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Task updated!');
      await loadTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
    if (userRole !== 'admin') {
      toast.error('❌ Only Admin can delete tasks!');
      return;
    }
    if (!confirm('Delete this task?')) return;
    
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Task deleted!');
      await loadTasks();
    }
  };

  const setupRealtimeSubscriptions = () => {
    supabase
      .channel('tasks-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .subscribe();
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = [...tasks];
    
    if (searchQuery) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (filters.status) filtered = filtered.filter(task => task.status === filters.status);
    if (filters.priority) filtered = filtered.filter(task => task.priority === filters.priority);
    if (userRole === 'admin' && filters.assigned_to) filtered = filtered.filter(task => task.assigned_to === filters.assigned_to);
    
    if (filters.due_date) {
      const today = new Date().toISOString().split('T')[0];
      if (filters.due_date === 'today') {
        filtered = filtered.filter(task => task.due_date === today);
      } else if (filters.due_date === 'week') {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        filtered = filtered.filter(task => task.due_date && task.due_date <= nextWeek.toISOString().split('T')[0]);
      } else if (filters.due_date === 'overdue') {
        filtered = filtered.filter(task => task.due_date && task.due_date < today && task.status !== 'completed');
      }
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'priority': {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 0);
          break;
        }
        case 'due_date':
          comparison = (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return `px-2 py-1 rounded-full text-xs ${colors[priority] || colors.medium}`;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      pending: 'bg-yellow-100 text-yellow-700'
    };
    return `px-2 py-1 rounded-full text-xs ${colors[status] || colors.pending}`;
  };

  const filteredTasks = getFilteredAndSortedTasks();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">📋 Team Task Manager</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary mt-2 inline-block">
            {userRole === 'admin' ? '👑 Admin' : '👤 Member'}
          </span>
          <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`w-full text-left px-4 py-2 rounded-lg transition flex items-center gap-3 ${activeTab === 'tasks' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          >
            📝 My Tasks
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full text-left px-4 py-2 rounded-lg transition flex items-center gap-3 ${activeTab === 'analytics' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          >
            📊 Analytics
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-foreground">
              {activeTab === 'tasks' && 'Task Manager'}
              {activeTab === 'analytics' && 'Analytics Dashboard'}
            </h2>
            <div>
              <input
                type="text"
                placeholder="🔍 Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            <>
              {/* Filters */}
              <div className="bg-card rounded-lg shadow-sm p-4 mb-6 border border-border">
                <div className="flex flex-wrap gap-3">
                  <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})} className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <select value={filters.due_date} onChange={e => setFilters({...filters, due_date: e.target.value})} className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                    <option value="">All Dates</option>
                    <option value="today">Due Today</option>
                    <option value="week">Due This Week</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                    <option value="due_date">Sort by Due Date</option>
                    <option value="priority">Sort by Priority</option>
                    <option value="status">Sort by Status</option>
                  </select>
                  <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 border border-border rounded-lg text-sm bg-muted text-foreground">
                    {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                  </button>
                </div>
              </div>

              {/* Create Task Form */}
              <div className="bg-card rounded-lg shadow-sm p-6 mb-6 border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">➕ Create New Task</h3>
                <form onSubmit={createTask} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Task Title *"
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                    required
                  />
                  
                  {/* Project Link Field */}
                  <input
                    type="url"
                    placeholder="🔗 Project Link (e.g., https://your-project.lovable.app)"
                    value={newTask.project_link}
                    onChange={e => setNewTask({...newTask, project_link: e.target.value})}
                    className="w-full p-2 border border-border rounded-lg bg-muted/50 text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">Add your project's live demo link here</p>
                  
                  <textarea
                    placeholder="Description (optional)"
                    value={newTask.description}
                    onChange={e => setNewTask({...newTask, description: e.target.value})}
                    className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                    rows={2}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="p-2 border border-border rounded-lg bg-background text-foreground">
                      <option value="low">🟢 Low Priority</option>
                      <option value="medium">🟡 Medium Priority</option>
                      <option value="high">🔴 High Priority</option>
                    </select>
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                      className="p-2 border border-border rounded-lg bg-background text-foreground"
                    />
                  </div>
                  
                  {userRole === 'admin' && (
                    <select value={newTask.assigned_to} onChange={e => setNewTask({...newTask, assigned_to: e.target.value})} className="w-full p-2 border border-border rounded-lg bg-background text-foreground">
                      <option value="">Assign to...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                      ))}
                    </select>
                  )}
                  
                  <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 transition">
                    Create Task with Project Link 🚀
                  </button>
                </form>
              </div>

              {/* Tasks List */}
              <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">📋 Tasks ({filteredTasks.length})</h3>
                </div>
                
                {filteredTasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tasks found. Create your first task above!</p>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map(task => (
                      <div key={task.id} className="border border-border rounded-lg p-4 hover:shadow-md transition bg-background">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h4 className="font-semibold text-foreground">{task.title}</h4>
                              <span className={getPriorityBadge(task.priority)}>{task.priority}</span>
                              <span className={getStatusBadge(task.status)}>{task.status}</span>
                            </div>
                            
                            {task.description && (
                              <p className="text-muted-foreground text-sm mb-2">{task.description}</p>
                            )}
                            
                            {task.project_link && (
                              <a 
                                href={task.project_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-sm mb-2"
                              >
                                🔗 View Project Demo →
                              </a>
                            )}
                            
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              {task.due_date && <span>📅 Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                              {task.assigned_user_name && <span>👤 Assigned to: {task.assigned_user_name}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={task.status}
                              onChange={e => updateTaskStatus(task.id, e.target.value)}
                              className="text-sm border border-border rounded p-1 bg-background text-foreground"
                            >
                              <option value="pending">Pending</option>
                              <option value="in-progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                            {userRole === 'admin' && (
                              <button onClick={() => deleteTask(task.id)} className="text-destructive px-2">🗑️</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
                  <div className="text-3xl font-bold text-primary">{stats.totalTasks}</div>
                  <div className="text-muted-foreground">Total Tasks</div>
                </div>
                <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
                  <div className="text-3xl font-bold text-green-600">{stats.completedTasks}</div>
                  <div className="text-muted-foreground">Completed</div>
                </div>
                <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
                  <div className="text-3xl font-bold text-yellow-600">{stats.pendingTasks}</div>
                  <div className="text-muted-foreground">Pending</div>
                </div>
                <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
                  <div className="text-3xl font-bold text-purple-600">{Math.round(stats.completionRate)}%</div>
                  <div className="text-muted-foreground">Completion Rate</div>
                </div>
              </div>
              
              <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
                <h3 className="font-semibold mb-4 text-foreground">📊 Overall Progress</h3>
                <div className="w-full bg-muted rounded-full h-4">
                  <div 
                    className="bg-green-600 h-4 rounded-full transition-all"
                    style={{ width: `${stats.completionRate}%` }}
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {stats.completedTasks} of {stats.totalTasks} tasks completed
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
