'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Radio } from 'lucide-react';

function ControllerContent() {
  const searchParams = useSearchParams();
  const room = searchParams.get('room');
  const playerId = searchParams.get('playerId');

  const [isSending, setIsSending] = useState(false);
  const [characterName, setCharacterName] = useState('Controller');

  useEffect(() => {
    if (!playerId) return;
    
    // Grab player name to personalize the screen title
    const fetchPlayerInfo = async () => {
      const { data } = await supabase.from('players').select('name').eq('id', playerId).single();
      if (data) setCharacterName(data.name);
    };
    fetchPlayerInfo();
  }, [playerId]);

  const sendMoveCommand = async (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (!playerId || isSending) return;
    
    setIsSending(true);

    // Write a specialized status payload trigger that the Extension watches for
    await supabase
      .from('players')
      .update({ status: `MOVE_${direction}` })
      .eq('id', playerId);

    // Brief cooldown block to prevent heavy mechanical button spamming
    setTimeout(() => {
      setIsSending(false);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 font-sans select-none overflow-hidden touch-none">
      {/* Top Controller Status Board */}
      <header className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl w-full max-w-sm mx-auto shadow-lg">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">{characterName}</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Room: {room?.toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
          <Radio className="w-3.5 h-3.5 animate-pulse" /> Linked
        </div>
      </header>

      {/* Cross Pattern D-Pad Component Layout */}
      <main className="flex-1 flex items-center justify-center my-8">
        <div className="relative w-72 h-72">
          {/* UP BUTTON */}
          <button
            onTouchStart={() => sendMoveCommand('UP')}
            onClick={() => sendMoveCommand('UP')}
            disabled={isSending}
            className="absolute top-0 left-24 w-24 h-24 bg-slate-800 border-2 border-slate-700 rounded-2xl flex items-center justify-center active:bg-indigo-600 active:border-indigo-500 shadow-xl transition-all"
          >
            <ArrowUp className="w-8 h-8 text-slate-300 group-active:text-white" />
          </button>

          {/* LEFT BUTTON */}
          <button
            onTouchStart={() => sendMoveCommand('LEFT')}
            onClick={() => sendMoveCommand('LEFT')}
            disabled={isSending}
            className="absolute top-24 left-0 w-24 h-24 bg-slate-800 border-2 border-slate-700 rounded-2xl flex items-center justify-center active:bg-indigo-600 active:border-indigo-500 shadow-xl transition-all"
          >
            <ArrowLeft className="w-8 h-8 text-slate-300" />
          </button>

          {/* D-PAD CENTER BLOCK (Visual Anchor Only) */}
          <div className="absolute top-24 left-24 w-24 h-24 bg-slate-900 border border-slate-800/80 rounded-xl flex items-center justify-center">
            <div className="w-4 h-4 bg-slate-700 rounded-full"></div>
          </div>

          {/* RIGHT BUTTON */}
          <button
            onTouchStart={() => sendMoveCommand('RIGHT')}
            onClick={() => sendMoveCommand('RIGHT')}
            disabled={isSending}
            className="absolute top-24 right-0 w-24 h-24 bg-slate-800 border-2 border-slate-700 rounded-2xl flex items-center justify-center active:bg-indigo-600 active:border-indigo-500 shadow-xl transition-all"
          >
            <ArrowRight className="w-8 h-8 text-slate-300" />
          </button>

          {/* DOWN BUTTON */}
          <button
            onTouchStart={() => sendMoveCommand('DOWN')}
            onTouchEnd={(e) => e.preventDefault()}
            onClick={() => sendMoveCommand('DOWN')}
            disabled={isSending}
            className="absolute bottom-0 left-24 w-24 h-24 bg-slate-800 border-2 border-slate-700 rounded-2xl flex items-center justify-center active:bg-indigo-600 active:border-indigo-500 shadow-xl transition-all"
          >
            <ArrowDown className="w-8 h-8 text-slate-300" />
          </button>
        </div>
      </main>

      {/* Footer Instructions Hint */}
      <footer className="text-center w-full max-w-xs mx-auto text-[11px] text-slate-500 leading-relaxed uppercase tracking-wider font-semibold">
        Tap directional arrows to step character exactly 1 square.
      </footer>
    </div>
  );
}

export default function ControllerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-400 p-4">Loading Controller...</div>}>
      <ControllerContent />
    </Suspense>
  );
}