import { useApp } from '@/context/AppContext';
import { LoginPage } from '@/pages/LoginPage';
import { Dashboard } from '@/pages/Dashboard';

const Index = () => {
  const { user } = useApp();
  return user ? <Dashboard /> : <LoginPage />;
};

export default Index;
