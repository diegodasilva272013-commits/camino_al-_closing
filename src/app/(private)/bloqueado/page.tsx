'use client';

import { useEffect, useState } from 'react';
import { Lock, MessageCircle } from 'lucide-react';

export default function BloqueadoPage() {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    fetch('/api/profile/me').then(r => r.json()).then(d => {
      if (d.bloqueado_motivo) setMotivo(d.bloqueado_motivo);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="h-20 w-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <Lock className="h-10 w-10 text-red-400" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-bold text-white">Cuenta bloqueada</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {motivo || 'Tu cuenta fue bloqueada por acumular 3 strikes. Para continuar usando la plataforma debés hablar con coordinación.'}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-4 max-w-xs w-full space-y-3">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">¿Qué hacer?</p>
        <div className="space-y-2 text-sm text-zinc-400 text-left">
          <p>1. Comunicate con coordinación por WhatsApp o chat interno.</p>
          <p>2. Explicá la situación y comprometete a cumplir las tareas.</p>
          <p>3. Una vez aprobado, tu cuenta será desbloqueada.</p>
        </div>
      </div>

      <a href="https://wa.me/5491100000000" target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition">
        <MessageCircle className="h-4 w-4" />
        Contactar coordinación
      </a>

      <p className="text-[11px] text-zinc-700">Si creés que esto es un error, escribile directamente a Diego.</p>
    </div>
  );
}
