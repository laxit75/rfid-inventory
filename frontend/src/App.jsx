import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Simulator from './components/Simulator'
import TagManagement from './components/TagManagement'
import TagHistory from './components/TagHistory'
import Settings from './components/Settings'
import Recipients from './components/Recipients'
import Users from './components/Users'
import AuditLog from './components/AuditLog'
import Layout from './components/Layout'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      // decode token to get user info (simple parse; production use proper decode)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.userId, username: payload.username, role: payload.role });
      } catch {
        localStorage.removeItem('token');
        setToken(null);
      }
    }
  }, [token]);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/tags" element={<TagManagement />} />
        <Route path="/tags/:tagId/history" element={<TagHistory />} />
        <Route path="/settings" element={user?.role === 'ADMIN' ? <Settings /> : <Navigate to="/" />} />
        <Route path="/recipients" element={user?.role === 'ADMIN' ? <Recipients /> : <Navigate to="/" />} />
        <Route path="/users" element={user?.role === 'ADMIN' ? <Users /> : <Navigate to="/" />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default App;