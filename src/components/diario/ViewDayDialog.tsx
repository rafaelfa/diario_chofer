'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Clock, Truck, FileText, CheckCircle2, Pencil } from 'lucide-react';
import type { WorkDay } from '@/lib/types';
import { diffInMinutes, formatDecimalHours } from '@/lib/time';

interface ViewDayDialogProps {
  day: WorkDay | null;
  onClose: () => void;
  onEdit: (day: WorkDay) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  });
}

export function ViewDayDialog({ day, onClose, onEdit }: ViewDayDialogProps) {
  if (!day) return null;

  return (
    <Dialog open={!!day} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            Detalhes da Jornada
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {formatDate(day.date)}
            {day.matricula && (
              <Badge variant="outline" className="ml-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                <Truck className="h-3 w-3 mr-1" />
                {day.matricula}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Resumo Total */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <p className="text-xl font-bold text-emerald-600">{formatDecimalHours(day.hoursWorked)}</p>
              <p className="text-xs text-muted-foreground">trabalhadas</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-xl font-bold text-blue-600">{day.kmTraveled || '--'}</p>
              <p className="text-xs text-muted-foreground">km total</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <p className="text-xl font-bold text-purple-600">{day.sessionCount || 1}</p>
              <p className="text-xs text-muted-foreground">turno{(day.sessionCount || 1) > 1 ? 's' : ''}</p>
            </div>
          </div>
          
          {/* Timeline de Turnos */}
          <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Turnos de Condução
            </p>
            
            {day.drivingSessions && day.drivingSessions.length > 0 ? (
              <div className="space-y-3">
                {day.drivingSessions.map((session, index) => {
                  // Calcular KM e duração da sessão
                  const sessionKm = session.startKm && session.endKm 
                    ? session.endKm - session.startKm 
                    : null;
                  
                  // Calcular duração
                  let sessionDuration = '';
                  const sessionDiffMins = diffInMinutes(session.startTime, session.endTime);
                  if (sessionDiffMins !== null) {
                    const hours = Math.floor(sessionDiffMins / 60);
                    const mins = sessionDiffMins % 60;
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
                          {index < (day.drivingSessions?.length || 0) - 1 && (
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
                      {index < (day.drivingSessions?.length || 0) - 1 && (
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
                    <span className="font-mono text-sm font-semibold">{day.startTime}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-sm font-semibold">{day.endTime || '--:--'}</span>
                    {day.startCountry && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({day.startCountry} → {day.endCountry || '?'})
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-100 dark:bg-slate-700 rounded p-1.5">
                      <p className="text-muted-foreground">KM Início</p>
                      <p className="font-semibold">{day.startKm?.toLocaleString() || '--'}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded p-1.5">
                      <p className="text-muted-foreground">KM Fim</p>
                      <p className="font-semibold">{day.endKm?.toLocaleString() || '--'}</p>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded p-1.5">
                      <p className="text-muted-foreground">Percorrido</p>
                      <p className="font-semibold">{day.kmTraveled || '--'} km</p>
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
          {day.events.length > 0 && (
            <div className="border rounded-lg p-3">
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Eventos do dia ({day.events.length})
              </p>
              <div className="space-y-1.5 max-h-32 overflow-auto">
                {day.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                    <Badge variant="outline" className="font-mono text-xs">{event.time}</Badge>
                    <span>{event.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Observações */}
          {day.observations && (
            <div>
              <p className="text-sm font-medium mb-1">Observações:</p>
              <p className="text-sm text-muted-foreground bg-slate-50 dark:bg-slate-800 p-2 rounded">
                {day.observations}
              </p>
            </div>
          )}
          
          {/* Check do caminhão */}
          {day.truckCheck && (
            <Badge variant="outline" className="w-full justify-center py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Check do caminhão realizado ✓
            </Badge>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto h-12">
            Fechar
          </Button>
          <Button onClick={() => {
            onClose();
            onEdit(day);
          }} className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto h-12">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
