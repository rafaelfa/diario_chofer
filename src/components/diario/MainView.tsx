'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Truck, Play, Square, Plus, Clock, MapPin, Gauge,
  CheckCircle2, Calendar, FileText,
  Sun, Moon, Activity, AlertCircle, RefreshCw,
  Navigation, Pause, FastForward, Users,
} from 'lucide-react';
import type { WorkDay, Report } from '@/lib/types';
import { formatDecimalHours } from '@/lib/time';
import { MatriculaPlateInput } from '@/components/MatriculaPlateInput';
import { AmplitudeCard } from '@/components/AmplitudeCard';
import { CircularTimeCounter } from '@/components/diario/CircularTimeCounter';
import { DayTimeline } from '@/components/diario/DayTimeline';
import { TrafficLightStatus } from '@/components/diario/TrafficLightStatus';
import { WeeklyBars } from '@/components/diario/WeeklyBars';
import { BreakTimer } from '@/components/diario/BreakTimer';
import type {
  ConformityStatus,
  WorkingTimeResult,
  StartFormState,
  EndFormState,
  NewEventState,
  LastKmInfo,
  BreakState,
} from '@/hooks/useDiarioActions';

interface MainViewProps {
  currentDay: WorkDay | null;
  isLoading: boolean;
  weeklyReport: Report | null;
  conformity: ConformityStatus;
  workingTime: WorkingTimeResult;
  startForm: StartFormState;
  setStartForm: React.Dispatch<React.SetStateAction<StartFormState>>;
  endForm: EndFormState;
  setEndForm: React.Dispatch<React.SetStateAction<EndFormState>>;
  newEvent: NewEventState;
  setNewEvent: React.Dispatch<React.SetStateAction<NewEventState>>;
  showEventInput: boolean;
  setShowEventInput: (v: boolean) => void;
  showEndForm: boolean;
  setShowEndForm: (v: boolean) => void;
  lastKmInfo: LastKmInfo | null;
  setLastKmInfo: (v: LastKmInfo | null) => void;
  checkingMatricula: boolean;
  gpsCountry: string;
  loadingGps: boolean;
  gpsError: string | null;
  getLocation: () => void;
  formatTime: (time: string | null) => string;
  formatDate: (dateStr: string) => string;
  checkLastKm: (matricula: string) => void;
  onStartDay: () => Promise<void>;
  onEndDay: () => Promise<void>;
  onAddEvent: () => Promise<void>;
  onPauseDriving: () => Promise<void>;
  onResumeDriving: () => void;
  onOpenPauseDialog: () => void;
  onLoadWorkDays: () => Promise<void>;
  isStarting?: boolean;
  isEnding?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  // Break (1 driver)
  breakState: BreakState;
  /** Total de minutos de pausa (concluídas + em curso) — v4.1.5 */
  breakMinutes: number;
  onOpenBreak: () => void;
  onStartBreak: (type: 'continuous' | 'split') => void;
  onEndBreak: () => void;
}

export function MainView({
  currentDay, isLoading, weeklyReport, conformity, workingTime,
  startForm, setStartForm,
  endForm, setEndForm,
  newEvent, setNewEvent,
  showEventInput, setShowEventInput,
  showEndForm, setShowEndForm,
  lastKmInfo, setLastKmInfo,
  checkingMatricula,
  gpsCountry, loadingGps, gpsError, getLocation,
  formatTime, formatDate, checkLastKm,
  onStartDay, onEndDay, onAddEvent,
  onPauseDriving, onResumeDriving, onOpenPauseDialog,
  onLoadWorkDays,
  isStarting,
  isEnding,
  isSaving,
  breakState,
  breakMinutes,
  onOpenBreak,
  onStartBreak,
  onEndBreak,
}: MainViewProps) {
  // Refs for auto-focus after matricula completion
  const startCountryInputRef = useRef<HTMLInputElement>(null);
  const startKmInputRef = useRef<HTMLInputElement>(null);
  const breakTimerRef = useRef<HTMLDivElement>(null);

  // Scroll to break timer when it appears on mobile
  useEffect(() => {
    if (breakState.isActive && currentDay?.numDrivers === 1 && breakTimerRef.current) {
      // Small delay to ensure the element is rendered
      setTimeout(() => {
        breakTimerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [breakState.isActive, breakState.type, currentDay?.numDrivers]);

  const handleMatriculaComplete = useCallback(() => {
    // Focus País de Início if not filled, otherwise focus KM Inicial
    if (!startForm.startCountry) {
      startCountryInputRef.current?.focus();
    } else {
      startKmInputRef.current?.focus();
    }
  }, [startForm.startCountry]);

  return (
    <div className="space-y-4">
      {!currentDay ? (
        /* DIA NÃO INICIADO */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700 h-full">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <Sun className="h-10 w-10 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Bom dia, motorista!</h2>
                    <p className="text-sm text-muted-foreground">Pronto para iniciar o dia?</p>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-4 text-left max-w-md mx-auto lg:max-w-lg">
                    {/* Matrícula */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Matrícula do Caminhão
                        <span className="text-red-500 font-bold">*</span>
                        <span className="text-[10px] text-red-500 font-medium">obrigatório</span>
                      </Label>
                      <MatriculaPlateInput
                        value={startForm.matricula}
                        onChange={(val) => {
                          setStartForm({ ...startForm, matricula: val, startKm: '' });
                          if (val.replace(/[^A-Z0-9]/g, '').length === 6) {
                            checkLastKm(val);
                          } else {
                            setLastKmInfo(null);
                          }
                        }}
                        onComplete={handleMatriculaComplete}
                      />
                      {checkingMatricula && (
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Consultando último registro desta matrícula...
                        </div>
                      )}
                      {lastKmInfo && lastKmInfo.found && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            Último KM registado: {lastKmInfo.lastKm?.toLocaleString()}
                          </p>
                          {lastKmInfo.date && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              em {new Date(lastKmInfo.date).toLocaleDateString('pt-PT')} às {lastKmInfo.endTime || '--:--'}
                            </p>
                          )}
                        </div>
                      )}
                      {lastKmInfo && !lastKmInfo.found && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          {lastKmInfo.message || 'Nenhum registro anterior encontrado para esta matrícula'}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          País de Início
                          <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <div className="flex gap-1">
                          <Input
                            ref={startCountryInputRef}
                            placeholder="Portugal"
                            value={startForm.startCountry}
                            onChange={(e) => setStartForm({ ...startForm, startCountry: e.target.value })}
                            className="flex-1 h-12 text-base"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => getLocation()}
                            disabled={loadingGps}
                            title="Detectar país via GPS"
                            className="shrink-0 h-12 w-12"
                          >
                            {loadingGps ? (
                              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                            ) : (
                              <Navigation className="h-5 w-5 text-blue-600" />
                            )}
                          </Button>
                        </div>
                        {gpsError && <p className="text-xs text-red-500">{gpsError}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Gauge className="h-3 w-3" />
                          KM Inicial
                        </Label>
                        <Input
                          ref={startKmInputRef}
                          type="number"
                          placeholder="125000"
                          value={startForm.startKm}
                          onChange={(e) => setStartForm({ ...startForm, startKm: e.target.value })}
                          className="h-12 text-base"
                        />
                        {lastKmInfo?.found && lastKmInfo.lastKm && (
                          <p className="text-[10px] text-emerald-600 font-medium">Último: {lastKmInfo.lastKm.toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${startForm.truckCheck ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          {startForm.truckCheck ? (
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          ) : (
                            <Truck className="h-5 w-5 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium">
                            Check do caminhão
                            <span className="text-red-500 font-bold ml-1">*</span>
                          </span>
                          <p className="text-xs text-muted-foreground">Realizou a verificação?</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={startForm.truckCheck}
                        onChange={(e) => setStartForm({ ...startForm, truckCheck: e.target.checked })}
                        className="w-6 h-6 accent-emerald-600 rounded"
                      />
                    </div>

                    {/* Número de Motoristas */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">Motoristas</span>
                          <p className="text-xs text-muted-foreground">Equipa de condução</p>
                        </div>
                      </div>
                      <div className="flex gap-1 bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setStartForm({ ...startForm, numDrivers: 1 })}
                          className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                            startForm.numDrivers === 1
                              ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          1
                        </button>
                        <button
                          type="button"
                          onClick={() => setStartForm({ ...startForm, numDrivers: 2 })}
                          className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                            startForm.numDrivers === 2
                              ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          2
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Hora do Último Descanso
                      </Label>
                      <Input
                        type="time"
                        value={startForm.lastRest}
                        onChange={(e) => setStartForm({ ...startForm, lastRest: e.target.value })}
                        className="h-12 text-base"
                      />
                    </div>

                    <Button
                      onClick={() => onStartDay()}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 h-16 text-lg font-bold shadow-lg"
                      disabled={isLoading || isStarting}
                    >
                      {isLoading || isStarting ? (
                        <RefreshCw className="h-6 w-6 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-6 w-6 mr-2" />
                      )}
                      INICIAR DIA
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="hidden lg:block">
            <AmplitudeCard startTime={null} endTime={null} numDrivers={startForm.numDrivers} />
          </div>
        </div>
      ) : !currentDay.endTime ? (
        /* DIA EM ANDAMENTO */
        <>
        {/* BREAK TIMER — No mobile aparece no TOPO antes de tudo */}
        {breakState.isActive && currentDay.numDrivers === 1 && (
          <div className="lg:hidden">
            <BreakTimer
              breakStartTime={breakState.startTime}
              breakType={breakState.type}
              onBreakTypeSelect={onStartBreak}
              onResume={onEndBreak}
            />
          </div>
        )}
        {/* AmplitudeCard visível no mobile (topo) */}
        <div className="lg:hidden">
          <AmplitudeCard startTime={currentDay.startTime} endTime={currentDay.endTime} numDrivers={currentDay.numDrivers} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className={`border-2 ${
              conformity.status === 'danger' ? 'border-red-300 dark:border-red-700 animate-pulse' :
              conformity.status === 'warning' ? 'border-amber-300 dark:border-amber-700' :
              'border-emerald-300 dark:border-emerald-700'
            } bg-gradient-to-br ${
              conformity.status === 'danger' ? 'from-red-50 to-white dark:from-red-950 dark:to-slate-900' :
              conformity.status === 'warning' ? 'from-amber-50 to-white dark:from-amber-950 dark:to-slate-900' :
              'from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className={`${
                      conformity.status === 'danger' ? 'bg-red-600' :
                      conformity.status === 'warning' ? 'bg-amber-600' :
                      'bg-emerald-600'
                    } mb-2`}>
                      <Activity className={`h-3 w-3 mr-1 ${conformity.status !== 'ok' ? 'animate-pulse' : ''}`} />
                      DIA EM ANDAMENTO
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {currentDay.numDrivers === 2 ? '2 Motoristas' : '1 Motorista'}
                      </Badge>
                    </div>
                    <CardTitle>{formatDate(currentDay.date)}</CardTitle>
                  </div>
                  <CircularTimeCounter
                    hours={workingTime.hours}
                    minutes={workingTime.minutes}
                    maxHours={9}
                    label="de trabalho"
                    size={100}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {currentDay.matricula && (
                  <div className="mb-3 flex justify-center">
                    <div className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold font-mono tracking-wider">
                      <span className="bg-blue-600 px-2">{currentDay.matricula.split('-')[0]}</span>
                      <span className="text-blue-300">-</span>
                      <span className="bg-white text-blue-900 px-2 rounded">{currentDay.matricula.split('-')[1]}</span>
                      <span className="text-blue-300">-</span>
                      <span className="bg-white text-blue-900 px-2 rounded">{currentDay.matricula.split('-')[2]}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-white/70 dark:bg-slate-800/70 rounded-xl shadow-sm">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{formatTime(currentDay.startTime)}</p>
                    <p className="text-xs text-muted-foreground">Início</p>
                  </div>
                  <div className="text-center p-3 bg-white/70 dark:bg-slate-800/70 rounded-xl shadow-sm">
                    <MapPin className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{currentDay.startCountry || '--'}</p>
                    <p className="text-xs text-muted-foreground">Local</p>
                  </div>
                  <div className="text-center p-3 bg-white/70 dark:bg-slate-800/70 rounded-xl shadow-sm">
                    <Gauge className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{currentDay.startKm?.toLocaleString() || '--'}</p>
                    <p className="text-xs text-muted-foreground">KM</p>
                  </div>
                </div>

                <TrafficLightStatus
                  status={conformity.status}
                  totalMinutes={workingTime.totalMinutes}
                  maxHours={9}
                  breakMinutes={breakMinutes}
                />

                <div className="mt-4">
                  <DayTimeline
                    startTime={currentDay.startTime}
                    sessions={currentDay.drivingSessions}
                    numDrivers={currentDay.numDrivers}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pausa / Retomada / Eventos */}
            {/* No desktop, o BreakTimer aparece aqui (no mobile já está no topo) */}
            {breakState.isActive && currentDay.numDrivers === 1 ? (
              <div className="hidden lg:block" ref={breakTimerRef}>
                <BreakTimer
                  breakStartTime={breakState.startTime}
                  breakType={breakState.type}
                  onBreakTypeSelect={onStartBreak}
                  onResume={onEndBreak}
                />
              </div>
            ) : currentDay.isPaused && currentDay.numDrivers === 2 ? (
              /* Paused state for 2 drivers - existing card */
              <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950 dark:to-slate-900">
                <CardContent className="pt-4">
                  <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 text-amber-600">
                      <Pause className="h-6 w-6" />
                      <span className="font-bold text-lg">Condução Pausada</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Outro motorista está dirigindo</p>
                    {currentDay.lastSessionKm && (
                      <p className="text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded">
                        <span className="text-muted-foreground">Último KM:</span>{' '}
                        <span className="font-bold text-lg">{currentDay.lastSessionKm.toLocaleString()}</span>
                      </p>
                    )}
                    <Button onClick={onResumeDriving} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-lg font-bold">
                      <FastForward className="h-5 w-5 mr-2" />
                      RETOMAR CONDUÇÃO
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* PAUSAR + EVENTO buttons for ALL drivers */
              <div className="grid grid-cols-2 gap-3">
                {currentDay.numDrivers === 2 ? (
                  <Button onClick={onOpenPauseDialog} variant="outline" className="h-14 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 text-base font-medium">
                    <Pause className="h-5 w-5 mr-2" />
                    PAUSAR
                  </Button>
                ) : (
                  <Button onClick={onOpenBreak} variant="outline" className="h-14 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 text-base font-medium">
                    <Pause className="h-5 w-5 mr-2" />
                    PAUSAR
                  </Button>
                )}
                <Button onClick={() => setShowEventInput(true)} variant="outline" className="h-14 border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 text-base font-medium">
                  <Plus className="h-5 w-5 mr-2" />
                  EVENTO
                </Button>
              </div>
            )}

            {/* Eventos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Eventos do Dia
                  {currentDay.events.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{currentDay.events.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentDay.events.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {currentDay.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-xs font-mono text-muted-foreground bg-white dark:bg-slate-700 px-2 py-1 rounded-lg">
                          {event.time}
                        </span>
                        <span className="text-sm flex-1">{event.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {showEventInput ? (
                  <div className="space-y-3 p-4 border rounded-xl bg-slate-50 dark:bg-slate-800">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} className="flex-1 h-12 text-base" />
                      </div>
                      <Input placeholder="Descreva o evento..." value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} className="h-12" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowEventInput(false)} className="flex-1 h-12">Cancelar</Button>
                      <Button onClick={onAddEvent} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12">
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Finalizar Dia */}
            {!showEndForm ? (
              <Button onClick={() => setShowEndForm(true)} className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 h-16 text-lg font-bold shadow-lg">
                <Square className="h-6 w-6 mr-2" />
                FINALIZAR DIA
              </Button>
            ) : (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-base text-red-600 flex items-center gap-2">
                    <Square className="h-5 w-5" />
                    Finalizar Dia de Trabalho
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        País de Fim
                        <span className="text-red-500 font-bold">*</span>
                      </Label>
                      <div className="flex gap-1">
                        <Input placeholder="Espanha" value={endForm.endCountry} onChange={(e) => setEndForm({ ...endForm, endCountry: e.target.value })} className="flex-1 h-12" />
                        <Button type="button" variant="outline" size="icon" onClick={() => getLocation()} disabled={loadingGps} title="Detectar país via GPS" className="shrink-0 h-12 w-12">
                          {loadingGps ? <RefreshCw className="h-5 w-5 animate-spin text-blue-600" /> : <Navigation className="h-5 w-5 text-blue-600" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">KM Final</Label>
                      <Input type="number" placeholder="125500" value={endForm.endKm} onChange={(e) => setEndForm({ ...endForm, endKm: e.target.value })} className="h-12" />
                      {currentDay.lastSessionKm ? (
                        <p className="text-[10px] text-muted-foreground">Último: {currentDay.lastSessionKm.toLocaleString()}</p>
                      ) : currentDay.startKm ? (
                        <p className="text-[10px] text-muted-foreground">Mín: {currentDay.startKm}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observações do dia</Label>
                    <Textarea placeholder="Alguma nota sobre o dia..." value={endForm.observations} onChange={(e) => setEndForm({ ...endForm, observations: e.target.value })} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowEndForm(false)} className="flex-1 h-12">Cancelar</Button>
                    <Button onClick={onEndDay} disabled={isEnding} className="flex-1 bg-red-600 hover:bg-red-700 h-12 font-bold">
                      {isEnding ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
                      Confirmar Fim
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <div className="hidden lg:block space-y-4">
            <AmplitudeCard startTime={currentDay.startTime} endTime={currentDay.endTime} numDrivers={currentDay.numDrivers} />
          </div>
        </div>
        </>
      ) : (
        /* DIA FINALIZADO */
        <>
        {/* AmplitudeCard visível no mobile (topo) */}
        <div className="lg:hidden">
          <AmplitudeCard startTime={currentDay.startTime} endTime={currentDay.endTime} numDrivers={currentDay.numDrivers} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <Moon className="h-10 w-10 text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Dia Finalizado!</h2>
                    <p className="text-muted-foreground">
                      Você trabalhou <span className="font-bold text-emerald-600">{formatDecimalHours(currentDay.hoursWorked)}</span> e percorreu <span className="font-bold text-blue-600">{currentDay.kmTraveled || 0} km</span>
                    </p>
                  </div>
                  <Button onClick={() => onLoadWorkDays()} className="bg-emerald-600 hover:bg-emerald-700 h-14 font-bold">
                    <Play className="h-5 w-5 mr-2" />
                    Iniciar Novo Dia
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="hidden lg:block">
            <AmplitudeCard startTime={currentDay.startTime} endTime={currentDay.endTime} numDrivers={currentDay.numDrivers} />
          </div>
        </div>
        </>
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
            <WeeklyBars weeklyData={weeklyReport} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <p className="text-2xl font-bold text-emerald-600">{weeklyReport.statistics.daysWorked}</p>
                <p className="text-xs text-muted-foreground">dias</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{formatDecimalHours(weeklyReport.statistics.totalHours)}</p>
                <p className="text-xs text-muted-foreground">horas</p>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <p className="text-2xl font-bold text-purple-600">{weeklyReport.statistics.totalKm}</p>
                <p className="text-xs text-muted-foreground">km</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
