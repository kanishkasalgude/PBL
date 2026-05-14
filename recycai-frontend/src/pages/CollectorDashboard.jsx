import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RefreshCw, Radio, CheckCircle2, Package, TrendingUp, Clock } from 'lucide-react';
import StatCard from '../components/StatCard';
import PickupCard from '../components/PickupCard';
import logo from '../assets/logo.png';

const API = 'http://localhost:5000';
const POLL_INTERVAL = 10000;

const CollectorDashboard = ({ user }) => {
  const [allPickups, setAllPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [weightInputs, setWeightInputs] = useState({});   // { pickupId: value }
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');   // 'pending' | 'accepted' | 'completed'

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchPickups = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API}/pickups`);
      setAllPickups(res.data);
      setLastRefresh(new Date());
      setError('');
    } catch {
      setError('Failed to load pickup requests.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPickups();
    const iv = setInterval(() => fetchPickups(true), POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchPickups]);

  // ── Accept → persists to DB ──────────────────────────────────────
  const handleAccept = async (id) => {
    setIsUpdating(true);
    try {
      await axios.post(`${API}/pickup/accept`, { pickupId: id });
      setSuccessMsg('Pickup accepted! Enter the weight to complete it.');
      fetchPickups(true);
      setActiveTab('accepted');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setError('Failed to accept pickup. Try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Confirm with weight ──────────────────────────────────────────
  const handleConfirm = async (id) => {
    const weight = parseFloat(weightInputs[id]);
    if (!weight || weight <= 0) return;

    setIsUpdating(true);
    try {
      const resp = await axios.post(`${API}/pickup/confirm`, { pickupId: id, weight });
      setSuccessMsg(`Pickup completed! ${resp.data.creditsGenerated} green credits awarded. 🌿`);
      setWeightInputs(prev => { const n = { ...prev }; delete n[id]; return n; });
      fetchPickups(true);
      setActiveTab('completed');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch {
      setError('Failed to confirm pickup.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Filtered queues ──────────────────────────────────────────────
  const pendingPickups   = allPickups.filter(p => p.status === 'requested' || p.status === 'pending');
  const acceptedPickups  = allPickups.filter(p => p.status === 'accepted');
  const completedPickups = allPickups.filter(p => p.status === 'completed');
  const totalWaste       = completedPickups.reduce((s, p) => s + (p.weight || 0), 0);

  const tabPickups = {
    pending:   pendingPickups,
    accepted:  acceptedPickups,
    completed: completedPickups,
  }[activeTab] || [];

  // Sort accepted first within their tab, then by date
  const sorted = [...tabPickups].sort((a, b) => {
    const ts = p => p.createdAt?._seconds ? p.createdAt._seconds * 1000 : new Date(p.date).getTime();
    return ts(b) - ts(a);
  });

  const TABS = [
    { key: 'pending',   label: 'Pending',   count: pendingPickups.length,   color: 'text-amber-700',   dot: 'bg-amber-400' },
    { key: 'accepted',  label: 'Accepted',  count: acceptedPickups.length,  color: 'text-blue-700',    dot: 'bg-blue-500'  },
    { key: 'completed', label: 'Completed', count: completedPickups.length, color: 'text-emerald-700', dot: 'bg-emerald-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <img src={logo} alt="EcoLoop Logo" className="h-12 w-auto drop-shadow-sm" />
          <div>
            <h1 className="text-3xl font-black text-gray-800">EcoLoop Collector Panel</h1>
            <p className="text-gray-500 font-medium">Manage recycling requests in real-time</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {lastRefresh && (
            <div className="hidden sm:flex items-center space-x-2 text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
              <Radio className="w-4 h-4 text-green-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest">Live Sync</span>
            </div>
          )}
          <button
            onClick={() => fetchPickups(false)}
            className="p-3 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors shadow-sm text-green-700"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast messages */}
      {successMsg && (
        <div className="bg-emerald-100 text-emerald-800 border border-emerald-200 p-4 rounded-xl mb-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6" />
            <p className="font-bold">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg('')} className="font-bold text-emerald-600 hover:text-emerald-800 text-sm">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 border border-red-100 font-bold text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Pending Requests"
          value={pendingPickups.length}
          subtitle="Awaiting acceptance"
          icon={<Package className="w-6 h-6" />}
          highlight={pendingPickups.length > 0}
        />
        <StatCard
          title="In Progress"
          value={acceptedPickups.length}
          subtitle="Accepted by you"
          icon={<Clock className="w-6 h-6" />}
          highlight={acceptedPickups.length > 0}
        />
        <StatCard
          title="Total Waste Collected"
          value={`${totalWaste.toFixed(1)} kg`}
          subtitle="Diverted from landfill"
          icon={<TrendingUp className="w-6 h-6" />}
          highlight={true}
        />
      </div>

      {/* 3-Tab Queue */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
        <h2 className="text-xl font-bold text-gray-800">Pickup Queue</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-5 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-white shadow-sm ' + tab.color
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`${tab.dot} text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 font-bold animate-pulse">Loading pickups…</div>
      ) : sorted.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map(pickup => (
            <PickupCard
              key={pickup.id || pickup._id}
              pickup={pickup}
              userRole="recycling collector"
              onAccept={handleAccept}
              onConfirm={handleConfirm}
              weightInput={weightInputs[pickup.id || pickup._id] || ''}
              setWeightInput={(val) =>
                setWeightInputs(prev => ({ ...prev, [pickup.id || pickup._id]: val }))
              }
              isUpdating={isUpdating}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-green-200">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            No {activeTab} pickups right now.
          </p>
          {activeTab === 'pending' && (
            <p className="text-gray-400 text-sm mt-1">New requests will appear here automatically.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CollectorDashboard;
