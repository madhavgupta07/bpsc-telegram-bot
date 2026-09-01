import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/questions', label: 'Questions' },
  { to: '/topics', label: 'Topics' },
  { to: '/quizzes', label: 'Daily Quizzes' },
  { to: '/users', label: 'Users' },
  { to: '/analytics', label: 'Analytics' },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          Bihar STET Quiz
          <span>Admin Dashboard</span>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <h1>Bihar STET Quiz</h1>
          <div className="user">
            <span>{admin?.username ?? 'Admin'}</span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: '0.75rem' }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
