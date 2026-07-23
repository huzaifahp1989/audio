'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { trackQuranRecordingSubmitted } from '@/lib/analytics';

type Category = 'quran' | 'nasheed' | 'story' | 'hadith';

type StudioState = 'idle' | 'recording' | 'paused' | 'finished';

export default function StudioPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState('');
  const [childName, setChildName] = useState('');
  const [message, setMessage] = useState('');
  const [studioState, setStudioState] = useState<StudioState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [recordingQuality, setRecordingQuality] = useState<{
    duration: number;
    averageVolume: number;
    hasGoodQuality: boolean;
  } | null>(null);

  useEffect(() => {
    if (profile?.name) {
      setChildName(profile.name);
    }
  }, [profile?.name]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const studioStateRef = useRef<StudioState>('idle');
  const assemblingRef = useRef(false);

  useEffect(() => {
    studioStateRef.current = studioState;
  }, [studioState]);

  useEffect(() => {
    elapsedMsRef.current = elapsedMs;
  }, [elapsedMs]);

  const resetRecording = () => {
    assemblingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    chunksRef.current = [];
    lastBlobRef.current = null;
    setAudioUrl(null);
    setStudioState('idle');
    setElapsedMs(0);
    elapsedMsRef.current = 0;
    setLevel(0);
    setRecordingQuality(null);
  };

  const setupAnalyser = (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
  };

  const startLevelMeter = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        const value = dataArray[i] - 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalized = Math.min(1, rms / 40);
      setLevel(normalized);
      if (studioStateRef.current === 'recording') {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  };

  const startTimer = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    const startAt = performance.now() - elapsedMsRef.current;
    intervalRef.current = window.setInterval(() => {
      const next = performance.now() - startAt;
      elapsedMsRef.current = next;
      setElapsedMs(next);
    }, 200);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const requestMic = async () => {
    setPermissionError(null);
    setSupportError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSupportError('Your browser does not support microphone recording. Please try a modern browser.');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      return stream;
    } catch (err: any) {
      setPermissionError('Microphone access was blocked. Please allow mic permissions to record.');
      return null;
    }
  };

  const finishRecordingFromChunks = (recorder: MediaRecorder) => {
    if (assemblingRef.current) return;
    assemblingRef.current = true;
    stopTimer();

    const blobType = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: blobType });
    if (!blob.size) {
      assemblingRef.current = false;
      setStudioState('idle');
      setPermissionError('Nothing was recorded. Please try again and allow the microphone.');
      return;
    }

    lastBlobRef.current = blob;
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    setStudioState('finished');

    const timerSeconds = Math.max(1, Math.round(elapsedMsRef.current / 1000));
    // Defer so quality helper from this render is definitely initialised.
    window.setTimeout(() => {
      void analyzeRecordingQuality(blob, timerSeconds);
    }, 0);
  };

  const handleStart = async () => {
    if (!category) {
      setPermissionError('Choose what you want to record first (Qur’an, Nasheed, Story, or Hadith).');
      return;
    }
    const stream = streamRef.current || (await requestMic());
    if (!stream) return;

    assemblingRef.current = false;
    setSubmitError(null);
    setSubmitSuccess(null);
    setRecordingQuality(null);

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      const supportedType = preferredTypes.find(
        (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
      );
      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        finishRecordingFromChunks(recorder);
      };
      mediaRecorderRef.current = recorder;
    }

    if (!audioContextRef.current || !analyserRef.current) {
      setupAnalyser(stream);
    }

    chunksRef.current = [];
    lastBlobRef.current = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      mediaRecorderRef.current.start(1000);
    } catch {
      mediaRecorderRef.current.start();
    }
    setStudioState('recording');
    startTimer();
    startLevelMeter();
  };

  const handlePause = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStudioState('paused');
      stopTimer();
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStudioState('recording');
      startTimer();
      startLevelMeter();
    }
  };

  const handleStop = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Failed to stop recorder:', err);
        setPermissionError('Could not finish the recording. Please try again.');
      }
    }
  };

  const handleReset = () => {
    resetRecording();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(false);
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleSubmitRecording = async () => {
    if (!lastBlobRef.current || !audioUrl) {
      setSubmitError('Please record something first.');
      return;
    }
    if (!category) {
      setSubmitError('Please choose what you recorded (Qur’an, Nasheed, Story, or Hadith).');
      return;
    }
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      const blobType = lastBlobRef.current.type || 'audio/webm';
      const extension = blobType.includes('mp4')
        ? 'm4a'
        : blobType.includes('mpeg')
          ? 'mp3'
          : blobType.includes('ogg')
            ? 'ogg'
            : 'webm';
      formData.append('recording', lastBlobRef.current, `recording.${extension}`);
      formData.append('category', category);
      formData.append('title', title || '');
      const seconds = Math.max(
        1,
        recordingQuality?.duration || Math.round(elapsedMsRef.current / 1000)
      );
      formData.append('duration', String(seconds));
      formData.append('childName', childName || profile?.name || '');
      if (user?.id) {
        formData.append('userId', user.id);
      }
      formData.append('message', message || '');

      const res = await fetch('/api/studio-submit', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to submit recording. Please try again.');
      } else {
        setSubmitSuccess('Recording sent! A teacher will check it. When published, it can appear on Kids Audio.');
        if (category === 'quran') {
          trackQuranRecordingSubmitted({ source: 'studio' });
        }
      }
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to submit recording. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const analyzeRecordingQuality = async (blob: Blob, timerSeconds: number) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      void audioContext.close();

      const channelData = audioBuffer.getChannelData(0);
      let sum = 0;
      const step = Math.max(1, Math.floor(channelData.length / 50000));
      let samples = 0;
      for (let i = 0; i < channelData.length; i += step) {
        sum += channelData[i] * channelData[i];
        samples += 1;
      }
      const rms = Math.sqrt(sum / Math.max(1, samples));
      // Map typical speech RMS (~0.01–0.2) onto a friendlier 0–100 scale.
      const averageVolume = Math.min(100, Math.round(rms * 400));
      const duration = Math.max(timerSeconds, Math.round(audioBuffer.duration || 0));
      const hasGoodQuality = duration >= 10 && duration <= 300 && averageVolume >= 1;

      setRecordingQuality({
        duration,
        averageVolume,
        hasGoodQuality,
      });
    } catch (error) {
      console.error('Quality analysis failed:', error);
      // Still allow submit — decoding can fail on some mobile codecs.
      setRecordingQuality({
        duration: timerSeconds,
        averageVolume: 0,
        hasGoodQuality: timerSeconds >= 10,
      });
    }
  };

  const levelPercent = Math.round(level * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-sky-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-wrap justify-between gap-3 items-center">
          <Button variant="outline" onClick={() => router.push('/')}>
            ← Home
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/my-recordings')}>
              My recordings
            </Button>
            <Button variant="outline" onClick={() => router.push('/listen')}>
              Kids Audio
            </Button>
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-islamic-dark islamic-shadow">
            🎙️ Kids Recording Studio
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Record Qur&apos;an, nasheed, story or hadith with your microphone.
            Listen back, then submit for a teacher to check — published clips appear on Kids Audio.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-[2fr,3fr] items-start">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  What would you like to record?
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={category === 'quran' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setCategory('quran')}
                  >
                    📖 Qur&apos;an
                  </Button>
                  <Button
                    variant={category === 'nasheed' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setCategory('nasheed')}
                  >
                    🎵 Nasheed
                  </Button>
                  <Button
                    variant={category === 'story' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setCategory('story')}
                  >
                    📚 Story
                  </Button>
                  <Button
                    variant={category === 'hadith' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setCategory('hadith')}
                  >
                    📜 Hadith
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Your Name
                </p>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-islamic-blue"
                  placeholder="Enter your name"
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Give your recording a name
                </p>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-islamic-blue"
                  placeholder="Example: Surah Al-Fatihah, My Eid Nasheed, Kindness Hadith"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Message to teacher (optional)
                </p>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-islamic-blue min-h-[80px]"
                  placeholder="Example: This is my Surah practice, please check my tajweed."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Mic level</p>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      levelPercent < 60
                        ? 'bg-emerald-400'
                        : levelPercent < 85
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${levelPercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Speak clearly and keep the bar mostly in the green or yellow.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex items-center justify-center rounded-full border-4 w-32 h-32 ${
                    studioState === 'recording'
                      ? 'border-red-400 bg-red-50 animate-pulse'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={
                      studioState === 'recording' || studioState === 'paused'
                        ? handleStop
                        : handleStart
                    }
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg transition ${
                      studioState === 'recording'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-islamic-blue text-white hover:bg-blue-700'
                    }`}
                  >
                    {studioState === 'recording' || studioState === 'paused' ? '■' : '●'}
                  </button>
                </div>
                <p className="text-sm text-slate-600">
                  {studioState === 'idle' && 'Tap to start recording'}
                  {studioState === 'recording' && 'Recording... tap to stop'}
                  {studioState === 'paused' && 'Paused... tap to stop'}
                  {studioState === 'finished' && 'Recording finished'}
                </p>
                <p className="text-xs font-mono text-slate-600">
                  {formatTime(elapsedMs)}
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={studioState === 'idle' || studioState === 'finished'}
                  onClick={handlePause}
                >
                  {studioState === 'paused' ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={studioState === 'idle'}
                  onClick={handleReset}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {(permissionError || supportError) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {permissionError || supportError}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-islamic-dark flex items-center gap-2">
            <span>🎧 Listen to your recording</span>
            {!audioUrl && <span className="text-xs font-normal text-slate-500">(Record something first)</span>}
          </h2>
              {audioUrl ? (
            <div className="space-y-4">
              <audio controls className="w-full" src={audioUrl} />

              {/* Quality Indicator — advisory only; never blocks submit */}
              {recordingQuality && (
                <div className={`p-3 rounded-lg border ${
                  recordingQuality.hasGoodQuality
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {recordingQuality.hasGoodQuality ? '✅' : '⚠️'} Recording tip
                  </div>
                  <div className="text-xs mt-1 space-y-1">
                    <div>
                      Duration: {recordingQuality.duration}s{' '}
                      {recordingQuality.duration < 10
                        ? '(a bit short — try 10+ seconds if you can)'
                        : recordingQuality.duration > 300
                          ? '(very long)'
                          : '(good)'}
                    </div>
                    {recordingQuality.averageVolume > 0 && (
                      <div>
                        Volume: {recordingQuality.averageVolume}%{' '}
                        {recordingQuality.averageVolume < 1 ? '(quite quiet)' : '(good)'}
                      </div>
                    )}
                  </div>
                  {!recordingQuality.hasGoodQuality && (
                    <div className="text-xs mt-2 font-medium">
                      You can still submit. Tip:{' '}
                      {recordingQuality.duration < 10
                        ? 'record a little longer if you can'
                        : recordingQuality.duration > 300
                          ? 'keep recordings under 5 minutes'
                          : 'speak a bit louder or move closer to the mic'}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitting || !audioUrl}
                  onClick={handleSubmitRecording}
                >
                  {submitting ? 'Submitting...' : 'Submit Recording'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  🔁 Record again
                </Button>
              </div>
              {submitError && (
                <p className="text-xs text-red-600">
                  {submitError}
                </p>
              )}
              {submitSuccess && (
                <p className="text-xs text-emerald-600">
                  {submitSuccess}
                </p>
              )}
              <p className="text-xs text-slate-500">
                After submit, teachers review it on the admin Recordings page. Check{' '}
                <button type="button" className="underline font-semibold" onClick={() => router.push('/my-recordings')}>
                  My recordings
                </button>{' '}
                for feedback.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              After you finish recording, you can listen here.
            </p>
          )}
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-sm text-slate-700 space-y-2">
          <p className="font-semibold text-islamic-dark">Tips for a great recording</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Find a quiet room and sit comfortably.</li>
            <li>Hold the microphone or device a little away from your mouth.</li>
            <li>Take a deep breath and recite or speak slowly and clearly.</li>
            <li>If you make a mistake, you can reset and try again.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
