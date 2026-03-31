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
