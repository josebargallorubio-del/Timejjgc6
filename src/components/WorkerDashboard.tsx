import { useState, useEffect } from 'react';
import { User, Schedule, TimeEntry } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, Play, Square, Zap } from 'lucide-react';

const DAYS = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
];

export default function WorkerDashboard({ user }: { user: User }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedRes, entriesRes] = await Promise.all([
        fetch(`/api/schedules/${user.id}`),
        fetch(`/api/time-entries?userId=${user.id}`)
      ]);
      const schedData = await schedRes.json();
      setSchedules(schedData);
      setEntries(await entriesRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualClock = async (action: 'in' | 'out') => {
    const now = new Date();
    const time = format(now, 'HH:mm');
    const date = format(now, 'yyyy-MM-dd');

    try {
      await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: 'manual',
          action,
          time,
          date
        }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoClockDay = async () => {
    const now = new Date();
    const date = format(now, 'yyyy-MM-dd');
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      alert('No se puede fichar automáticamente en fin de semana.');
      return;
    }

    try {
      const res = await fetch('/api/clock/auto-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          date,
          dayOfWeek
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al fichar automáticamente');
      } else {
        alert('Fichaje automático completado para hoy.');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-neutral-500">Cargando datos...</div>;

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayEntry = entries.find(e => e.date === today);
  const isClockedIn = todayEntry && todayEntry.clock_in && !todayEntry.clock_out;
  const hasCompletedToday = todayEntry && todayEntry.clock_in && todayEntry.clock_out;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Actions & Status */}
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 text-center">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-800 mb-1">
            {format(new Date(), "HH:mm")}
          </h2>
          <p className="text-neutral-500 text-sm mb-6 capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>

          {hasCompletedToday ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 font-medium">
              Jornada completada por hoy
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleManualClock('in')}
                  disabled={!!isClockedIn}
                  className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="w-5 h-5" />
                  <span className="text-sm font-medium">Entrada</span>
                </button>
                <button
                  onClick={() => handleManualClock('out')}
                  disabled={!isClockedIn}
                  className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Square className="w-5 h-5" />
                  <span className="text-sm font-medium">Salida</span>
                </button>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-neutral-400 uppercase tracking-widest">O</span>
                </div>
              </div>

              <button
                onClick={handleAutoClockDay}
                disabled={!!todayEntry}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent transition-colors font-medium"
              >
                <Zap className="w-5 h-5" />
                Fichar Automáticamente
              </button>
              <p className="text-xs text-neutral-500 mt-2">
                Usa el horario definido para registrar entrada y salida de hoy.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Schedule & History */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-red-500" />
              <h2 className="text-xl font-semibold text-neutral-800">Mi Horario</h2>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {DAYS.map(day => {
                const savedSched = schedules.find(s => s.day_of_week === day.id);
                
                return (
                  <div key={day.id} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="font-medium text-neutral-800 mb-3 text-center">{day.name}</h3>
                    <div className="text-center">
                      {savedSched?.start_time && savedSched?.end_time ? (
                        <div className="font-mono text-neutral-600 text-sm">
                          <div>{savedSched.start_time}</div>
                          <div className="text-neutral-400 text-xs my-1">|</div>
                          <div>{savedSched.end_time}</div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 text-sm italic">Libre</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 bg-neutral-50">
            <h2 className="text-xl font-semibold text-neutral-800">Historial Reciente</h2>
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-sm text-neutral-500 bg-neutral-50/50">
                  <th className="py-3 px-6 font-medium">Fecha</th>
                  <th className="py-3 px-6 font-medium">Entrada</th>
                  <th className="py-3 px-6 font-medium">Salida</th>
                  <th className="py-3 px-6 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {entries.slice(0, 5).map((entry) => (
                  <tr key={entry.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-4 px-6 font-medium text-neutral-800 capitalize">
                      {format(new Date(entry.date), "EEE, d MMM", { locale: es })}
                    </td>
                    <td className="py-4 px-6 font-mono text-neutral-600">{entry.clock_in || '-'}</td>
                    <td className="py-4 px-6 font-mono text-neutral-600">{entry.clock_out || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs ${entry.type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {entry.type === 'auto' ? 'Auto' : 'Manual'}
                      </span>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-500">
                      Aún no has fichado ninguna vez.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
