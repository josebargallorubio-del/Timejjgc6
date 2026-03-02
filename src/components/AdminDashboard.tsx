import React, { useState, useEffect } from 'react';
import { User, TimeEntry, Schedule } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, UserPlus, Users, Clock, Calendar, Printer, X, Plus, Edit2 } from 'lucide-react';

const DAYS = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
];

export default function AdminDashboard({ user }: { user: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'worker' });
  const [error, setError] = useState('');

  // Schedule management state
  const [selectedUserForSchedule, setSelectedUserForSchedule] = useState<User | null>(null);
  const [tempSchedules, setTempSchedules] = useState<Partial<Schedule>[]>([]);

  // Entry management state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<TimeEntry> | null>(null);

  // Print state
  const [printMonth, setPrintMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, entriesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/time-entries')
      ]);
      setUsers(await usersRes.json());
      setEntries(await entriesRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        setNewUser({ name: '', pin: '', role: 'worker' });
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al crear usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Seguro que quieres eliminar este usuario?')) return;
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenSchedule = async (u: User) => {
    setSelectedUserForSchedule(u);
    try {
      const res = await fetch(`/api/schedules/${u.id}`);
      const schedData = await res.json();
      const initialTemp = DAYS.map(day => {
        const existing = schedData.find((s: Schedule) => s.day_of_week === day.id);
        return {
          day_of_week: day.id,
          start_time: existing?.start_time || '',
          end_time: existing?.end_time || '',
          start_time_2: existing?.start_time_2 || '',
          end_time_2: existing?.end_time_2 || ''
        };
      });
      setTempSchedules(initialTemp);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedUserForSchedule) return;
    try {
      await fetch(`/api/schedules/${selectedUserForSchedule.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: tempSchedules }),
      });
      setSelectedUserForSchedule(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('print-area');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Registro de Jornada</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print {
                  .break-before-page { page-break-before: always; }
                }
                body { font-family: sans-serif; }
              </style>
            </head>
            <body class="p-8 bg-white text-black">
              ${printContent.innerHTML}
              <script>
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 1000);
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        alert('Por favor, permite las ventanas emergentes para imprimir.');
      }
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry?.user_id || !editingEntry?.date) return;

    try {
      if (editingEntry.id) {
        // Update
        await fetch(`/api/time-entries/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingEntry),
        });
      } else {
        // Create
        await fetch('/api/time-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editingEntry, type: 'manual' }),
        });
      }
      setShowEntryModal(false);
      setEditingEntry(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('¿Seguro que quieres eliminar este fichaje?')) return;
    try {
      await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-neutral-500">Cargando datos...</div>;

  const monthStart = startOfMonth(parseISO(`${printMonth}-01`));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <>
      <div className="space-y-8 print:hidden">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="p-6 border-b border-neutral-200 bg-neutral-50 flex items-center gap-3">
          <Users className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-semibold text-neutral-800">Gestión de Usuarios</h2>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Nuevo Usuario
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="PIN"
                  value={newUser.pin}
                  onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                >
                  <option value="worker">Trabajador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-2 rounded-lg transition-colors"
              >
                Añadir Usuario
              </button>
            </form>
          </div>

          <div className="md:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-sm text-neutral-500">
                    <th className="pb-3 font-medium">Nombre</th>
                    <th className="pb-3 font-medium">PIN</th>
                    <th className="pb-3 font-medium">Rol</th>
                    <th className="pb-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                      <td className="py-3 font-medium text-neutral-800">{u.name}</td>
                      <td className="py-3 font-mono text-neutral-600">{u.pin}</td>
                      <td className="py-3 text-neutral-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-700'}`}>
                          {u.role === 'admin' ? 'Admin' : 'Trabajador'}
                        </span>
                      </td>
                      <td className="py-3 text-right flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenSchedule(u)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Gestionar Horario"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-red-500" />
              <h2 className="text-xl font-semibold text-neutral-800">Registro de Fichajes</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditingEntry({ date: format(new Date(), 'yyyy-MM-dd') });
                  setShowEntryModal(true);
                }}
                className="flex items-center gap-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Añadir Turno
              </button>
              <input 
                type="month" 
                value={printMonth}
                onChange={(e) => setPrintMonth(e.target.value)}
                className="px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
              />
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir Mes
              </button>
            </div>
          </div>
          <div className="p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-sm text-neutral-500">
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Trabajador</th>
                <th className="pb-3 font-medium">Entrada</th>
                <th className="pb-3 font-medium">Salida</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                  <td className="py-3 font-medium text-neutral-800">
                    {format(new Date(entry.date), "dd MMM yyyy", { locale: es })}
                  </td>
                  <td className="py-3 text-neutral-600">{entry.user_name}</td>
                  <td className="py-3 font-mono text-neutral-600">{entry.clock_in || '-'}</td>
                  <td className="py-3 font-mono text-neutral-600">{entry.clock_out || '-'}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${entry.type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {entry.type === 'auto' ? 'Automático' : 'Manual'}
                    </span>
                  </td>
                  <td className="py-3 text-right flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingEntry(entry);
                        setShowEntryModal(true);
                      }}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    No hay registros de fichaje.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Schedule Modal */}
      {selectedUserForSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-800">
                Horario de {selectedUserForSchedule.name}
              </h2>
              <button 
                onClick={() => setSelectedUserForSchedule(null)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {DAYS.map(day => {
                  const tempSched = tempSchedules.find(s => s.day_of_week === day.id);
                  return (
                    <div key={day.id} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h3 className="font-medium text-neutral-800 mb-3 text-center">{day.name}</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-neutral-500 text-center">Turno 1</p>
                          <input
                            type="time"
                            value={tempSched?.start_time || ''}
                            onChange={(e) => {
                              const newTemp = [...tempSchedules];
                              const idx = newTemp.findIndex(s => s.day_of_week === day.id);
                              if (idx >= 0) newTemp[idx].start_time = e.target.value;
                              setTempSchedules(newTemp);
                            }}
                            className="w-full px-2 py-1 text-sm rounded border border-neutral-300 outline-none focus:border-red-500"
                          />
                          <div className="text-center text-neutral-400 text-xs">a</div>
                          <input
                            type="time"
                            value={tempSched?.end_time || ''}
                            onChange={(e) => {
                              const newTemp = [...tempSchedules];
                              const idx = newTemp.findIndex(s => s.day_of_week === day.id);
                              if (idx >= 0) newTemp[idx].end_time = e.target.value;
                              setTempSchedules(newTemp);
                            }}
                            className="w-full px-2 py-1 text-sm rounded border border-neutral-300 outline-none focus:border-red-500"
                          />
                        </div>
                        <div className="space-y-2 pt-3 border-t border-neutral-200">
                          <p className="text-xs font-medium text-neutral-500 text-center">Turno 2 (Opcional)</p>
                          <input
                            type="time"
                            value={tempSched?.start_time_2 || ''}
                            onChange={(e) => {
                              const newTemp = [...tempSchedules];
                              const idx = newTemp.findIndex(s => s.day_of_week === day.id);
                              if (idx >= 0) newTemp[idx].start_time_2 = e.target.value;
                              setTempSchedules(newTemp);
                            }}
                            className="w-full px-2 py-1 text-sm rounded border border-neutral-300 outline-none focus:border-red-500"
                          />
                          <div className="text-center text-neutral-400 text-xs">a</div>
                          <input
                            type="time"
                            value={tempSched?.end_time_2 || ''}
                            onChange={(e) => {
                              const newTemp = [...tempSchedules];
                              const idx = newTemp.findIndex(s => s.day_of_week === day.id);
                              if (idx >= 0) newTemp[idx].end_time_2 = e.target.value;
                              setTempSchedules(newTemp);
                            }}
                            className="w-full px-2 py-1 text-sm rounded border border-neutral-300 outline-none focus:border-red-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedUserForSchedule(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSchedule}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Guardar Horario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {showEntryModal && editingEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-800">
                {editingEntry.id ? 'Editar Fichaje' : 'Añadir Fichaje'}
              </h2>
              <button 
                onClick={() => {
                  setShowEntryModal(false);
                  setEditingEntry(null);
                }}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Trabajador</label>
                <select
                  value={editingEntry.user_id || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, user_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                  required
                >
                  <option value="">Seleccionar trabajador...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={editingEntry.date || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Entrada</label>
                  <input
                    type="time"
                    value={editingEntry.clock_in || ''}
                    onChange={(e) => setEditingEntry({ ...editingEntry, clock_in: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Salida</label>
                  <input
                    type="time"
                    value={editingEntry.clock_out || ''}
                    onChange={(e) => setEditingEntry({ ...editingEntry, clock_out: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEntryModal(false);
                    setEditingEntry(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print View */}
      <div id="print-area" className="hidden print:block">
        {users.filter(u => u.role !== 'admin').map((u, index) => {
          const userEntries = entries.filter(e => e.user_id === u.id);
          
          return (
            <div key={u.id} className={index > 0 ? 'break-before-page' : ''}>
              <div className="flex items-center justify-between mb-8">
                <img 
                  src="https://page.kidsandus.es/hs-fs/hubfs/logo%20kids%20letras%20my%20negro.png?width=225&height=77&name=logo%20kids%20letras%20my%20negro.png" 
                  alt="Kids&Us Logo" 
                  className="h-12"
                  referrerPolicy="no-referrer"
                />
                <div className="text-right">
                  <h1 className="text-2xl font-bold text-neutral-800">Registro de Jornada</h1>
                  <p className="text-neutral-600 capitalize">
                    {format(monthStart, "MMMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="mb-6 p-4 border border-neutral-300 rounded-lg bg-neutral-50">
                <p className="font-medium text-lg text-neutral-800">Trabajador: <span className="font-bold">{u.name}</span></p>
                <p className="text-neutral-600">Centro: Kids&Us Valls</p>
              </div>

              <table className="w-full border-collapse border border-neutral-300 text-sm mb-12">
                <thead>
                  <tr className="bg-neutral-100">
                    <th className="border border-neutral-300 py-2 px-3 text-left w-24">Día</th>
                    <th className="border border-neutral-300 py-2 px-3 text-center w-32">Entrada</th>
                    <th className="border border-neutral-300 py-2 px-3 text-center w-32">Salida</th>
                    <th className="border border-neutral-300 py-2 px-3 text-left">Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {daysInMonth.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayEntries = userEntries
                      .filter(e => e.date === dateStr)
                      .sort((a, b) => (a.clock_in || '').localeCompare(b.clock_in || ''));
                      
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    
                    return (
                      <tr key={dateStr} className={isWeekend ? 'bg-neutral-50' : ''}>
                        <td className="border border-neutral-300 py-2 px-3">
                          <span className="font-medium">{format(day, 'dd')}</span>
                          <span className="text-neutral-500 ml-1 capitalize text-xs">{format(day, 'EEE', { locale: es })}</span>
                        </td>
                        <td className="border border-neutral-300 py-2 px-3 text-center font-mono text-xs">
                          {dayEntries.length > 0 ? dayEntries.map(e => e.clock_in || '-').join(' / ') : ''}
                        </td>
                        <td className="border border-neutral-300 py-2 px-3 text-center font-mono text-xs">
                          {dayEntries.length > 0 ? dayEntries.map(e => e.clock_out || '-').join(' / ') : ''}
                        </td>
                        <td className="border border-neutral-300 py-2 px-3">
                          {isWeekend ? <span className="text-neutral-300 text-xs italic">Fin de semana</span> : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-between mt-16 px-12">
                <div className="text-center">
                  <div className="w-48 border-b border-neutral-400 mb-2"></div>
                  <p className="text-sm text-neutral-600">Firma del Trabajador</p>
                </div>
                <div className="text-center">
                  <div className="w-48 border-b border-neutral-400 mb-2"></div>
                  <p className="text-sm text-neutral-600">Firma de la Empresa</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
