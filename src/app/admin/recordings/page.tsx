'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminRecording } from '@/types/admin';
import { formatDate } from '@/lib/utils';
import { SearchIcon, FilterIcon, ChevronRightIcon, ArrowLeftIcon, PlayIcon, PauseIcon, DownloadIcon } from 'lucide-react';
import { AdminNotificationBadge } from '@/components/AdminNotificationBadge';
import { RECORDING_APPROVE_PRESETS, RECORDING_REJECT_PRESETS } from '@/lib/recording-feedback-presets';

export default function AdminRecordingsList() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<AdminRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/admin/recordings';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecordings(data.recordings || data);
      setStats(data.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });
    } catch (error) {
      console.error(error);
      // toast error
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // Auto-refresh every 30 seconds to pick up new submissions
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecordings();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchRecordings]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecordings(new Set(recordings.map(r => r.id)));
    } else {
      setSelectedRecordings(new Set());
    }
  };

  const handleSelectRecording = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRecordings);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRecordings(newSelected);
  };

  const handleQuickApprove = async (id: string, presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const preset = RECORDING_APPROVE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setRowActionId(id);
    try {
      const res = await fetch(`/api/admin/recordings/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: preset.points,
          feedback: preset.feedback,
          publish: preset.publish,
        }),
      });
      if (!res.ok) throw new Error('Approve failed');
      fetchRecordings();
    } catch {
      alert('Could not approve recording');
    } finally {
      setRowActionId(null);
    }
  };

  const handleQuickReject = async (id: string, presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const preset = RECORDING_REJECT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setRowActionId(id);
    try {
      const res = await fetch(`/api/admin/recordings/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: preset.feedback }),
      });
      if (!res.ok) throw new Error('Reject failed');
      fetchRecordings();
    } catch {
      alert('Could not reject recording');
    } finally {
      setRowActionId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRecordings.size === 0) return;
    if (!confirm(`Approve ${selectedRecordings.size} recording(s) and award default points?`)) return;

    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedRecordings).map(id =>
        fetch(`/api/admin/recordings/${id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: 10,
            feedback: 'Approved via bulk action',
            publish: true
          })
        })
      );

      await Promise.all(promises);
      alert(`${selectedRecordings.size} recording(s) approved successfully!`);
      setSelectedRecordings(new Set());
      fetchRecordings();
    } catch (error) {
      alert('Error approving recordings');
      console.error(error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const togglePlay = (rec: AdminRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rec.audio_url) return;

    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const newAudio = new Audio(rec.audio_url);
    newAudio.onended = () => setPlayingId(null);
    newAudio.onerror = () => setPlayingId(null);
    newAudio.play().then(() => setPlayingId(rec.id)).catch(() => setPlayingId(null));
    audioRef.current = newAudio;
  };

  const downloadRecording = async (rec: AdminRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rec.audio_url) return;
    try {
      const response = await fetch(rec.audio_url);
      const blob = await response.blob();
      const ext = rec.audio_path?.split('.').pop() || 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${rec.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Try opening the audio URL directly.');
    }
  };

  const handleBulkReject = async () => {
    if (selectedRecordings.size === 0) return;
    if (!confirm(`Reject ${selectedRecordings.size} recording(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedRecordings).map(id =>
        fetch(`/api/admin/recordings/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedback: 'Rejected via bulk action'
          })
        })
      );

      await Promise.all(promises);
      alert(`${selectedRecordings.size} recording(s) rejected successfully!`);
      setSelectedRecordings(new Set());
      fetchRecordings();
    } catch (error) {
      alert('Error rejecting recordings');
      console.error(error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-8">
            <button 
                onClick={() => router.push('/admin')}
                className="mr-4 p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition"
            >
                <ArrowLeftIcon size={20} className="text-gray-600" />
            </button>
            <div className="flex-1">
                <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
                  Story Recordings
                  <AdminNotificationBadge count={stats.pending} />
                </h1>
                <p className="text-gray-500 mt-1">Review queue — pending first, with quick approve/reject presets</p>
            </div>
            <button
              onClick={() => fetchRecordings()}
              className="ml-4 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
            >
              🔄 Refresh
            </button>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Recordings</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pending Review</div>
          </div>
          <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-200">
            <div className="text-2xl font-bold text-green-800">{stats.approved}</div>
            <div className="text-sm text-green-600">Approved</div>
          </div>
          <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-200">
            <div className="text-2xl font-bold text-red-800">{stats.rejected}</div>
            <div className="text-sm text-red-600">Rejected</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 items-center border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600">
            <FilterIcon size={18} />
            <span className="font-medium">Filter by:</span>
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-gray-300 rounded-lg text-sm focus:ring-islamic-primary focus:border-islamic-primary"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border-gray-300 rounded-lg text-sm focus:ring-islamic-primary focus:border-islamic-primary"
          >
            <option value="">All Categories</option>
            <option value="quran">Qur'an</option>
            <option value="nasheed">Nasheed</option>
            <option value="story">Story</option>
            <option value="hadith">Hadith</option>
          </select>

          <div className="ml-auto flex items-center bg-gray-100 rounded-lg px-3 py-2 w-full md:w-auto">
            <SearchIcon size={18} className="text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search students..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRecordings.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-blue-800">
                {selectedRecordings.size} recording{selectedRecordings.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBulkApprove}
                disabled={bulkActionLoading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {bulkActionLoading ? 'Processing...' : 'Approve All'}
              </button>
              <button
                onClick={handleBulkReject}
                disabled={bulkActionLoading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {bulkActionLoading ? 'Processing...' : 'Reject All'}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading recordings...</div>
          ) : recordings.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No recordings found matching your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-medium">
                  <tr>
                    <th className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRecordings.size === recordings.length && recordings.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-islamic-primary focus:ring-islamic-primary"
                      />
                    </th>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Story</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Submitted</th>
                    <th className="px-6 py-4">Audio</th>
                    <th className="px-6 py-4">Quick review</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recordings.map((rec) => (
                    (() => {
                      const durationSeconds = rec.duration ?? rec.duration_seconds ?? 0;
                      const submittedAt = rec.submitted_at || rec.created_at;
                      const category = rec.category || (rec.story_id ? 'story' : 'studio');
                      return (
                    <tr 
                      key={rec.id} 
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedRecordings.has(rec.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => router.push(`/admin/recordings/${rec.id}`)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRecordings.has(rec.id)}
                          onChange={(e) => handleSelectRecording(rec.id, e.target.checked)}
                          className="rounded border-gray-300 text-islamic-primary focus:ring-islamic-primary"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{rec.profile?.name || rec.child_name || 'Unknown User'}</div>
                        <div className="text-xs text-gray-400">{rec.profile?.email || rec.user_id?.substring(0, 8) || 'Guest'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-gray-600">{category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {rec.story?.title || rec.title || <span className="text-islamic-primary italic">Studio Recording</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {Math.floor(durationSeconds / 60)}:{(durationSeconds % 60).toString().padStart(2, '0')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(rec.status)} capitalize`}>
                          {rec.status === 'submitted' ? 'Pending' : rec.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formatDate(submittedAt)}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {rec.audio_url && (
                            <button
                              onClick={(e) => togglePlay(rec, e)}
                              title={playingId === rec.id ? 'Pause' : 'Play'}
                              className="w-8 h-8 rounded-full bg-islamic-primary text-white flex items-center justify-center hover:bg-islamic-primary/80 transition"
                            >
                              {playingId === rec.id
                                ? <PauseIcon size={14} fill="currentColor" />
                                : <PlayIcon size={14} fill="currentColor" className="ml-0.5" />}
                            </button>
                          )}
                          {rec.audio_url && (
                            <button
                              onClick={(e) => downloadRecording(rec, e)}
                              title="Download"
                              className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-300 transition"
                            >
                              <DownloadIcon size={14} />
                            </button>
                          )}
                          {!rec.audio_url && (
                            <span className="text-xs text-gray-400">No audio</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {rec.status === 'submitted' ? (
                          <div className="flex min-w-[220px] flex-col gap-1">
                            <select
                              defaultValue=""
                              disabled={rowActionId === rec.id}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (!value) return;
                                handleQuickApprove(rec.id, value, e as unknown as React.MouseEvent);
                                e.target.value = '';
                              }}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"
                            >
                              <option value="">Approve…</option>
                              {RECORDING_APPROVE_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </select>
                            <select
                              defaultValue=""
                              disabled={rowActionId === rec.id}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (!value) return;
                                handleQuickReject(rec.id, value, e as unknown as React.MouseEvent);
                                e.target.value = '';
                              }}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800"
                            >
                              <option value="">Reject…</option>
                              {RECORDING_REJECT_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Reviewed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-400">
                        <ChevronRightIcon size={18} />
                      </td>
                    </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
