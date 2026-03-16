'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Truck, Play, Square, Plus, Clock, MapPin, Gauge, 
  AlertTriangle, CheckCircle2, Calendar, FileText, ChevronRight,
  Sun, Moon, Activity, X, AlertCircle, RefreshCw, LogOut, User,
  Eye, Pencil, Trash2, Save
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Tipos
interface Event {
  id: string;
  workDayId: string;
  time: string;
  description: string;
}

interface WorkDay {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  startCountry: string | null;
  endCountry: string | null;
  startKm: number | null;
  endKm: number | null;
  lastRest: string | null;
  amplitude: string | null;
  truckCheck: boolean;
  observations: string | null;
  matricula: string | null;
  events: Event[];
  kmTraveled: number | null;
  hoursWorked: number | null;
  totalEvents: number;
}

interface Report {
  period: { start: string; end: string; type: string };
  statistics: {
    daysWorked: number;
    totalKm: number;
    totalHours: number;
    totalEvents: number;
    avgHoursPerDay: number;
    avgKmPerDay: number;
  };
  alerts: string[];
}

// Componente de Toast simples
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }) {
  const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-amber-500';
  const icon = type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : type === 'error' ? <AlertCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;
  
  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right`}>
      {icon}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="hover:opacity-70">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function DiarioMotorista() {
  const router = useRouter();
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [currentDay, setCurrentDay] = useState<WorkDay | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'main' | 'history' | 'reports'>('main');
  
  // Estados para toasts e diálogos
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    options?: Array<{ label: string; onClick: () => void; variant?: 'default' | 'outline' | 'destructive' }>;
    onConfirm?: () => void;
  } | null>(null);
  
  // Formulários
  const [startForm, setStartForm] = useState({
    startCountry: '',
    startKm: '',
    lastRest: '',
    truckCheck: false,
    matricula: ''
  });
  
  // Estado para info do último KM da matrícula
  const [lastKmInfo, setLastKmInfo] = useState<{
    found: boolean;
    lastKm: number | null;
    message?: string;
  } | null>(null);
  const [checkingMatricula, setCheckingMatricula] = useState(false);
  
  const [endForm, setEndForm] = useState({
    endCountry: '',
    endKm: '',
    observations: ''
  });
  
  const [newEvent, setNewEvent] = useState({ time: '', description: '' });
  const [showEventInput, setShowEventInput] = useState(false);
  const [showEndForm, setShowEndForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  
  // Estados para visualizar, editar e excluir
  const [viewingDay, setViewingDay] = useState<WorkDay | null>(null);
  const [editingDay, setEditingDay] = useState<WorkDay | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    startCountry: '',
    endCountry: '',
    startKm: '',
    endKm: '',
    observations: '',
    matricula: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<WorkDay | null>(null);

  // Mostrar toast
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Carregar dados e usuário
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Verificar sessão
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (!meData.authenticated) {
          router.push('/login');
          return;
        }
        setCurrentUser(meData.user);
      }
      
      const [daysRes, weeklyRes] = await Promise.all([
        fetch('/api/workdays'),
        fetch('/api/reports?type=weekly')
      ]);

      if (daysRes.ok) {
        const days = await daysRes.json();
        setWorkDays(days);
        
        // Verificar se existe um dia aberto (sem endTime)
        const openDay = days.find((d: WorkDay) => !d.endTime);
        if (openDay) {
          setCurrentDay(openDay);
        }
      } else {
        showToast('Erro ao carregar dias de trabalho', 'error');
      }
      
      if (weeklyRes.ok) setWeeklyReport(await weeklyRes.json());
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast('Erro de conexão. Verifique sua internet.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, router]);

  useEffect(() => {
    loadData();
  }, [loadData, router]);

  // Buscar último KM da matrícula quando ela é digitada
  const checkLastKm = async (matricula: string) => {
    // Validar formato da matrícula
    const matriculaRegex = /^[A-Z]{2}-\d{2}-[A-Z0-9]{2}$/;
    if (!matriculaRegex.test(matricula.toUpperCase())) {
      setLastKmInfo(null);
      return;
    }

    setCheckingMatricula(true);
    try {
      const res = await fetch(`/api/matricula/lastkm?matricula=${encodeURIComponent(matricula)}`);
      if (res.ok) {
        const data = await res.json();
        setLastKmInfo(data);
      }
    } catch (error) {
      console.error('Erro ao buscar último KM:', error);
    } finally {
      setCheckingMatricula(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      showToast('Erro ao sair', 'error');
    }
  };

  // ==================== AÇÕES PRINCIPAIS ====================

  // Iniciar novo dia
  const handleStartDay = async () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Verificar se já existe um dia ABERTO (sem endTime)
    const openDay = workDays.find(d => !d.endTime);
    
    if (openDay) {
      // Há um dia em andamento - mostrar 3 opções
      const openDayDate = new Date(openDay.date).toISOString().split('T')[0];
      const isToday = openDayDate === today;
      
      setConfirmDialog({
        open: true,
        title: 'Jornada em Andamento',
        description: isToday 
          ? `Já existe uma jornada aberta hoje iniciada às ${openDay.startTime}. O que deseja fazer?`
          : `Existe uma jornada aberta de ${formatDate(openDay.date)} iniciada às ${openDay.startTime}. Finalize-a antes de iniciar nova jornada.`,
        options: [
          { 
            label: 'Continuar Jornada', 
            onClick: () => {
              setConfirmDialog(null);
              setCurrentDay(openDay);
            },
            variant: 'default'
          },
          ...(isToday ? [{
            label: 'Nova Jornada', 
            onClick: () => {
              setConfirmDialog(null);
              proceedWithStartDay(today, now);
            },
            variant: 'outline'
          }] : []),
          { 
            label: 'Cancelar', 
            onClick: () => setConfirmDialog(null),
            variant: 'outline'
          }
        ]
      });
      return;
    }
    
    // Verificar se já há jornadas fechadas hoje
    const todayRecords = workDays.filter(d => d.date.split('T')[0] === today && d.endTime);
    
    if (todayRecords.length > 0) {
      // Já há jornadas hoje - mostrar opções
      const jornadas = todayRecords.map(r => `${r.startTime}-${r.endTime}`).join(', ');
      
      setConfirmDialog({
        open: true,
        title: 'Jornadas de Hoje',
        description: `Você já registrou ${todayRecords.length} jornada(s) hoje (${jornadas}). Deseja iniciar uma nova jornada?`,
        options: [
          { 
            label: 'Nova Jornada', 
            onClick: () => {
              setConfirmDialog(null);
              proceedWithStartDay(today, now);
            },
            variant: 'default'
          },
          { 
            label: 'Ver Histórico', 
            onClick: () => {
              setConfirmDialog(null);
              setActiveView('history');
            },
            variant: 'outline'
          },
          { 
            label: 'Cancelar', 
            onClick: () => setConfirmDialog(null),
            variant: 'outline'
          }
        ]
      });
      return;
    }
    
    // Nenhum registro - criar novo
    await proceedWithStartDay(today, now);
  };
  
  const proceedWithStartDay = async (date: string, now: Date) => {
    try {
      // Validar formato da matrícula se preenchida
      if (startForm.matricula) {
        const matriculaRegex = /^[A-Z]{2}-\d{2}-[A-Z0-9]{2}$/;
        if (!matriculaRegex.test(startForm.matricula.toUpperCase())) {
          showToast('Formato de matrícula inválido. Use AA-00-BB (ex: PT-12-AB)', 'error');
          return;
        }
      }

      const payload = {
        date: date,
        startTime: now.toTimeString().slice(0, 5),
        startCountry: startForm.startCountry || null,
        startKm: startForm.startKm ? parseInt(startForm.startKm) : null,
        lastRest: startForm.lastRest || null,
        truckCheck: startForm.truckCheck,
        matricula: startForm.matricula ? startForm.matricula.toUpperCase() : null
      };
      
      console.log('Enviando dados:', payload);
      
      const res = await fetch('/api/workdays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newDay = await res.json();
        setCurrentDay(newDay);
        setStartForm({ startCountry: '', startKm: '', lastRest: '', truckCheck: false, matricula: '' });
        setLastKmInfo(null);
        loadData();
        showToast('Dia iniciado com sucesso!', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || 'Erro ao iniciar dia', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão', 'error');
    }
  };

  // Finalizar dia
  const handleEndDay = async () => {
    if (!currentDay) return;
    
    // Validações
    if (endForm.endKm && currentDay.startKm) {
      const endKm = parseInt(endForm.endKm);
      if (endKm <= currentDay.startKm) {
        showToast('KM final deve ser maior que KM inicial', 'error');
        return;
      }
    }
    
    // Calcular horas trabalhadas
    const now = new Date();
    const endTime = now.toTimeString().slice(0, 5);
    const [startH, startM] = currentDay.startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let hoursWorked = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
    if (hoursWorked < 0) hoursWorked += 24;
    
    // Alerta se exceder 9 horas
    if (hoursWorked > 9) {
      setConfirmDialog({
        open: true,
        title: 'Atenção: Limite de horas excedido',
        description: `Você trabalhou ${hoursWorked.toFixed(1)}h, o que excede o limite de 9h do Reg. CE 561/2006. Deseja finalizar mesmo assim?`,
        onConfirm: () => {
          setConfirmDialog(null);
          proceedWithEndDay();
        }
      });
      return;
    }
    
    await proceedWithEndDay();
  };
  
  const proceedWithEndDay = async () => {
    if (!currentDay) return;
    
    try {
      const now = new Date();
      const res = await fetch(`/api/workdays/${currentDay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endTime: now.toTimeString().slice(0, 5),
          endCountry: endForm.endCountry || null,
          endKm: endForm.endKm ? parseInt(endForm.endKm) : null,
          observations: endForm.observations || null
        })
      });

      if (res.ok) {
        setShowEndForm(false);
        setEndForm({ endCountry: '', endKm: '', observations: '' });
        setCurrentDay(null);
        loadData();
        showToast('Dia finalizado com sucesso!', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || 'Erro ao finalizar dia', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão', 'error');
    }
  };

  // Adicionar evento
  const handleAddEvent = async () => {
    if (!currentDay || !newEvent.description) {
      showToast('Por favor, descreva o evento', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDayId: currentDay.id,
          time: newEvent.time || new Date().toTimeString().slice(0, 5),
          description: newEvent.description
        })
      });

      if (res.ok) {
        setNewEvent({ time: '', description: '' });
        setShowEventInput(false);
        loadData();
        // Atualizar dia atual
        const dayRes = await fetch(`/api/workdays/${currentDay.id}`);
        if (dayRes.ok) {
          setCurrentDay(await dayRes.json());
        }
        showToast('Evento adicionado!', 'success');
      } else {
        showToast('Erro ao adicionar evento', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão', 'error');
    }
  };

  // ==================== FUNÇÕES DE GERENCIAMENTO ====================

  // Visualizar registro
  const handleViewDay = (day: WorkDay) => {
    setViewingDay(day);
  };

  // Abrir edição
  const handleEditClick = (day: WorkDay) => {
    setEditingDay(day);
    setEditForm({
      date: new Date(day.date).toISOString().split('T')[0],
      startTime: day.startTime || '',
      endTime: day.endTime || '',
      startCountry: day.startCountry || '',
      endCountry: day.endCountry || '',
      startKm: day.startKm?.toString() || '',
      endKm: day.endKm?.toString() || '',
      observations: day.observations || '',
      matricula: day.matricula || ''
    });
  };

  // Salvar edição
  const handleSaveEdit = async () => {
    if (!editingDay) return;

    try {
      const res = await fetch(`/api/workdays/${editingDay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editForm.date,
          startTime: editForm.startTime,
          endTime: editForm.endTime || null,
          startCountry: editForm.startCountry || null,
          endCountry: editForm.endCountry || null,
          startKm: editForm.startKm ? parseInt(editForm.startKm) : null,
          endKm: editForm.endKm ? parseInt(editForm.endKm) : null,
          observations: editForm.observations || null,
          matricula: editForm.matricula ? editForm.matricula.toUpperCase() : null
        })
      });

      if (res.ok) {
        setEditingDay(null);
        loadData();
        showToast('Registro atualizado!', 'success');
      } else {
        showToast('Erro ao atualizar registro', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }
  };

  // Excluir registro
  const handleDeleteDay = async () => {
    if (!deleteConfirm) return;

    try {
      const res = await fetch(`/api/workdays/${deleteConfirm.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setDeleteConfirm(null);
        loadData();
        showToast('Registro excluído!', 'success');
      } else {
        showToast('Erro ao excluir registro', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }
  };

  // ==================== HELPERS ====================

  const formatTime = (time: string | null) => time || '--:--';
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const calculateWorkingTime = () => {
    if (!currentDay?.startTime) return '0:00';
    const start = currentDay.startTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const diff = nowMinutes - startMinutes;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const getConformityStatus = () => {
    if (!currentDay?.startTime) return { status: 'ok', message: '' };
    
    const start = currentDay.startTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const hoursWorked = (nowMinutes - startMinutes) / 60;

    if (hoursWorked > 9) {
      return { status: 'danger', message: `LIMITE EXCEDIDO: ${hoursWorked.toFixed(1)}h (máx 9h)` };
    } else if (hoursWorked > 8) {
      return { status: 'warning', message: `Atenção: ${hoursWorked.toFixed(1)}h - Aproximando do limite` };
    } else if (hoursWorked > 4.5) {
      return { status: 'warning', message: `${hoursWorked.toFixed(1)}h - Considere fazer uma pausa` };
    }
    return { status: 'ok', message: `${hoursWorked.toFixed(1)}h de condução - OK` };
  };

  const conformity = getConformityStatus();

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Diálogo de Confirmação */}
      {confirmDialog && (
        <Dialog open={confirmDialog.open} onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {confirmDialog.title}
              </DialogTitle>
              <DialogDescription className="whitespace-pre-line">{confirmDialog.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {confirmDialog.options ? (
                confirmDialog.options.map((option, index) => (
                  <Button 
                    key={index}
                    variant={option.variant || 'default'}
                    onClick={option.onClick}
                    className={option.variant === 'default' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    {option.label}
                  </Button>
                ))
              ) : (
                <>
                  <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                    Cancelar
                  </Button>
                  {confirmDialog.onConfirm && (
                    <Button onClick={confirmDialog.onConfirm} className="bg-emerald-600 hover:bg-emerald-700">
                      Confirmar
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-sm dark:bg-slate-900/90">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-xl">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">Diário do Motorista</h1>
                <p className="text-xs text-slate-500">
                  {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setActiveView('main')}
                className={activeView === 'main' ? 'bg-slate-200 dark:bg-slate-700' : ''}
              >
                Hoje
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setActiveView('history')}
                className={activeView === 'history' ? 'bg-slate-200 dark:bg-slate-700' : ''}
              >
                Histórico
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setActiveView('reports')}
                className={activeView === 'reports' ? 'bg-slate-200 dark:bg-slate-700' : ''}
              >
                Relatórios
              </Button>
              
              {/* Usuário e Logout */}
              <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{currentUser?.username}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 pb-20">
        {/* VIEW: MAIN (Dia Atual) */}
        {activeView === 'main' && (
          <div className="space-y-4">
            
            {/* STATUS DO DIA */}
            {!currentDay ? (
              /* DIA NÃO INICIADO */
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <Sun className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Bom dia, motorista!</h2>
                      <p className="text-muted-foreground">Pronto para iniciar o dia de trabalho?</p>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-3 text-left max-w-sm mx-auto">
                      {/* Matrícula do Caminhão */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Matrícula do Caminhão</Label>
                        <Input 
                          placeholder="Ex: PT-12-AB"
                          value={startForm.matricula}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase();
                            setStartForm({...startForm, matricula: value});
                            // Buscar último KM quando a matrícula estiver completa
                            if (value.length === 8) {
                              checkLastKm(value);
                            } else {
                              setLastKmInfo(null);
                            }
                          }}
                          maxLength={8}
                          className="uppercase"
                        />
                        {checkingMatricula && (
                          <p className="text-xs text-muted-foreground">Verificando último registro...</p>
                        )}
                        {lastKmInfo && lastKmInfo.found && (
                          <p className="text-xs text-emerald-600 font-medium">
                            Último KM: {lastKmInfo.lastKm?.toLocaleString()}
                          </p>
                        )}
                        {lastKmInfo && !lastKmInfo.found && (
                          <p className="text-xs text-muted-foreground">
                            Nenhum registro anterior para esta matrícula
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">Formato: AA-00-BB</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">País de Início</Label>
                          <Input 
                            placeholder="Ex: Portugal"
                            value={startForm.startCountry}
                            onChange={(e) => setStartForm({...startForm, startCountry: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            KM Inicial {lastKmInfo?.found && <span className="text-emerald-600">(mín: {lastKmInfo.lastKm?.toLocaleString()})</span>}
                          </Label>
                          <Input 
                            type="number"
                            placeholder="Ex: 125000"
                            value={startForm.startKm}
                            onChange={(e) => setStartForm({...startForm, startKm: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-sm">Check do caminhão realizado?</span>
                        <input 
                          type="checkbox" 
                          checked={startForm.truckCheck}
                          onChange={(e) => setStartForm({...startForm, truckCheck: e.target.checked})}
                          className="w-5 h-5 accent-emerald-600"
                        />
                      </div>
                      
                      <Button 
                        onClick={() => handleStartDay()}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-5 w-5 mr-2" />
                        )}
                        INICIAR DIA
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : !currentDay.endTime ? (
              /* DIA EM ANDAMENTO */
              <div className="space-y-4">
                {/* Card Principal do Dia */}
                <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className="bg-emerald-600 mb-2">
                          <Activity className="h-3 w-3 mr-1 animate-pulse" />
                          DIA EM ANDAMENTO
                        </Badge>
                        <CardTitle>{formatDate(currentDay.date)}</CardTitle>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold font-mono">{calculateWorkingTime()}</p>
                        <p className="text-xs text-muted-foreground">tempo de trabalho</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Matrícula do Caminhão */}
                    {currentDay.matricula && (
                      <div className="mb-3 text-center">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          <Truck className="h-3 w-3 mr-1" />
                          Matrícula: {currentDay.matricula}
                        </Badge>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-semibold">{formatTime(currentDay.startTime)}</p>
                        <p className="text-xs text-muted-foreground">Início</p>
                      </div>
                      <div className="text-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <MapPin className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-semibold">{currentDay.startCountry || '--'}</p>
                        <p className="text-xs text-muted-foreground">Local</p>
                      </div>
                      <div className="text-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-semibold">{currentDay.startKm?.toLocaleString() || '--'}</p>
                        <p className="text-xs text-muted-foreground">KM</p>
                      </div>
                    </div>
                    
                    {/* Status de conformidade */}
                    <div className={`p-3 rounded-lg ${
                      conformity.status === 'danger' ? 'bg-red-100 dark:bg-red-900/30' :
                      conformity.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' :
                      'bg-emerald-100 dark:bg-emerald-900/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {conformity.status === 'danger' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                          {conformity.status === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                          {conformity.status === 'ok' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                          <span className={`text-sm font-medium ${
                            conformity.status === 'danger' ? 'text-red-700 dark:text-red-300' :
                            conformity.status === 'warning' ? 'text-amber-700 dark:text-amber-300' :
                            'text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {conformity.message || 'Dentro dos limites'}
                          </span>
                        </div>
                        {currentDay.truckCheck && (
                          <Badge variant="outline" className="bg-white dark:bg-slate-800">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                            Check OK
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Adicionar Evento Rápido */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Eventos do Dia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentDay.events.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {currentDay.events.map((event) => (
                          <div key={event.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <span className="text-xs font-mono text-muted-foreground bg-white dark:bg-slate-700 px-2 py-1 rounded">
                              {event.time}
                            </span>
                            <span className="text-sm flex-1">{event.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {showEventInput ? (
                      <div className="space-y-3 p-3 border rounded-lg bg-slate-50 dark:bg-slate-800">
                        <div className="grid grid-cols-4 gap-2">
                          <Input
                            type="time"
                            value={newEvent.time}
                            onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                            placeholder="Hora"
                            className="col-span-1"
                          />
                          <Input
                            placeholder="Descreva o evento..."
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setShowEventInput(false)} className="flex-1">
                            Cancelar
                          </Button>
                          <Button onClick={handleAddEvent} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => setShowEventInput(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Evento
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Botão Finalizar Dia */}
                {!showEndForm ? (
                  <Button 
                    onClick={() => setShowEndForm(true)}
                    className="w-full bg-red-600 hover:bg-red-700 h-14 text-lg"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    FINALIZAR DIA
                  </Button>
                ) : (
                  <Card className="border-red-200 dark:border-red-800">
                    <CardHeader>
                      <CardTitle className="text-base text-red-600">Finalizar Dia de Trabalho</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">País de Fim</Label>
                          <Input 
                            placeholder="Ex: Espanha"
                            value={endForm.endCountry}
                            onChange={(e) => setEndForm({...endForm, endCountry: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">KM Final {currentDay.startKm ? `(mín: ${currentDay.startKm})` : ''}</Label>
                          <Input 
                            type="number"
                            placeholder="Ex: 125500"
                            value={endForm.endKm}
                            onChange={(e) => setEndForm({...endForm, endKm: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Observações do dia</Label>
                        <Textarea 
                          placeholder="Alguma nota sobre o dia..."
                          value={endForm.observations}
                          onChange={(e) => setEndForm({...endForm, observations: e.target.value})}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowEndForm(false)} className="flex-1">
                          Cancelar
                        </Button>
                        <Button onClick={handleEndDay} className="flex-1 bg-red-600 hover:bg-red-700">
                          <Square className="h-4 w-4 mr-2" />
                          Confirmar Fim
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              /* DIA FINALIZADO */
              <Card className="border-slate-200 dark:border-slate-700">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <Moon className="h-8 w-8 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Dia Finalizado!</h2>
                      <p className="text-muted-foreground">
                        Você trabalhou {currentDay.hoursWorked}h e percorreu {currentDay.kmTraveled || 0} km
                      </p>
                    </div>
                    <Button onClick={() => setCurrentDay(null)} className="bg-emerald-600 hover:bg-emerald-700">
                      Iniciar Novo Dia
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resumo da Semana */}
            {weeklyReport && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Resumo da Semana
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{weeklyReport.statistics.daysWorked}</p>
                      <p className="text-xs text-muted-foreground">dias</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{weeklyReport.statistics.totalHours}</p>
                      <p className="text-xs text-muted-foreground">horas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{weeklyReport.statistics.totalKm}</p>
                      <p className="text-xs text-muted-foreground">km</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* VIEW: HISTÓRICO */}
        {activeView === 'history' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Histórico de Jornadas</h2>
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                Carregando...
              </div>
            ) : workDays.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma jornada registada ainda</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-3">
                  {workDays.map((day) => (
                    <Card key={day.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${day.endTime ? 'bg-slate-100 dark:bg-slate-800' : 'bg-emerald-100 dark:bg-emerald-900'}`}>
                              {day.endTime ? (
                                <Moon className="h-4 w-4 text-indigo-500" />
                              ) : (
                                <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{formatDate(day.date)}</p>
                              <p className="text-sm text-muted-foreground">
                                {day.startTime} - {day.endTime || 'em andamento'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Botões de Ação */}
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleViewDay(day)}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditClick(day)}
                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setDeleteConfirm(day)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-center text-sm">
                          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                            <p className="font-semibold">{day.hoursWorked || '--'}h</p>
                            <p className="text-xs text-muted-foreground">tempo</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                            <p className="font-semibold">{day.kmTraveled || '--'}</p>
                            <p className="text-xs text-muted-foreground">km</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                            <p className="font-semibold">{day.events.length}</p>
                            <p className="text-xs text-muted-foreground">eventos</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                            <p className="font-semibold">{day.startCountry || '--'}</p>
                            <p className="text-xs text-muted-foreground">para {day.endCountry || '--'}</p>
                          </div>
                        </div>
                        
                        {day.truckCheck && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                              Check realizado
                            </Badge>
                          </div>
                        )}
                        
                        {day.matricula && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                              <Truck className="h-3 w-3 mr-1" />
                              {day.matricula}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* VIEW: RELATÓRIOS */}
        {activeView === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Relatórios</h2>
            
            {/* Relatório Semanal */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Esta Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyReport && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                        <p className="text-2xl font-bold">{weeklyReport.statistics.daysWorked}</p>
                        <p className="text-xs text-muted-foreground">dias trabalhados</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                        <p className="text-2xl font-bold">{weeklyReport.statistics.totalHours}h</p>
                        <p className="text-xs text-muted-foreground">total de horas</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                        <p className="text-2xl font-bold">{weeklyReport.statistics.totalKm}</p>
                        <p className="text-xs text-muted-foreground">km percorridos</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                        <p className="text-2xl font-bold">{weeklyReport.statistics.avgHoursPerDay}h</p>
                        <p className="text-xs text-muted-foreground">média/dia</p>
                      </div>
                    </div>
                    
                    {weeklyReport.alerts.length > 0 && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="text-sm">
                            {weeklyReport.alerts.map((a, i) => <li key={i}>• {a}</li>)}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Conformidade */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Limites Legais (Reg. CE 561/2006)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span>Condução diária máxima</span>
                    <Badge>9h (10h 2x/semana)</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span>Condução semanal máxima</span>
                    <Badge>56h</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span>Condução contínua</span>
                    <Badge>4h30 → pausa 45min</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span>Descanso diário</span>
                    <Badge>11h (9h 3x/semana)</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Diálogo: Visualizar Registro */}
      {viewingDay && (
        <Dialog open={!!viewingDay} onOpenChange={() => setViewingDay(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Detalhes da Jornada
              </DialogTitle>
              <DialogDescription>
                {formatDate(viewingDay.date)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Horários */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">Início</p>
                  <p className="font-semibold">{viewingDay.startTime}</p>
                  {viewingDay.startCountry && <p className="text-xs text-muted-foreground">{viewingDay.startCountry}</p>}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">Fim</p>
                  <p className="font-semibold">{viewingDay.endTime || '--:--'}</p>
                  {viewingDay.endCountry && <p className="text-xs text-muted-foreground">{viewingDay.endCountry}</p>}
                </div>
              </div>
              
              {/* KM */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">KM Inicial</p>
                  <p className="font-semibold">{viewingDay.startKm?.toLocaleString() || '--'}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">KM Final</p>
                  <p className="font-semibold">{viewingDay.endKm?.toLocaleString() || '--'}</p>
                </div>
              </div>
              
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded">
                  <p className="font-bold text-emerald-600">{viewingDay.hoursWorked || '--'}h</p>
                  <p className="text-xs text-muted-foreground">trabalhadas</p>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
                  <p className="font-bold text-blue-600">{viewingDay.kmTraveled || '--'}</p>
                  <p className="text-xs text-muted-foreground">km</p>
                </div>
                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded">
                  <p className="font-bold text-amber-600">{viewingDay.events.length}</p>
                  <p className="text-xs text-muted-foreground">eventos</p>
                </div>
              </div>
              
              {/* Eventos */}
              {viewingDay.events.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Eventos do dia:</p>
                  <div className="space-y-2 max-h-40 overflow-auto">
                    {viewingDay.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{event.time}</span>
                        <span>{event.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Observações */}
              {viewingDay.observations && (
                <div>
                  <p className="text-sm font-medium mb-1">Observações:</p>
                  <p className="text-sm text-muted-foreground bg-slate-50 dark:bg-slate-800 p-2 rounded">
                    {viewingDay.observations}
                  </p>
                </div>
              )}
              
              {viewingDay.truckCheck && (
                <Badge variant="outline" className="w-full justify-center py-2">
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                  Check do caminhão realizado
                </Badge>
              )}
              
              {viewingDay.matricula && (
                <Badge variant="outline" className="w-full justify-center py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  <Truck className="h-4 w-4 mr-2" />
                  Matrícula: {viewingDay.matricula}
                </Badge>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingDay(null)}>
                Fechar
              </Button>
              <Button onClick={() => {
                setViewingDay(null);
                handleEditClick(viewingDay);
              }} className="bg-amber-600 hover:bg-amber-700">
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo: Editar Registro */}
      {editingDay && (
        <Dialog open={!!editingDay} onOpenChange={() => setEditingDay(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-amber-600" />
                Editar Jornada
              </DialogTitle>
              <DialogDescription>
                Altere os dados do registro conforme necessário
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input 
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora Início</Label>
                  <Input 
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({...editForm, startTime: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hora Fim</Label>
                  <Input 
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({...editForm, endTime: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">País Início</Label>
                  <Input 
                    placeholder="Ex: Portugal"
                    value={editForm.startCountry}
                    onChange={(e) => setEditForm({...editForm, startCountry: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">País Fim</Label>
                  <Input 
                    placeholder="Ex: Espanha"
                    value={editForm.endCountry}
                    onChange={(e) => setEditForm({...editForm, endCountry: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">KM Inicial</Label>
                  <Input 
                    type="number"
                    placeholder="Ex: 125000"
                    value={editForm.startKm}
                    onChange={(e) => setEditForm({...editForm, startKm: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">KM Final</Label>
                <Input 
                  type="number"
                  placeholder="Ex: 125500"
                  value={editForm.endKm}
                  onChange={(e) => setEditForm({...editForm, endKm: e.target.value})}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Matrícula do Caminhão</Label>
                <Input 
                  placeholder="Ex: PT-12-AB"
                  value={editForm.matricula}
                  onChange={(e) => setEditForm({...editForm, matricula: e.target.value.toUpperCase()})}
                  maxLength={8}
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground">Formato: AA-00-BB</p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea 
                  placeholder="Notas adicionais..."
                  value={editForm.observations}
                  onChange={(e) => setEditForm({...editForm, observations: e.target.value})}
                  rows={2}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDay(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo: Confirmar Exclusão */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Excluir Jornada
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a jornada de {formatDate(deleteConfirm.date)}?
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300">
              ⚠️ Esta ação não pode ser desfeita. Todos os eventos associados também serão excluídos.
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button onClick={handleDeleteDay} variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t bg-white/90 backdrop-blur-sm dark:bg-slate-900/90 py-2 text-center text-xs text-muted-foreground">
        Diário do Motorista • Conformidade com Reg. CE 561/2006
      </footer>
    </div>
  );
}
