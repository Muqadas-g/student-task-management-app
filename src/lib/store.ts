import { Task, User } from '@/types/task';

const TASKS_KEY = 'prodflow_tasks';
const USER_KEY = 'prodflow_user';

export const getTasks = (): Task[] => {
  const data = localStorage.getItem(TASKS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTasks = (tasks: Task[]) => {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
};

export const getUser = (): User | null => {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveUser = (user: User) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearUser = () => {
  localStorage.removeItem(USER_KEY);
};

export const quotes = [
  "You got this 💪",
  "Small steps, big results 🚀",
  "Stay focused, stay fierce 🔥",
  "Your future self will thank you ✨",
  "Discipline is the bridge to your goals 🌉",
  "Progress, not perfection 🌱",
  "Dream big, work hard 💫",
  "One task at a time 🎯",
];

export const getRandomQuote = () => quotes[Math.floor(Math.random() * quotes.length)];
