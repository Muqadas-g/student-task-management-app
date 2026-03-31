import { quotes } from '@/lib/constants';

export { quotes };

export const getRandomQuote = () => quotes[Math.floor(Math.random() * quotes.length)];
