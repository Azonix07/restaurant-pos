import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const isNetworkError = !err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.message === 'Network Error');
      if (isNetworkError) {
        setError('Cannot reach server. Please wait for the server to start or check your connection.');
      } else {
        setError(err.response?.data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🍽️ Restaurant POS</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-demo">
          <p>Demo Accounts:</p>
          <div className="demo-accounts">
            <button onClick={() => { setEmail('admin@restaurant.com'); setPassword('admin123'); }}>Admin</button>
            <button onClick={() => { setEmail('manager@restaurant.com'); setPassword('manager123'); }}>Manager</button>
            <button onClick={() => { setEmail('cashier@restaurant.com'); setPassword('cashier123'); }}>Cashier</button>
            <button onClick={() => { setEmail('waiter1@restaurant.com'); setPassword('waiter123'); }}>Waiter</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
