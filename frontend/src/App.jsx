import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
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
import Devices from './components/Devices'
import SummaryReport from './components/SummaryReport'
import FullReport from './components/FullReport'
import ManageRoles from './components/ManageRoles'
import ManageSites from './components/ManageSites'
import ReportBuilder from './components/ReportBuilder'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [testingMode, setTestingMode] = useState(false);
  const [siteId, setSiteId] = useState(() => {
    const savedSite = localStorage.getItem('rfid-active-site')
    return savedSite === 'all-sites' || /^[a-f\d]{24}$/i.test(savedSite || '') ? savedSite : 'all-sites'
  });

  useEffect(() => {
    if (token) {
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(response => setUser(response.data))
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        })
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
    <Layout user={user} onLogout={handleLogout} testingMode={testingMode} onTestingModeChange={setTestingMode} siteId={siteId} onSiteChange={setSiteId}>
      <Routes>
        <Route path="/" element={<Dashboard siteId={siteId} />} />
        <Route path="/simulator" element={user?.role === 'ADMIN' && testingMode ? <Simulator /> : <Navigate to="/" />} />
        <Route path="/tags" element={<TagManagement />} />
        <Route path="/devices" element={user?.role === 'ADMIN' ? <Devices /> : <Navigate to="/" />} />
        <Route path="/summary-report" element={<SummaryReport siteId={siteId} />} />
        <Route path="/full-report" element={<FullReport siteId={siteId} />} />
        <Route path="/report-builder" element={user?.role === 'ADMIN' ? <ReportBuilder /> : <Navigate to="/" />} />
        <Route path="/manage-roles" element={user?.role === 'ADMIN' ? <ManageRoles /> : <Navigate to="/" />} />
        <Route path="/manage-sites" element={user?.role === 'ADMIN' ? <ManageSites /> : <Navigate to="/" />} />
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
