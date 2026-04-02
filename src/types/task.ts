export type TaskCategory = 'study' | 'work' | 'personal';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  deadline: string;
  completed: boolean;
  createdAt: string;
  user_id?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}
