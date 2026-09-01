import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './hooks/useAuth';
import type { ReactNode } from 'react';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Questions from './pages/Questions';
import Topics from './pages/Topics';
import DailyQuizzes from './pages/DailyQuizzes';
import Users from './pages/Users';
import Analytics from './pages/Analytics';
import { Spinner } from './components/ui';

function Protected({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!admin) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <AdminLayout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/quizzes" element={<DailyQuizzes />} />
        <Route path="/users" element={<Users />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
