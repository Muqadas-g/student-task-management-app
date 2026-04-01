import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const LoginPage: React.FC = () => {
  const { login } = useApp();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignup && name && email && password) {
      login({ name, email });
    } else if (!isSignup && email && password) {
      const savedName = localStorage.getItem('prodflow_signup_name') || 'Student';
      login({ name: savedName, email });
    }
    if (isSignup && name) {
      localStorage.setItem('prodflow_signup_name', name);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="fixed top-[30%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-secondary/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-scale-in relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-heading gradient-text mb-2">
            ProdFlow ✨
          </h1>
          <p className="text-muted-foreground">
            {isSignup ? 'Create your account & start crushing it 🚀' : 'Welcome back, let\'s get productive 💪'}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="animate-slide-up">
                <label className="text-sm font-medium text-foreground mb-1.5 block">Your Name</label>
                <Input
                  placeholder="e.g. Muqaddas"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary"
                  required
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary"
                required
              />
            </div>
            <Button type="submit" variant="gradient" size="lg" className="w-full mt-2">
              {isSignup ? 'Sign Up 🎉' : 'Log In →'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Built with 💜 for students who dream big
        </p>
      </div>
    </div>
  );
};
