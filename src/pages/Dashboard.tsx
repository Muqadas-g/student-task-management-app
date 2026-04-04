import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Task {
  id: number;
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
  const [userRole, setUserRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'analytics' | 'notifications'>('tasks');
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assigned_to: '',
    due_date: ''
  });
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Task Form with Project Link
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    project_link: '',
    priority: 'medium',
    due_date: '',
    assigned_to: ''
  });

  // Stats
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
        setUser(profile);
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
    if (data) setUsers(data);
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
      const tasksWithNames = data.map(task => ({
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
    
    const tasksByPriority = {
      low: tasksData.filter(t => t.priority === 'low').length,
      medium: tasksData.filter(t => t.priority === 'medium').length,
      high: tasksData.filter(t => t.priority === 'high').length
    };
    
    const tasksByStatus = {
      pending: pending,
      'in-progress': inProgress,
      completed: completed
    };
    
    setStats({
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      inProgressTasks: inProgress,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      tasksByPriority,
      tasksByStatus
    });
  };

  // CREATE Task with Project Link
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
        project_link: newTask.project_link || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        assigned_to: newTask.assigned_to || null,
        status: 'pending',
        user_id: user?.id
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

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
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

  const deleteTask = async (taskId: number) => {
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

  // Setup Realtime
  const setupRealtimeSubscriptions = () => {
    supabase
      .channel('tasks-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .subscribe();
  };

  // Filtered & Sorted Tasks
  const getFilteredAndSortedTasks = () => {
    let filtered = [...tasks];
    
    if (searchQuery) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filters.status) {
      filtered = filtered.filter(task => task.status === filters.status);
    }
    
    if (filters.priority) {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }
    
    if (userRole === 'admin' && filters.assigned_to) {
      filtered = filtered.filter(task => task.assigned_to === filters.assigned_to);
    }
    
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
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 0);
          break;
        case 'due_date':
          comparison = (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return `px-2 py-1 rounded-full text-xs ${colors[priority as keyof typeof colors] || colors.medium}`;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-100 text-green-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      pending: 'bg-yellow-100 text-yellow-700'
    };
    return `px-2 py-1 rounded-full text-xs ${colors[status as keyof typeof colors] || colors.pending}`;
  };

  const filteredTasks = getFilteredAndSortedTasks();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="flex h-screen">
        <div className="w-64 bg-white shadow-md fixed h-full">
          <div className="p-5 border-b">
            <h1 className="text-xl font-bold">📋 Team Task Manager</h1>
            <p className="text-sm text-gray-500 mt-1">
              {userRole === 'admin' ? '👑 Admin' : '👤 Member'}
            </p>
            <p className="text-xs text-gray-400 mt-1">{user?.email}</p>
          </div>
          
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`w-full text-left px-4 py-2 rounded-lg transition flex items-center gap-3 ${activeTab === 'tasks' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
            >
              📝 My Tasks
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full text-left px-4 py-2 rounded-lg transition flex items-center gap-3 ${activeTab === 'analytics' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
            >
              📊 Analytics
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="ml-64 flex-1 overflow-auto">
          {/* Header with Search */}
          <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {activeTab === 'tasks' && 'Task Manager'}
                {activeTab === 'analytics' && 'Analytics Dashboard'}
              </h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search tasks by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <>
                {/* Filters Bar */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                  <div className="flex flex-wrap gap-3 items-center">
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({...filters, status: e.target.value})}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    
                    <select
                      value={filters.priority}
                      onChange={(e) => setFilters({...filters, priority: e.target.value})}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    
                    <select
                      value={filters.due_date}
                      onChange={(e) => setFilters({...filters, due_date: e.target.value})}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Dates</option>
                      <option value="today">Due Today</option>
                      <option value="week">Due This Week</option>
                      <option value="overdue">Overdue</option>
                    </select>
                    
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="due_date">Sort by Due Date</option>
                      <option value="priority">Sort by Priority</option>
                      <option value="status">Sort by Status</option>
                    </select>
                    
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 border rounded-lg text-sm bg-gray-50"
                    >
                      {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                    </button>
                  </div>
                </div>

                {/* Create Task Form with Project Link */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="font-semibold mb-4">➕ Create New Task</h3>
                  <form onSubmit={createTask} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Task title *"
                      value={newTask.title}
                      onChange={e => setNewTask({...newTask, title: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                    
                    {/* 🔗 PROJECT LINK FIELD - NEW! */}
                    <input
                      type="url"
                      placeholder="🔗 Project Link (e.g., https://your-project.netlify.app)"
                      value={newTask.project_link}
                      onChange={e => setNewTask({...newTask, project_link: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 -mt-2">
                      Add your project's live demo link here
                    </p>
                    
                    <textarea
                      placeholder="Description (optional)"
                      value={newTask.description}
                      onChange={e => setNewTask({...newTask, description: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                      rows={2}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <select
                        value={newTask.priority}
                        onChange={e => setNewTask({...newTask, priority: e.target.value})}
                        className="p-2 border rounded-lg"
                      >
                        <option value="low">🟢 Low Priority</option>
                        <option value="medium">🟡 Medium Priority</option>
                        <option value="high">🔴 High Priority</option>
                      </select>
                      <input
                        type="date"
                        value={newTask.due_date}
                        onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                        className="p-2 border rounded-lg"
                      />
                    </div>
                    
                    {userRole === 'admin' && (
                      <select
                        value={newTask.assigned_to}
                        onChange={e => setNewTask({...newTask, assigned_to: e.target.value})}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="">Assign to...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                        ))}
                      </select>
                    )}
                    
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                      Create Task with Project Link 🚀
                    </button>
                  </form>
                </div>

                {/* Tasks List */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">📋 Tasks ({filteredTasks.length})</h3>
                  </div>
                  
                  {filteredTasks.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No tasks found. Create your first task above!</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredTasks.map(task => (
                        <div key={task.id} className="border rounded-lg p-4 hover:shadow-md transition">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <h4 className="font-semibold">{task.title}</h4>
                                <span className={getPriorityBadge(task.priority)}>{task.priority}</span>
                                <span className={getStatusBadge(task.status)}>{task.status}</span>
                              </div>
                              
                              {task.description && (
                                <p className="text-gray-600 text-sm mb-2">{task.description}</p>
                              )}
                              
                              {/* 🔗 PROJECT LINK DISPLAY - NEW! */}
                              {task.project_link && (
                                <a 
                                  href={task.project_link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mb-2"
                                >
                                  🔗 View Project Demo →
                                </a>
                              )}
                              
                              <div className="flex gap-4 text-xs text-gray-500">
                                {task.due_date && <span>📅 Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                                {task.assigned_user_name && <span>👤 Assigned to: {task.assigned_user_name}</span>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <select
                                value={task.status}
                                onChange={e => updateTaskStatus(task.id, e.target.value)}
                                className="text-sm border rounded p-1"
                              >
                                <option value="pending">Pending</option>
                                <option value="in-progress">In Progress</option>
                                <option value="completed">Completed</option>
                              </select>
                              {userRole === 'admin' && (
                                <button onClick={() => deleteTask(task.id)} className="text-red-600 px-2">🗑️</button>
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
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="text-3xl font-bold text-blue-600">{stats.totalTasks}</div>
                    <div className="text-gray-600">Total Tasks</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="text-3xl font-bold text-green-600">{stats.completedTasks}</div>
                    <div className="text-gray-600">Completed</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="text-3xl font-bold text-yellow-600">{stats.pendingTasks}</div>
                    <div className="text-gray-600">Pending</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="text-3xl font-bold text-purple-600">{Math.round(stats.completionRate)}%</div>
                    <div className="text-gray-600">Completion Rate</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="font-semibold mb-4">📊 Overall Progress</h3>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-green-600 h-4 rounded-full transition-all"
                      style={{ width: `${stats.completionRate}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-2">
                    {stats.completedTasks} of {stats.totalTasks} tasks completed
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
