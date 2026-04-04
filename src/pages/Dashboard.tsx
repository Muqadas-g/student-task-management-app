import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  assigned_to: string;
  assigned_user_name?: string;
  user_id: string;
  created_at: string;
  comments: Comment[];
}

interface Comment {
  id: number;
  task_id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

interface Message {
  id: number;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Notification {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string;
}

export const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'analytics' | 'notifications'>('tasks');

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assigned_to: '',
    department: '',
    due_date: ''
  });
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [chatUsers, setChatUsers] = useState<UserProfile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
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
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks(userRole, user.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadNotifications(user.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (selectedUser) loadMessages(selectedUser);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user, userRole, selectedUser]);

  const getUserAndRole = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { window.location.href = '/'; return; }

      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (profile) {
        setUser(profile as UserProfile);
        setUserRole(profile.role || 'member');
      }

      await loadAllUsers();
      await loadTasks(profile?.role || 'member', authUser.id);
      await loadNotifications(authUser.id);
      await loadChatUsers();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data as UserProfile[]);
  };

  const loadChatUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setChatUsers(data as UserProfile[]);
  };

  const loadTasks = async (role: string, userId: string) => {
    let query = supabase.from('tasks').select('*');
    if (role !== 'admin') {
      query = query.or(`user_id.eq.${userId},assigned_to.eq.${userId}`);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      const mapped = (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        status: t.status || 'pending',
        priority: t.priority || 'medium',
        due_date: t.due_date,
        assigned_to: t.assigned_to || '',
        assigned_user_name: '',
        user_id: t.user_id,
        created_at: t.created_at,
        comments: [],
      }));
      // Resolve assigned user names
      mapped.forEach((task: Task) => {
        if (task.assigned_to) {
          const assignedUser = users.find(u => u.id === task.assigned_to);
          task.assigned_user_name = assignedUser?.full_name || assignedUser?.email || 'Unassigned';
        } else {
          task.assigned_user_name = 'Unassigned';
        }
      });
      setTasks(mapped);
      calculateStats(mapped);
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
        high: tasksData.filter(t => t.priority === 'high').length,
      },
      tasksByStatus: { pending, 'in-progress': inProgress, completed },
    });
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) { toast.error('Task title is required'); return; }

    const { error } = await supabase.from('tasks').insert([{
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      due_date: newTask.due_date || null,
      assigned_to: newTask.assigned_to || null,
      status: 'pending',
      user_id: user?.id,
      deadline: newTask.due_date || new Date().toISOString(),
    }]);

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Task created! 🎉');
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' });
      await loadTasks(userRole, user?.id || '');
      await addNotification(user?.id || '', 'New Task Created', `Task "${newTask.title}" has been created`, 'task');
      if (newTask.assigned_to) {
        await addNotification(newTask.assigned_to, 'Task Assigned', `New task "${newTask.title}" assigned to you`, 'assignment');
      }
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const task = tasks.find(t => t.id === taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Task updated!');
      await loadTasks(userRole, user?.id || '');
      if (task?.assigned_to) {
        await addNotification(task.assigned_to, 'Task Status Updated', `Task "${task.title}" status changed to ${newStatus}`, 'update');
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    if (userRole !== 'admin') { toast.error('❌ Only Admin can delete tasks!'); return; }
    if (!confirm('Delete this task?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { toast.error('Error: ' + error.message); } else { toast.success('Task deleted!'); await loadTasks(userRole, user?.id || ''); }
  };

  // Notifications
  const addNotification = async (userId: string, title: string, message: string, type: string) => {
    await supabase.from('notifications').insert([{ user_id: userId, title, message, type, is_read: false }]);
    if (userId === user?.id) await loadNotifications(user?.id || '');
  };

  const loadNotifications = async (userId: string) => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) { setNotifications(data as Notification[]); setUnreadCount(data.filter((n: any) => !n.is_read).length); }
  };

  const markNotificationAsRead = async (notificationId: number) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    await loadNotifications(user?.id || '');
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
    await loadNotifications(user?.id || '');
    toast.success('All notifications marked as read');
  };

  // Chat
  const loadMessages = async (otherUserId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data as Message[]);
      await supabase.from('messages').update({ is_read: true }).eq('sender_id', otherUserId).eq('receiver_id', user?.id);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    const { error } = await supabase.from('messages').insert([{
      sender_id: user?.id,
      sender_name: user?.full_name || user?.email || '',
      receiver_id: selectedUser,
      message: newMessage,
      is_read: false,
    }]);
    if (error) { toast.error('Error sending message'); } else {
      setNewMessage('');
      await loadMessages(selectedUser);
      await addNotification(selectedUser, 'New Message', `${user?.full_name || user?.email} sent you a message`, 'chat');
    }
  };

  // Comments
  const loadComments = async (taskId: string) => {
    const { data } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
    if (data && selectedTask) { setSelectedTask({ ...selectedTask, comments: data as Comment[] }); }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    const { error } = await supabase.from('task_comments').insert([{
      task_id: selectedTask.id,
      user_id: user?.id,
      user_name: user?.full_name || user?.email || '',
      message: newComment,
    }]);
    if (error) { toast.error('Error adding comment'); } else {
      setNewComment('');
      await loadComments(selectedTask.id);
      if (selectedTask.assigned_to && selectedTask.assigned_to !== user?.id) {
        await addNotification(selectedTask.assigned_to, 'New Comment', `${user?.full_name} commented on task "${selectedTask.title}"`, 'comment');
      }
    }
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
    if (filters.status) filtered = filtered.filter(task => task.status === filters.status);
    if (filters.priority) filtered = filtered.filter(task => task.priority === filters.priority);
    if (userRole === 'admin' && filters.assigned_to) filtered = filtered.filter(task => task.assigned_to === filters.assigned_to);
    if (userRole === 'admin' && filters.department && filters.department !== 'all') {
      filtered = filtered.filter(task => {
        const assignedUser = users.find(u => u.id === task.assigned_to);
        return assignedUser?.department === filters.department;
      });
    }
    if (filters.due_date) {
      const today = new Date().toISOString().split('T')[0];
      if (filters.due_date === 'today') filtered = filtered.filter(task => task.due_date === today);
      else if (filters.due_date === 'week') {
        const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
        filtered = filtered.filter(task => task.due_date && task.due_date <= nextWeek.toISOString().split('T')[0]);
      } else if (filters.due_date === 'overdue') {
        filtered = filtered.filter(task => task.due_date && task.due_date < today && task.status !== 'completed');
      }
    }
    filtered.sort((a, b) => {
      let comparison = 0;
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      switch (sortBy) {
        case 'priority': comparison = (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 0); break;
        case 'due_date': comparison = (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'); break;
        case 'status': comparison = (a.status || '').localeCompare(b.status || ''); break;
        case 'assigned_user': comparison = (a.assigned_user_name || '').localeCompare(b.assigned_user_name || ''); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return filtered;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-destructive/15 text-destructive',
      medium: 'bg-accent/15 text-accent-foreground',
      low: 'bg-primary/15 text-primary',
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || 'bg-muted text-muted-foreground'}`;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-primary/15 text-primary',
      'in-progress': 'bg-accent/15 text-accent-foreground',
      pending: 'bg-secondary/50 text-secondary-foreground',
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-muted text-muted-foreground'}`;
  };

  const filteredTasks = getFilteredAndSortedTasks();

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
    <div className="min-h-screen gradient-bg flex">
      {/* Sidebar */}
      <div className="w-64 glass-card border-r border-border/30 flex flex-col min-h-screen">
        <div className="p-4 border-b border-border/30">
          <h1 className="text-lg font-bold font-heading gradient-text">📋 Team Task Manager</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
            {userRole === 'admin' ? '👑 Admin' : '👤 Member'}
          </span>
          <p className="text-xs text-muted-foreground mt-1 truncate">{user?.email}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button onClick={() => setActiveTab('tasks')}
            className={`w-full text-left px-4 py-2 rounded-xl transition flex items-center gap-3 text-sm ${activeTab === 'tasks' ? 'bg-primary/15 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}>
            📝 My Tasks
          </button>
          <button onClick={() => setActiveTab('chat')}
            className={`w-full text-left px-4 py-2 rounded-xl transition flex items-center gap-3 text-sm ${activeTab === 'chat' ? 'bg-primary/15 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}>
            💬 Team Chat
          </button>
          <button onClick={() => setActiveTab('analytics')}
            className={`w-full text-left px-4 py-2 rounded-xl transition flex items-center gap-3 text-sm ${activeTab === 'analytics' ? 'bg-primary/15 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}>
            📊 Analytics
          </button>
          <button onClick={() => setActiveTab('notifications')}
            className={`w-full text-left px-4 py-2 rounded-xl transition flex items-center gap-3 text-sm ${activeTab === 'notifications' ? 'bg-primary/15 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}>
            🔔 Notifications
            {unreadCount > 0 && <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>}
          </button>
        </nav>

        <div className="p-3 border-t border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-xs text-muted-foreground truncate">{user?.full_name || user?.email}</span>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
            className="w-full text-sm text-destructive hover:text-destructive/80 transition-colors text-left px-2"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="glass-card border-b border-border/30 p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-heading text-foreground">
              {activeTab === 'tasks' && 'Task Manager'}
              {activeTab === 'chat' && 'Team Chat'}
              {activeTab === 'analytics' && 'Analytics Dashboard'}
              {activeTab === 'notifications' && 'Notifications'}
            </h2>
            <input
              type="text"
              placeholder="🔍 Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-64 px-4 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            <>
              {/* Filters */}
              <div className="glass-card rounded-2xl p-4 mb-6">
                <div className="flex flex-wrap gap-3">
                  <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })} className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  {userRole === 'admin' && (
                    <>
                      <select value={filters.assigned_to} onChange={e => setFilters({ ...filters, assigned_to: e.target.value })} className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary">
                        <option value="">All Members</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                      </select>
                      <select value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })} className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary">
                        <option value="">All Departments</option>
                        <option value="Web Development">Web Development</option>
                        <option value="Design">Design</option>
                        <option value="Marketing">Marketing</option>
                      </select>
                    </>
                  )}
                  <select value={filters.due_date} onChange={e => setFilters({ ...filters, due_date: e.target.value })} className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="">All Dates</option>
                    <option value="today">Due Today</option>
                    <option value="week">Due This Week</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="due_date">Sort by Due Date</option>
                    <option value="priority">Sort by Priority</option>
                    <option value="status">Sort by Status</option>
                    {userRole === 'admin' && <option value="assigned_user">Sort by Member</option>}
                  </select>
                  <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm">
                    {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                  </button>
                </div>
              </div>

              {/* Create Task */}
              <div className="glass-card rounded-2xl p-6 mb-6 animate-scale-in">
                <h2 className="text-lg font-semibold font-heading text-foreground mb-4">➕ Create New Task</h2>
                <form onSubmit={createTask} className="space-y-4">
                  <input type="text" placeholder="Task title..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all" required />
                  <textarea placeholder="Description (optional)" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all" rows={2} />
                  <div className="grid grid-cols-2 gap-4">
                    <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} className="p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary">
                      <option value="low">🟢 Low Priority</option>
                      <option value="medium">🟡 Medium Priority</option>
                      <option value="high">🔴 High Priority</option>
                    </select>
                    <input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} className="p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  {userRole === 'admin' && (
                    <select value={newTask.assigned_to} onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })} className="w-full p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Assign to...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                    </select>
                  )}
                  <button type="submit" className="w-full gradient-btn py-3 rounded-xl font-medium transition-all hover:scale-[1.01]">Create Task</button>
                </form>
              </div>

              {/* Tasks List */}
              <div className="glass-card rounded-2xl p-6 animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold font-heading text-foreground">📋 Tasks ({filteredTasks.length})</h3>
                </div>
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-2">📭</p>
                    <p className="text-muted-foreground">No tasks found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map(task => (
                      <div key={task.id} className="glass-card rounded-xl p-4 hover:shadow-lg transition-all duration-300 animate-slide-up">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h4 className="font-semibold font-heading text-foreground">{task.title}</h4>
                              <span className={getPriorityBadge(task.priority)}>{task.priority}</span>
                              <span className={getStatusBadge(task.status)}>{task.status}</span>
                            </div>
                            {task.description && <p className="text-sm text-muted-foreground mb-2">{task.description}</p>}
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              {task.due_date && <span>📅 Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                              {task.assigned_user_name && task.assigned_user_name !== 'Unassigned' && <span>👤 Assigned to: {task.assigned_user_name}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <select value={task.status} onChange={e => updateTaskStatus(task.id, e.target.value)}
                              className="text-sm border border-border/50 rounded-lg p-1 bg-background text-foreground outline-none focus:ring-2 focus:ring-primary">
                              <option value="pending">Pending</option>
                              <option value="in-progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                            {userRole === 'admin' && (
                              <button onClick={() => deleteTask(task.id)} className="text-destructive hover:text-destructive/80 px-2 transition-colors" title="Delete Task">🗑️</button>
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

          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex h-[600px]">
                <div className="w-72 border-r border-border/30 bg-muted/20">
                  <div className="p-4 border-b border-border/30">
                    <h3 className="font-semibold font-heading text-foreground">Team Members</h3>
                  </div>
                  <div className="overflow-y-auto h-full">
                    {chatUsers.filter(u => u.id !== user?.id).map(u => (
                      <button key={u.id} onClick={() => { setSelectedUser(u.id); loadMessages(u.id); }}
                        className={`w-full text-left p-4 hover:bg-muted/50 transition border-b border-border/20 ${selectedUser === u.id ? 'bg-primary/10' : ''}`}>
                        <div className="font-medium text-foreground text-sm">{u.full_name || u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.role === 'admin' ? '👑 Admin' : '👤 Member'}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  {selectedUser ? (
                    <>
                      <div className="p-4 border-b border-border/30 bg-muted/20">
                        <h3 className="font-semibold text-foreground">Chat with {chatUsers.find(u => u.id === selectedUser)?.full_name || 'Team Member'}</h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map(msg => (
                          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] p-3 rounded-2xl ${msg.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                              <p className="text-sm">{msg.message}</p>
                              <p className="text-xs opacity-70 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className="p-4 border-t border-border/30">
                        <div className="flex gap-2">
                          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..."
                            className="flex-1 p-3 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none" />
                          <button onClick={sendMessage} className="gradient-btn px-6 py-3 rounded-xl font-medium">Send</button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a team member to start chatting</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-2xl p-6"><div className="text-3xl font-bold text-primary">{stats.totalTasks}</div><div className="text-muted-foreground text-sm">Total Tasks</div></div>
                <div className="glass-card rounded-2xl p-6"><div className="text-3xl font-bold text-primary">{stats.completedTasks}</div><div className="text-muted-foreground text-sm">Completed</div></div>
                <div className="glass-card rounded-2xl p-6"><div className="text-3xl font-bold text-accent-foreground">{stats.pendingTasks}</div><div className="text-muted-foreground text-sm">Pending</div></div>
                <div className="glass-card rounded-2xl p-6"><div className="text-3xl font-bold text-primary">{Math.round(stats.completionRate)}%</div><div className="text-muted-foreground text-sm">Completion Rate</div></div>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-semibold font-heading text-foreground mb-4">📊 Overall Progress</h3>
                <div className="w-full bg-muted rounded-full h-4">
                  <div className="bg-primary h-4 rounded-full transition-all" style={{ width: `${stats.completionRate}%` }} />
                </div>
                <p className="text-center text-sm text-muted-foreground mt-2">{stats.completedTasks} of {stats.totalTasks} tasks completed</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="font-semibold font-heading text-foreground mb-4">🎯 Tasks by Priority</h3>
                  <div className="space-y-3">
                    {(['high', 'medium', 'low'] as const).map(p => (
                      <div key={p}>
                        <div className="flex justify-between text-sm mb-1 text-foreground"><span>{p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢'} {p} Priority</span><span>{stats.tasksByPriority[p]}</span></div>
                        <div className="w-full bg-muted rounded-full h-2"><div className={`h-2 rounded-full ${p === 'high' ? 'bg-destructive' : p === 'medium' ? 'bg-accent-foreground' : 'bg-primary'}`} style={{ width: `${stats.totalTasks ? (stats.tasksByPriority[p] / stats.totalTasks) * 100 : 0}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="font-semibold font-heading text-foreground mb-4">✅ Tasks by Status</h3>
                  <div className="space-y-3">
                    {([{ key: 'completed', label: '✅ Completed' }, { key: 'in-progress', label: '🔄 In Progress' }, { key: 'pending', label: '⏳ Pending' }] as const).map(s => (
                      <div key={s.key}>
                        <div className="flex justify-between text-sm mb-1 text-foreground"><span>{s.label}</span><span>{stats.tasksByStatus[s.key]}</span></div>
                        <div className="w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${stats.totalTasks ? (stats.tasksByStatus[s.key] / stats.totalTasks) * 100 : 0}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-semibold font-heading text-foreground mb-4">📈 Performance Insights</h3>
                {stats.completionRate >= 80 ? <p className="text-primary">🎉 Excellent! Your team is performing great!</p>
                  : stats.completionRate >= 50 ? <p className="text-accent-foreground">👍 Good progress! Keep pushing!</p>
                  : <p className="text-primary">💪 Keep working! Every task completed is a step forward.</p>}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold font-heading text-foreground">🔔 Notifications</h3>
                {notifications.some(n => !n.is_read) && (
                  <button onClick={markAllAsRead} className="text-sm text-primary hover:underline">Mark all as read</button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-4xl mb-2">🔕</p>
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map(notif => (
                    <div key={notif.id} onClick={() => markNotificationAsRead(notif.id)}
                      className={`p-4 rounded-xl cursor-pointer transition-all ${!notif.is_read ? 'bg-primary/10 border border-primary/30' : 'glass-card hover:shadow-md'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-foreground">{notif.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                          <p className="text-xs text-muted-foreground/70 mt-2">{new Date(notif.created_at).toLocaleString()}</p>
                        </div>
                        {!notif.is_read && <div className="w-2 h-2 bg-primary rounded-full" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
