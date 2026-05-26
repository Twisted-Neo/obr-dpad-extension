'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Smartphone } from 'lucide-react';

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [roomInput, setRoomInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [waitingForGM, setWaitingForGM] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);

  // Auto-fill the room code if it's passed in the URL (?room=XJ9B)
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomInput(roomParam.toUpperCase());
    }
  }, [searchParams]);

  // Real-time listening loop while waiting for GM approval
  useEffect(() => {
    if (!playerId || !roomInput) return;

    const channel = supabase
      .channel(`player-approval-${playerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${playerId}` },
        (payload) => {
          const updatedPlayer = payload.new;
          // If the GM assigned a token and flipped status to approved, route to controller!
          if (updatedPlayer.status === 'approved' && updatedPlayer.token_id) {
            router.push(`/controller?room=${roomInput}&playerId=${playerId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, roomInput, router]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const formattedRoom = roomInput.trim().toUpperCase();

    // 1. Verify the room actually exists
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', formattedRoom)
      .single();

    if (roomError || !roomData) {
      setErrorMsg('Room code not found. Double check with your GM.');
      setLoading(false);
      return;
    }

    // 2. Insert the player as 'pending'
    const generatedPlayerId = crypto.randomUUID();
    const { error: playerError } = await supabase
      .from('players')
      .insert([
        {
          id: generatedPlayerId,
          room_id: formattedRoom,
          name: playerName.trim(),
          status: 'pending',
          token_id: null
        }
      ]);

    if (playerError) {
      setErrorMsg('Failed to join session. Try a different name.');
      setLoading(false);
      return;
    }

    setPlayerId(generatedPlayerId);
    setWaitingForGM(true);
    setLoading(false);
  };

  if (waitingForGM) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-6 text-center">
        <div className="w-16 h-16 border-4 border-t-indigo-500 border-indigo-900 rounded-full animate-spin mb-6"></div>
        <h1 className="text-xl font-bold mb-2 text-white">Connected to Room {roomInput}!</h1>
        <p className="text-sm text-slate-400 max-w-xs">
          Tell your GM you are ready. They need to select your token on the map and click "Link Selected Token".
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <div className="w-full max-w-md bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <header className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center mb-3">
            <Smartphone className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Join OBR Controller</h1>
          <p className="text-xs text-slate-400 mt-1">Control your token directly from your phone</p>
        </header>

        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Room Code</label>
            <input
              type="text"
              maxLength={4}
              required
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="E.G. XJ9B"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xl tracking-widest uppercase text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Character Name</label>
            <input
              type="text"
              required
              maxLength={24}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your character's name"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-base text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {errorMsg && <p className="text-xs font-semibold text-rose-400 mt-2">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl shadow transition-all active:scale-[0.98]"
          >
            {loading ? 'Validating...' : 'Request to Join'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Next.js App Router requires searchParams tracking wrapped inside a Suspense window
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-slate-400 p-4">Loading...</div>}>
      <JoinContent />
    </Suspense>
  );
}
