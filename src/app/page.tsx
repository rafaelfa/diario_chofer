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
  Eye, Pencil, Trash2, Save, Download, BarChart3, History, Car,
  Navigation, Wifi, WifiOff, Pause, FastForward, Menu
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGeolocation } from '@/hooks/use-geolocation';

// Tipos
interface Event {
  id: string;
  workDayId: string;
  time: string;
  description: string;
}

interface DrivingSession {
  id: string;
  workDayId: string;
  startTime: string;
  endTime: string | null;
  startKm: number | null;
  endKm: number | null;
  status: string;
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
  isPaused: boolean;
  events: Event[];
  drivingSessions?: DrivingSession[];
  kmTraveled: number | null;
  hoursWorked: number | null;
  totalEvents: number;
  lastSessionKm?: number | null;
  sessionCount?: number;
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

interface VehicleStats {
  matricula: string;
  viagens: number;
  diasTrabalhados: number;
  totalKm: number;
  totalHoras: number;
  mediaKmPorDia: number;
  mediaHorasPorDia: number;
  totalEventos: number;
  kmInicial: number | null;
  kmFinal: number | null;
  primeiroRegistro: string;
  ultimoRegistro: string;
  paises: string[];
  checksRealizados: number;
}

interface VehicleHistory {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  startKm: number | null;
  endKm: number | null;
  kmTraveled: number | null;
  startCountry: string | null;
  endCountry: string | null;
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
  
  // Estados para relatórios de veículos
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehicleHistory, setVehicleHistory] = useState<VehicleHistory[]>([]);
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>('weekly');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  
  // Estado de conexão e geolocalização
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState<number>(0);
  const { country: gpsCountry, loading: loadingGps, error: gpsError, getLocation } = useGeolocation();
  
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
  
  // Estados para pausar/retomar condução
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseKm, setPauseKm] = useState('');
  const [isProcessingPause, setIsProcessingPause] = useState(false);
  
  // Estado para menu mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Formatar matrícula automaticamente (AA-00-BB)
  const formatMatricula = (value: string): string => {
    // Remove tudo que não é letra ou número
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Aplica o formato AA-00-BB
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 4) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
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

  // ==================== PAUSAR / RETOMAR CONDUÇÃO ====================
  
  // Abrir diálogo de pausa
  const handleOpenPauseDialog = () => {
    if (!currentDay) return;
    // Pré-preencher com o último KM conhecido
    const lastKm = currentDay.lastSessionKm || currentDay.startKm || 0;
    setPauseKm(lastKm ? lastKm.toString() : '');
    setShowPauseDialog(true);
  };

  // Pausar condução (outro motorista assume)
  const handlePauseDriving = async () => {
    if (!currentDay) return;
    
    const kmValue = pauseKm ? parseInt(pauseKm) : null;
    
    if (!kmValue) {
      showToast('Por favor, informe o KM atual', 'warning');
      return;
    }
    
    setIsProcessingPause(true);
    try {
      const res = await fetch('/api/driving-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDayId: currentDay.id,
          action: 'pause',
          currentKm: kmValue
        })
      });

      if (res.ok) {
        const updatedDay = await res.json();
        setCurrentDay(updatedDay);
        setShowPauseDialog(false);
        setPauseKm('');
        loadData();
        showToast('Condução pausada - outro motorista pode assumir', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || 'Erro ao pausar condução', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão', 'error');
    } finally {
      setIsProcessingPause(false);
    }
  };

  // Retomar condução
  const handleResumeDriving = async () => {
    if (!currentDay) return;
    
    // Pré-preencher com o último KM da sessão anterior
    const lastKm = currentDay.lastSessionKm || currentDay.startKm || 0;
    setPauseKm(lastKm ? lastKm.toString() : '');
    setShowPauseDialog(true);
  };

  // Confirmar retomada com KM atual
  const handleConfirmResume = async () => {
    if (!currentDay) return;
    
    const kmValue = pauseKm ? parseInt(pauseKm) : null;
    
    if (!kmValue) {
      showToast('Por favor, informe o KM atual do veículo', 'warning');
      return;
    }
    
    setIsProcessingPause(true);
    try {
      const res = await fetch('/api/driving-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDayId: currentDay.id,
          action: 'resume',
          currentKm: kmValue
        })
      });

      if (res.ok) {
        const updatedDay = await res.json();
        setCurrentDay(updatedDay);
        setShowPauseDialog(false);
        setPauseKm('');
        loadData();
        showToast('Condução retomada!', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || 'Erro ao retomar condução', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão', 'error');
    } finally {
      setIsProcessingPause(false);
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

  // ==================== FUNÇÕES DE VEÍCULOS ====================

  // Carregar estatísticas de veículos
  const loadVehicleStats = async () => {
    setLoadingVehicles(true);
    try {
      const res = await fetch('/api/veiculos/estatisticas');
      if (res.ok) {
        const data = await res.json();
        setVehicleStats(data.veiculos);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };

  // Carregar histórico de um veículo específico
  const loadVehicleHistory = async (matricula: string) => {
    setLoadingVehicles(true);
    try {
      const res = await fetch(`/api/veiculos/historico?matricula=${encodeURIComponent(matricula)}`);
      if (res.ok) {
        const data = await res.json();
        setVehicleHistory(data.historico);
        setSelectedVehicle(matricula);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };

  // Gerar PDF - versão corrigida para mobile
  const generatePdf = async (type: 'weekly' | 'monthly', matricula?: string) => {
    setLoadingPdf(true);
    try {
      const params = new URLSearchParams({ type });
      if (matricula) params.append('matricula', matricula);
      
      // Adicionar datas personalizadas se definidas
      if (showCustomDate && customDateStart && customDateEnd) {
        params.append('date', customDateEnd); // API usa essa data como referência
        params.append('startDate', customDateStart);
        params.append('endDate', customDateEnd);
      }
      
      const res = await fetch(`/api/reports/pdf?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        
        // Criar arquivo HTML para download (funciona em mobile)
        const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Criar link de download
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-diario-motorista-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Relatório baixado! Abra o arquivo para imprimir.', 'success');
      }
    } catch (error) {
      showToast('Erro ao gerar relatório', 'error');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Verificar status inicial
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Preencher país automaticamente quando GPS detectar
  useEffect(() => {
    if (gpsCountry && !startForm.startCountry && !loadingGps) {
      setStartForm(prev => ({ ...prev, startCountry: gpsCountry }));
      showToast(`País detectado: ${gpsCountry}`, 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsCountry, loadingGps]);

  // Detectar país automaticamente quando abrir o formulário de fim de dia
  useEffect(() => {
    if (showEndForm && !endForm.endCountry) {
      getLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEndForm]);

  // Preencher país no fim do dia quando GPS detectar
  useEffect(() => {
    if (gpsCountry && showEndForm && !endForm.endCountry && !loadingGps) {
      setEndForm(prev => ({ ...prev, endCountry: gpsCountry }));
      showToast(`País de fim detectado: ${gpsCountry}`, 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsCountry, loadingGps, showEndForm]);

  // Carregar estatísticas quando mudar para view de relatórios
  useEffect(() => {
    if (activeView === 'reports') {
      loadVehicleStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

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
        <div className="container mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            {/* Logo e Título */}
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 p-1.5 rounded-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white">Diário do Motorista</h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            
            {/* Status Online/Offline - visível sempre */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              isOnline 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' 
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
              {isOnline ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
            </div>
            
            {/* Menu Desktop - oculto no mobile */}
            <div className="hidden sm:flex items-center gap-1">
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
              <div className="flex items-center gap-2 ml-2 pl-2 border-l">
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
            
            {/* Menu Hambúrguer - visível apenas no mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="sm:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Menu Mobile Expandido */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-2 pt-2 border-t space-y-1">
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  setActiveView('main');
                  setMobileMenuOpen(false);
                }}
              >
                <Sun className="h-4 w-4 mr-2" />
                Hoje
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  setActiveView('history');
                  setMobileMenuOpen(false);
                }}
              >
                <History className="h-4 w-4 mr-2" />
                Histórico
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  setActiveView('reports');
                  setMobileMenuOpen(false);
                }}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Relatórios
              </Button>
              <Separator className="my-2" />
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{currentUser?.username}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Sair
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-3 py-3 pb-20">
        {/* VIEW: MAIN (Dia Atual) */}
        {activeView === 'main' && (
          <div className="space-y-3">
            
            {/* STATUS DO DIA */}
            {!currentDay ? (
              /* DIA NÃO INICIADO */
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="bg-slate-100 dark:bg-slate-800 w-14 h-14 rounded-full flex items-center justify-center mx-auto">
                      <Sun className="h-7 w-7 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Bom dia, motorista!</h2>
                      <p className="text-sm text-muted-foreground">Pronto para iniciar o dia?</p>
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
                            const formatted = formatMatricula(e.target.value);
                            setStartForm({...startForm, matricula: formatted});
                            // Buscar último KM quando a matrícula estiver completa
                            if (formatted.length === 8) {
                              checkLastKm(formatted);
                            } else {
                              setLastKmInfo(null);
                            }
                          }}
                          maxLength={8}
                          className="uppercase text-center font-mono text-lg tracking-wider"
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
                          <div className="flex gap-1">
                            <Input 
                              placeholder="Ex: Portugal"
                              value={startForm.startCountry}
                              onChange={(e) => setStartForm({...startForm, startCountry: e.target.value})}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => getLocation()}
                              disabled={loadingGps}
                              title="Detectar país via GPS"
                              className="shrink-0"
                            >
                              {loadingGps ? (
                                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                              ) : (
                                <Navigation className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                          </div>
                          {gpsError && <p className="text-xs text-red-500">{gpsError}</p>}
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

                {/* Botões de Pausar/Retomar Condução (para dupla de motoristas) */}
                {currentDay.isPaused ? (
                  <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
                    <CardContent className="pt-4">
                      <div className="text-center space-y-3">
                        <div className="flex items-center justify-center gap-2 text-amber-600">
                          <Pause className="h-5 w-5" />
                          <span className="font-medium">Condução Pausada</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Outro motorista está dirigindo
                        </p>
                        {currentDay.lastSessionKm && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Último KM registrado:</span>{' '}
                            <span className="font-semibold">{currentDay.lastSessionKm.toLocaleString()}</span>
                          </p>
                        )}
                        <Button 
                          onClick={handleResumeDriving}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          <FastForward className="h-4 w-4 mr-2" />
                          RETOMAR CONDUÇÃO
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Button 
                    onClick={handleOpenPauseDialog}
                    variant="outline"
                    className="w-full h-12 border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    PAUSAR CONDUÇÃO (outro motorista assume)
                  </Button>
                )}

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
                        {/* Layout mobile-friendly: hora em linha separada */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Clock className="h-3 w-3" />
                              <span>Hora:</span>
                            </div>
                            <Input
                              type="time"
                              value={newEvent.time}
                              onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                              className="flex-1 h-10 text-base"
                            />
                          </div>
                          <Input
                            placeholder="Descreva o evento..."
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                            className="h-11"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setShowEventInput(false)} className="flex-1 h-10">
                            Cancelar
                          </Button>
                          <Button onClick={handleAddEvent} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-10">
                            <Plus className="h-4 w-4 mr-1" />
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
                          <div className="flex gap-1">
                            <Input 
                              placeholder="Ex: Espanha"
                              value={endForm.endCountry}
                              onChange={(e) => setEndForm({...endForm, endCountry: e.target.value})}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => getLocation()}
                              disabled={loadingGps}
                              title="Detectar país via GPS"
                              className="shrink-0"
                            >
                              {loadingGps ? (
                                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                              ) : (
                                <Navigation className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">KM Final {currentDay.lastSessionKm ? `(último: ${currentDay.lastSessionKm.toLocaleString()})` : currentDay.startKm ? `(mín: ${currentDay.startKm})` : ''}</Label>
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
                            <p className="font-semibold">{day.kmTraveled ? day.kmTraveled.toLocaleString() : '--'}</p>
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
                        
                        {/* Indicador de sessões múltiplas */}
                        {day.sessionCount && day.sessionCount > 1 && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                              <Activity className="h-3 w-3 mr-1" />
                              {day.sessionCount} turnos de condução
                            </Badge>
                          </div>
                        )}
                        
                        {/* Status pausado */}
                        {day.isPaused && !day.endTime && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                              <Pause className="h-3 w-3 mr-1" />
                              Condução pausada
                            </Badge>
                          </div>
                        )}
                        
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Relatórios</h2>
              <div className="flex gap-2">
                <Button 
                  variant={reportType === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReportType('weekly')}
                  className={reportType === 'weekly' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  Semanal
                </Button>
                <Button 
                  variant={reportType === 'monthly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReportType('monthly')}
                  className={reportType === 'monthly' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  Mensal
                </Button>
              </div>
            </div>

            {/* Gerar PDF */}
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="pt-4 space-y-4">
                {/* Tipo de relatório */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Gerar Relatório</p>
                      <p className="text-xs text-muted-foreground">Download em HTML para impressão</p>
                    </div>
                  </div>
                </div>
                
                {/* Opções de período */}
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant={!showCustomDate && reportType === 'weekly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setReportType('weekly'); setShowCustomDate(false); }}
                      className={!showCustomDate && reportType === 'weekly' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      Semana
                    </Button>
                    <Button 
                      variant={!showCustomDate && reportType === 'monthly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setReportType('monthly'); setShowCustomDate(false); }}
                      className={!showCustomDate && reportType === 'monthly' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      Mês
                    </Button>
                    <Button 
                      variant={showCustomDate ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowCustomDate(!showCustomDate)}
                      className={showCustomDate ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Período
                    </Button>
                  </div>
                  
                  {/* Seletor de datas personalizadas */}
                  {showCustomDate && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-xs">Data Início</Label>
                        <Input 
                          type="date"
                          value={customDateStart}
                          onChange={(e) => setCustomDateStart(e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Data Fim</Label>
                        <Input 
                          type="date"
                          value={customDateEnd}
                          onChange={(e) => setCustomDateEnd(e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Botão de gerar */}
                  <Button 
                    onClick={() => generatePdf(reportType)}
                    disabled={loadingPdf || (showCustomDate && (!customDateStart || !customDateEnd))}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-12"
                  >
                    {loadingPdf ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {showCustomDate ? 'Gerar PDF (Período)' : `Gerar PDF ${reportType === 'weekly' ? 'Semanal' : 'Mensal'}`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas por Veículo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Estatísticas por Veículo
                </CardTitle>
                <CardDescription>
                  Clique em um veículo para ver o histórico detalhado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVehicles ? (
                  <div className="text-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : vehicleStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum veículo registado ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vehicleStats.map((v) => (
                      <div 
                        key={v.matricula}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedVehicle === v.matricula 
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                            : 'hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                        onClick={() => loadVehicleHistory(v.matricula)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold">{v.matricula}</span>
                          </div>
                          <Badge variant="outline">{v.viagens} viagens</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-sm">
                          <div>
                            <p className="font-bold">{v.totalKm.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">km</p>
                          </div>
                          <div>
                            <p className="font-bold">{v.totalHoras}h</p>
                            <p className="text-xs text-muted-foreground">horas</p>
                          </div>
                          <div>
                            <p className="font-bold">{v.mediaKmPorDia}</p>
                            <p className="text-xs text-muted-foreground">km/dia</p>
                          </div>
                          <div>
                            <p className="font-bold">{v.kmFinal?.toLocaleString() || '-'}</p>
                            <p className="text-xs text-muted-foreground">KM atual</p>
                          </div>
                        </div>
                        {v.paises.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {v.paises.map((pais, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{pais}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico do Veículo Selecionado */}
            {selectedVehicle && vehicleHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Histórico: {selectedVehicle}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => generatePdf(reportType, selectedVehicle)}
                        disabled={loadingPdf}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        PDF
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => { setSelectedVehicle(null); setVehicleHistory([]); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {vehicleHistory.map((h) => (
                        <div key={h.id} className="p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{new Date(h.date).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                            <span className="text-xs text-muted-foreground">
                              {h.startTime} - {h.endTime || 'em curso'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>{h.startCountry || '--'} → {h.endCountry || '--'}</span>
                            <span className="font-semibold">{h.kmTraveled || '--'} km</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Resumo Semanal/Mensal */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Resumo {reportType === 'weekly' ? 'Semanal' : 'Mensal'}
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Detalhes da Jornada
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                {formatDate(viewingDay.date)}
                {viewingDay.matricula && (
                  <Badge variant="outline" className="ml-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    <Truck className="h-3 w-3 mr-1" />
                    {viewingDay.matricula}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Resumo Total */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                  <p className="text-xl font-bold text-emerald-600">{viewingDay.hoursWorked || '--'}h</p>
                  <p className="text-xs text-muted-foreground">trabalhadas</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-xl font-bold text-blue-600">{viewingDay.kmTraveled || '--'}</p>
                  <p className="text-xs text-muted-foreground">km total</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <p className="text-xl font-bold text-purple-600">{viewingDay.sessionCount || 1}</p>
                  <p className="text-xs text-muted-foreground">turno{(viewingDay.sessionCount || 1) > 1 ? 's' : ''}</p>
                </div>
              </div>
              
              {/* Timeline de Turnos */}
              <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Turnos de Condução
                </p>
                
                {viewingDay.drivingSessions && viewingDay.drivingSessions.length > 0 ? (
                  <div className="space-y-3">
                    {viewingDay.drivingSessions.map((session, index) => {
                      // Calcular KM e duração da sessão
                      const sessionKm = session.startKm && session.endKm 
                        ? session.endKm - session.startKm 
                        : null;
                      
                      // Calcular duração
                      let sessionDuration = '';
                      if (session.startTime && session.endTime) {
                        const [startH, startM] = session.startTime.split(':').map(Number);
                        const [endH, endM] = session.endTime.split(':').map(Number);
                        let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
                        if (diffMins < 0) diffMins += 24 * 60;
                        const hours = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        sessionDuration = `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
                      }
                      
                      const isPaused = session.status === 'paused';
                      const isActive = session.status === 'active';
                      
                      return (
                        <div key={session.id}>
                          {/* Linha do tempo */}
                          <div className="flex items-start gap-3">
                            {/* Indicador visual */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                isPaused ? 'bg-amber-500' : isActive ? 'bg-emerald-500' : 'bg-emerald-600'
                              }`}>
                                {index + 1}
                              </div>
                              {index < (viewingDay.drivingSessions?.length || 0) - 1 && (
                                <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600 my-1" />
                              )}
                            </div>
                            
                            {/* Conteúdo do turno */}
                            <div className={`flex-1 p-3 rounded-lg border ${
                              isPaused 
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={
                                    isPaused 
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300'
                                  }>
                                    {isPaused ? '⏸ Pausado' : isActive ? '▶ Em curso' : '✓ Concluído'}
                                  </Badge>
                                  {sessionDuration && (
                                    <span className="text-xs text-muted-foreground font-mono">{sessionDuration}</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Horários */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-sm font-semibold">{session.startTime}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-mono text-sm font-semibold">{session.endTime || '--:--'}</span>
                              </div>
                              
                              {/* KM */}
                              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="bg-slate-100 dark:bg-slate-700 rounded p-1.5">
                                  <p className="text-muted-foreground">KM Início</p>
                                  <p className="font-semibold">{session.startKm?.toLocaleString() || '--'}</p>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-700 rounded p-1.5">
                                  <p className="text-muted-foreground">KM Fim</p>
                                  <p className="font-semibold">{session.endKm?.toLocaleString() || '--'}</p>
                                </div>
                                <div className={`rounded p-1.5 ${sessionKm ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                  <p className="text-muted-foreground">Percorrido</p>
                                  <p className="font-semibold">{sessionKm ? `${sessionKm} km` : '--'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Indicador de pausa entre turnos */}
                          {index < (viewingDay.drivingSessions?.length || 0) - 1 && (
                            <div className="ml-4 my-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600" />
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                ⏸ Pausa / Troca de motorista
                              </span>
                              <div className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Jornada simples (sem sessões registradas) */
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                      1
                    </div>
                    <div className="flex-1 p-3 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300">
                          ✓ Turno Único
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-semibold">{viewingDay.startTime}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono text-sm font-semibold">{viewingDay.endTime || '--:--'}</span>
                        {viewingDay.startCountry && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({viewingDay.startCountry} → {viewingDay.endCountry || '?'})
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-100 dark:bg-slate-700 rounded p-1.5">
                          <p className="text-muted-foreground">KM Início</p>
                          <p className="font-semibold">{viewingDay.startKm?.toLocaleString() || '--'}</p>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-700 rounded p-1.5">
                          <p className="text-muted-foreground">KM Fim</p>
                          <p className="font-semibold">{viewingDay.endKm?.toLocaleString() || '--'}</p>
                        </div>
                        <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded p-1.5">
                          <p className="text-muted-foreground">Percorrido</p>
                          <p className="font-semibold">{viewingDay.kmTraveled || '--'} km</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Legenda */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>Concluído</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Em curso</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Pausado</span>
                </div>
              </div>
              
              {/* Eventos */}
              {viewingDay.events.length > 0 && (
                <div className="border rounded-lg p-3">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Eventos do dia ({viewingDay.events.length})
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-auto">
                    {viewingDay.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                        <Badge variant="outline" className="font-mono text-xs">{event.time}</Badge>
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
              
              {/* Check do caminhão */}
              {viewingDay.truckCheck && (
                <Badge variant="outline" className="w-full justify-center py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Check do caminhão realizado ✓
                </Badge>
              )}
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setViewingDay(null)} className="w-full sm:w-auto">
                Fechar
              </Button>
              <Button onClick={() => {
                setViewingDay(null);
                handleEditClick(viewingDay);
              }} className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto">
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

      {/* Diálogo: Pausar/Retomar Condução */}
      {showPauseDialog && currentDay && (
        <Dialog open={showPauseDialog} onOpenChange={() => setShowPauseDialog(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                {currentDay.isPaused ? <FastForward className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                {currentDay.isPaused ? 'Retomar Condução' : 'Pausar Condução'}
              </DialogTitle>
              <DialogDescription>
                {currentDay.isPaused 
                  ? 'Informe o KM atual do veículo para retomar sua condução.'
                  : 'Informe o KM atual para registrar o fim do seu turno. O outro motorista pode assumir.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Mostrar último KM conhecido */}
              {(currentDay.lastSessionKm || currentDay.startKm) && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Último KM registrado:</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {(currentDay.lastSessionKm || currentDay.startKm)?.toLocaleString()}
                  </p>
                </div>
              )}
              
              <div className="space-y-1">
                <Label className="text-xs">KM Atual do Veículo</Label>
                <Input 
                  type="number"
                  placeholder="Ex: 125500"
                  value={pauseKm}
                  onChange={(e) => setPauseKm(e.target.value)}
                  className="text-lg"
                />
              </div>
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowPauseDialog(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button 
                onClick={currentDay.isPaused ? handleConfirmResume : handlePauseDriving}
                disabled={isProcessingPause}
                className={`w-full sm:w-auto ${currentDay.isPaused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {isProcessingPause ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : currentDay.isPaused ? (
                  <FastForward className="h-4 w-4 mr-2" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                {currentDay.isPaused ? 'Retomar' : 'Pausar'}
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
