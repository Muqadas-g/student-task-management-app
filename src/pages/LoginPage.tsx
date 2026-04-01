import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Supabase Client
const supabase = createClient(
  'https://zubaamlvllwygvcxekcg.supabase.co',
  'sb_publishable_Ny7aPjas-0-3WG1rBAr7cQ_gSQpdW0t'
);

export const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Get current user on page load
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    
    if (user) {
      await loadProjects(user.id);
      await loadTasks(user.id);
    }
    setLoading(false);
  };

  // Load projects from database
  const loadProjects = async (userId: string) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading projects:', error);
    } else {
      setProjects(data || []);
    }
  };

  // Load tasks from database
  const loadTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading tasks:', error);
    } else {
      setTasks(data || []);
    }
  };

  // Add new project
  const addProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    
    if (!user) {
      toast.error('Please login first');
      return;
    }
    
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: newProjectName.trim(),
        user_id: user.id
      }])
      .select();
    
    if (error) {
      toast.error('Error adding project: ' + error.message);
    } else {
      toast.success('Project added! 🎉');
      setProjects([data[0], ...projects]);
      setNewProjectName('');
    }
  };

  // Add new task
  const addTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    
    if (!user) {
      toast.error('Please login first');
      return;
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title: newTaskTitle.trim(),
        status: 'pending',
        user_id: user.id
      }])
      .select();
    
    if (error) {
      toast.error('Error adding task: ' + error.message);
    } else {
      toast.success('Task added! ✅');
      setTasks([data[0], ...tasks]);
      setNewTaskTitle('');
    }
  };

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);
    
    if (error) {
      toast.error('Error updating task');
    } else {
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      toast.success('Task updated!');
    }
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) {
      toast.error('Error deleting task');
    } else {
      setTasks(tasks.filter(task => task.id !== taskId));
      toast.success('Task deleted!');
    }
  };

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out!');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold gradient-text">ProdFlow ✨</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user.email}</span>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4 grid md:grid-cols-2 gap-6">
        
        {/* Projects Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">📁 Your Projects</h2>
          
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addProject()}
              className="flex-1"
            />
            <Button onClick={addProject} variant="gradient">
              Add
            </Button>
          </div>
          
          <div className="space-y-2">
            {projects.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No projects yet. Add one above!</p>
            ) : (
              projects.map(project => (
                <div key={project.id} className="p-3 bg-gray-50 rounded-lg border">
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">✅ Your Tasks</h2>
          
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Task title..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
              className="flex-1"
            />
            <Button onClick={addTask} variant="gradient">
              Add
            </Button>
          </div>
          
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No tasks yet. Add one above!</p>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{task.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(task.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={task.status || 'pending'}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="text-sm border rounded p-1 bg-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <Button
                        onClick={() => deleteTask(task.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
