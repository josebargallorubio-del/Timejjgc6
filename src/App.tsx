import { useState, useEffect } from 'react';
import { User } from './types';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import WorkerDashboard from './components/WorkerDashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img 
            src="https://page.kidsandus.es/hs-fs/hubfs/logo%20kids%20letras%20my%20negro.png?width=225&height=77&name=logo%20kids%20letras%20my%20negro.png" 
            alt="Kids&Us Logo" 
            className="h-8"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-800 ml-2 border-l border-neutral-300 pl-4">
            Valls
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-neutral-500">
            {user.name} ({user.role})
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {user.role === 'admin' ? (
          <AdminDashboard user={user} />
        ) : (
          <WorkerDashboard user={user} />
        )}
      </main>
    </div>
  );
}
