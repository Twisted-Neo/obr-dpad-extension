'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react'; // Simple QR renderer
import { UserCheck, ShieldQuestion, Move } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  status: string;
  token_id: string | null;
}

export default function ExtensionPage() {
  const [ready, setReady] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostUrl, setHostUrl] = useState('');
  const [obrSdk, setObrSdk] = useState<any>(null);

  // 1. Safe Client-Only Import & Initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostUrl(window.location.origin);
    }

    // Lazy load the SDK explicitly on the client browser 
    import('@owlbear-rodeo/sdk').then((OBRModule) => {
      const OBR = OBRModule.default;
      setObrSdk(OBR);

      OBR.onReady(async () => {
        setReady(true);
        
        // Look for a room code we generated earlier this session or make a new one
        let code = sessionStorage.getItem('obr_dpad_room');
        if (!code) {
          code = Math.random().toString(36).substring(2, 6).toUpperCase();
          sessionStorage.setItem('obr_dpad_room', code);
        }
        setRoomCode(code);

        // Register the room in Supabase
        await supabase.from('rooms').upsert([{ id: code }]);

        // Fetch existing players for this room
        fetchPlayers(code);

        // Listen for players joining or pressing buttons in real-time
        const channel = supabase
          .channel(`room-${code}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${code}` },
            (payload) => {
              // Refresh player list automatically when data updates
              fetchPlayers(code);

              // If a player sent a movement command, handle it immediately
              if (payload.eventType === 'UPDATE') {
                const updatedPlayer = payload.new as Player;
                
                // If status includes a command, run it!
                if (updatedPlayer.status.startsWith('MOVE_') && updatedPlayer.token_id) {
                  const direction = updatedPlayer.status.replace('MOVE_', '');
                  executeMovement(OBR, updatedPlayer.token_id, direction);
                  // Clear the command status back to approved
                  resetPlayerStatus(updatedPlayer.id);
                }
              }
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      });
    });
  }, []);

  const fetchPlayers = async (code: string) => {
    const { data } = await supabase.from('players').select('*').eq('room_id', code);
    if (data) setPlayers(data);
  };

  const resetPlayerStatus = async (playerId: string) => {
    await supabase.from('players').update({ status: 'approved' }).eq('id', playerId);
  };

  // 2. The Token Movement Math Logic
  const executeMovement = async (OBR: any, tokenId: string, direction: string) => {
    try {
      const dpi = await OBR.scene.grid.getDpi();
      const scale = await OBR.scene.grid.getScale();
      
      // Calculate exactly how many raw screen pixels match 1 square unit
      const offset = dpi * (scale.parsed?.multiplier || 1);

      await OBR.scene.items.updateItems([tokenId], (items: any[]) => {
        for (let item of items) {
          if (item.position) {
            if (direction === 'UP') item.position.y -= offset;
            if (direction === 'DOWN') item.position.y += offset;
            if (direction === 'LEFT') item.position.x -= offset;
            if (direction === 'RIGHT') item.position.x += offset;
          }
        }
      });
    } catch (err) {
      console.error("Failed moving token:", err);
    }
  };

  // 3. Assign currently selected map token to a waiting player
  const assignTokenToPlayer = async (playerId: string) => {
    if (!obrSdk) return;
    
    const selection = await obrSdk.player.getSelection();
    
    if (!selection || selection.length === 0) {
      obrSdk.notification.show("Please click and select a token on the map first!");
      return;
    }

    const selectedTokenId = selection[0];

    await supabase
      .from('players')
      .update({ token_id: selectedTokenId, status: 'approved' })
      .eq('id', playerId);

    obrSdk.notification.show("Token assigned successfully!");
  };

  if (!ready || !roomCode) {
    return <div className="p-4 text-sm text-gray-400 animate-pulse bg-slate-900 min-h-screen">Connecting to Owlbear Rodeo...</div>;
  }

  const joinUrl = `${hostUrl}/join?room=${roomCode}`;

  return (
    <div className="p-4 font-sans text-slate-200 min-h-screen bg-slate-900 selection:bg-indigo-500">
      <header className="mb-6 pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Move className="w-5 h-5 text-indigo-400" /> Phone D-Pad Setup
        </h1>
      </header>

      {/* QR and Code Section */}
      <section className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center gap-3 mb-6 shadow-xl">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Join Code</p>
        <span className="text-4xl font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          {roomCode}
        </span>
        
        <div className="p-2 bg-white rounded-lg mt-2 shadow-inner">
          <QRCodeSVG value={joinUrl} size={140} />
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
          Have players scan this QR code or visit your Vercel deployment URL.
        </p>
      </section>

      {/* Player Roster Section */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
          Connected Controllers ({players.length})
        </h2>
        
        <div className="space-y-2">
          {players.length === 0 && (
            <p className="text-sm text-slate-500 italic p-4 border border-dashed border-slate-800 rounded-lg text-center">
              Waiting for players to connect...
            </p>
          )}

          {players.map((player) => (
            <div 
              key={player.id} 
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-800 transition-all hover:border-slate-700"
            >
              <div>
                <p className="font-medium text-sm text-white">{player.name}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  {player.token_id ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Token Linked
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <ShieldQuestion className="w-3 h-3" /> Unlinked
                    </span>
                  )}
                </p>
              </div>

              <button
                onClick={() => assignTokenToPlayer(player.id)}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold shadow transition-all ${
                  player.token_id 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {player.token_id ? 'Reassign Selected' : 'Link Selected Token'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
