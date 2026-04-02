import { useApp } from '@/context/AppContext';
import { LoginPage } from '@/pages/LoginPage';
import { Dashboard } from '@/pages/Dashboard';

const Index = () => {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <h1 className="text-3xl font-bold font-heading gradient-text">ProdFlow ✨</h1>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginPage />;
};

export default Index;
