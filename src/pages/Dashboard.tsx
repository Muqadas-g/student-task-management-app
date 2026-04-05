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

interface Project {
  id: number;
  name: string;
  description: string;
  live_link: string;
  tech_stack: string[];
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
  // ========== STATE VARIABLES ==========
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects' | 'analytics'>('tasks');
  
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
  
  // Task Form
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    project_link: '',
    priority: 'medium',
    due_date: '',
    assigned_to: ''
  });
  
  // Project Form
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    live_link: '',
    tech_stack: ''
  });
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  
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

  // ========== AI SUGGESTION ==========
  const getAiDescriptionSuggestion = (projectName: string) => {
    const suggestions: { [key: string]: string } = {
      'portfolio': 'A personal portfolio website showcasing my skills, projects, and experience as a web developer.',
      'task manager': 'A task management application with CRUD operations, user authentication, and real-time updates.',
      'ecommerce': 'An e-commerce platform with product listing, cart functionality, and payment integration.',
      'blog': 'A full-featured blog platform with user authentication, comments, and markdown support.',
      'chat app': 'A real-time chat application using WebSockets for instant messaging.',
      'weather app': 'A weather application that fetches real-time weather data using external API.',
      'todo': 'A simple yet powerful todo list application with local storage persistence.',
      'calendar': 'An interactive calendar application for managing events and appointments.',
      'dashboard': 'An admin dashboard with analytics, charts, and data visualization.',
      'social media': 'A social media platform with posts, likes, comments, and user profiles.',
      'student task': 'A student task management system with assignment tracking and deadline reminders.',
      'cv generator': 'A dynamic CV generator that creates professional PDF resumes from user input.',
    };
    
    for (const [key, suggestion] of Object.entries(suggestions)) {
      if (projectName.toLowerCase().includes(key)) {
        return suggestion;
      }
    }
    return `A ${projectName} application built with modern web technologies.`;
  };

  const handleProjectNameChange = (name: string) => {
    setNewProject({ ...newProject, name });
    if (name.length > 3) {
      const suggestion = getAiDescriptionSuggestion(name);
      setAiSuggestion(suggestion);
      setShowAiSuggestion(true);
    } else {
      setShowAiSuggestion(false);
    }
  };

  const applyAiSuggestion = () => {
    setNewProject({ ...newProject, description: aiSuggestion });
    setShowAiSuggestion(false);
    toast.success('✨ AI suggestion applied!');
  };

  // ========== INITIALIZATION ==========
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
        setUser(profile as unknown as User);
        setUserRole(profile.role || 'member');
      }

      await loadAllUsers();
      await loadTasks();
      await loadProjects();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data as unknown as User[]);
  };

  // ========== TASKS CRUD ==========
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
        deadline: newTask.due_date || new Date().toISOString(),
        assigned_to: newTask.assigned_to || null,
        status: 'pending',
        user_id: user?.id
      }
    ]);

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Task created! 🎉');
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

  // ========== PROJECTS CRUD ==========
  const loadProjects = async () => {
    let query = supabase.from('projects' as any).select('*');
    if (userRole !== 'admin') {
      query = query.eq('user_id', user?.id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error) setProjects((data || []) as unknown as Project[]);
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    const techStackArray = newProject.tech_stack.split(',').map(t => t.trim()).filter(Boolean);
    
    const { error } = await supabase.from('projects' as any).insert([
      {
        name: newProject.name,
        description: newProject.description,
        live_link: newProject.live_link,
        tech_stack: techStackArray,
        user_id: user?.id
      }
    ] as any);

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Project added! 🚀');
      setNewProject({ name: '', description: '', live_link: '', tech_stack: '' });
      await loadProjects();
    }
  };

  const deleteProject = async (projectId: number) => {
    if (userRole !== 'admin') {
      toast.error('❌ Only Admin can delete projects!');
      return;
    }
    if (!confirm('Delete this project?')) return;
    
    const { error } = await supabase.from('projects' as any).delete().eq('id', projectId);
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Project deleted!');
      await loadProjects();
    }
  };

  // ========== REALTIME SUBSCRIPTIONS ==========
  const setupRealtimeSubscriptions = () => {
    supabase
      .channel('tasks-projects-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadProjects())
      .subscribe();
  };

  // ========== FILTERED & SORTED TASKS ==========
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
        case 'priority': {
          const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
          comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
          break;
        }
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

  // ========== RENDER HELPERS ==========
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen p-6 flex flex-col">
          <div className="mb-8">
            <h1 className="text-xl font-bold text-gray-800">📋 Team Task Manager</h1>
            <span className={`text-xs px-2 py-1 rounded-full mt-2 inline-block ${userRole === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
              {userRole === 'admin' ? '👑 Admin' : '👤 Member'}
            </span>
            <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
          </div>
          
          <nav className="space-y-2 flex-1">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`w-full text-left px-4 py-2 rounded-lg transition flex items-center gap-3 ${activeTab === 'tasks' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
            >
              📝 My Tasks
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full text-left px-4 py-2 rounded-lg transition flex items-center gap-3 ${activeTab === 'projects' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
            >
              🚀 Projects
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
        <div className="flex-1">
          {/* Header with Search */}
          <div className="bg-white shadow-sm p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">
                {activeTab === 'tasks' && 'Task Manager'}
                {activeTab === 'projects' && 'My Projects'}
                {activeTab === 'analytics' && 'Analytics Dashboard'}
              </h2>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="🔍 Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-64 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* ========== TASKS TAB ========== */}
            {activeTab === 'tasks' && (
              <>
                {/* Filters Bar */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={filters.status}
                      onChange={e => setFilters({...filters, status: e.target.value})}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    
                    <select
                      value={filters.priority}
                      onChange={e => setFilters({...filters, priority: e.target.value})}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    
                    <select
                      value={filters.due_date}
                      onChange={e => setFilters({...filters, due_date: e.target.value})}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Dates</option>
                      <option value="today">Due Today</option>
                      <option value="week">Due This Week</option>
                      <option value="overdue">Overdue</option>
                    </select>
                    
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
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

                {/* Create Task Form */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="font-semibold mb-4">➕ Create New Task</h3>
                  <form onSubmit={createTask} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Task Title *"
                      value={newTask.title}
                      onChange={e => setNewTask({...newTask, title: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                    
                    <input
                      type="url"
                      placeholder="🔗 Project Link (https://...)"
                      value={newTask.project_link}
                      onChange={e => setNewTask({...newTask, project_link: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-gray-50"
                    />
                    
                    <textarea
                      placeholder="Description"
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

            {/* ========== PROJECTS TAB ========== */}
            {activeTab === 'projects' && (
              <>
                {/* Create Project Form with AI Suggestion */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="font-semibold mb-4">🚀 Add Your Project</h3>
                  <form onSubmit={createProject} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Project Name *"
                      value={newProject.name}
                      onChange={e => handleProjectNameChange(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                    
                    {showAiSuggestion && (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-xs text-purple-600 font-semibold">✨ AI Suggested Description</span>
                            <p className="text-sm text-gray-700 mt-1">{aiSuggestion}</p>
                          </div>
                          <button type="button" onClick={applyAiSuggestion} className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                            Use
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <textarea
                      placeholder="Description"
                      value={newProject.description}
                      onChange={e => setNewProject({...newProject, description: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                      rows={2}
                    />
                    
                    <input
                      type="url"
                      placeholder="Live Demo Link (https://...)"
                      value={newProject.live_link}
                      onChange={e => setNewProject({...newProject, live_link: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                    />
                    
                    <input
                      type="text"
                      placeholder="Tech Stack (React, TypeScript, Tailwind, etc.)"
                      value={newProject.tech_stack}
                      onChange={e => setNewProject({...newProject, tech_stack: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                    />
                    
                    <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                      Add Project 🚀
                    </button>
                  </form>
                </div>

                {/* Projects Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
                      <p className="text-gray-500">No projects yet. Add your first project above!</p>
                    </div>
                  ) : (
                    projects.map(project => (
                      <div key={project.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                        <div className="p-5">
                          <h3 className="font-bold text-lg mb-2">{project.name}</h3>
                          <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                          {project.tech_stack && project.tech_stack.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {project.tech_stack.map((tech, i) => (
                                <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">{tech}</span>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-3">
                            {project.live_link ? (
                              <a href={project.live_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline inline-flex items-center gap-1">
                                🔗 Live Demo →
                              </a>
                            ) : (
                              <span className="text-gray-400 text-sm">No link added</span>
                            )}
                            {userRole === 'admin' && (
                              <button onClick={() => deleteProject(project.id)} className="text-red-600 text-sm">
                                🗑️ Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ========== ANALYTICS TAB ========== */}
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
                    <div className="bg-green-600 h-4 rounded-full transition-all" style={{ width: `${stats.completionRate}%` }} />
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-2">
                    {stats.completedTasks} of {stats.totalTasks} tasks completed
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="font-semibold mb-4">🎯 Tasks by Priority</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>🔴 High Priority</span>
                          <span>{stats.tasksByPriority.high}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-red-600 h-2 rounded-full" style={{ width: `${stats.totalTasks ? (stats.tasksByPriority.high / stats.totalTasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>🟡 Medium Priority</span>
                          <span>{stats.tasksByPriority.medium}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: `${stats.totalTasks ? (stats.tasksByPriority.medium / stats.totalTasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>🟢 Low Priority</span>
                          <span>{stats.tasksByPriority.low}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${stats.totalTasks ? (stats.tasksByPriority.low / stats.totalTasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="font-semibold mb-4">✅ Tasks by Status</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>✅ Completed</span>
                          <span>{stats.tasksByStatus.completed}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${stats.totalTasks ? (stats.tasksByStatus.completed / stats.totalTasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>🔄 In Progress</span>
                          <span>{stats.tasksByStatus['in-progress']}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${stats.totalTasks ? (stats.tasksByStatus['in-progress'] / stats.totalTasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>⏳ Pending</span>
                          <span>{stats.tasksByStatus.pending}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: `${stats.totalTasks ? (stats.tasksByStatus.pending / stats.totalTasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
