'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw, Calendar, Activity, Moon, Pause,
  CheckCircle2, Truck, Eye, Pencil, Trash2,
} from 'lucide-react';
import type { WorkDay } from '@/lib/types';
import { formatDecimalHours } from '@/lib/time';

interface HistoryViewProps {
  workDays: WorkDay[];
  isLoading: boolean;
  onViewDay: (day: WorkDay) => void;
  onEditDay: (day: WorkDay) => void;
  onDeleteDay: (day: WorkDay) => void;
  formatDate: (dateStr: string) => string;
}

export function HistoryView({
  workDays,
  isLoading,
  onViewDay,
  onEditDay,
  onDeleteDay,
  formatDate,
}: HistoryViewProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h2 className="text-lg font-bold">Histórico de Jornadas</h2>

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
        <ScrollArea className="h-[calc(100vh-200px)]">
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
                        onClick={() => onViewDay(day)}
                        className="h-10 w-10 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Ver detalhes"
                      >
                        <Eye className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditDay(day)}
                        className="h-10 w-10 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        title="Editar"
                      >
                        <Pencil className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteDay(day)}
                        className="h-10 w-10 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                      <p className="font-bold">{formatDecimalHours(day.hoursWorked)}</p>
                      <p className="text-xs text-muted-foreground">tempo</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                      <p className="font-bold">{day.kmTraveled ? day.kmTraveled.toLocaleString() : '--'}</p>
                      <p className="text-xs text-muted-foreground">km</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                      <p className="font-bold">{day.events.length}</p>
                      <p className="text-xs text-muted-foreground">eventos</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                      <p className="font-bold">{day.startCountry || '--'}</p>
                      <p className="text-xs text-muted-foreground">para {day.endCountry || '--'}</p>
                    </div>
                  </div>

                  {/* Indicadores */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {day.sessionCount && day.sessionCount > 1 && (
                      <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        <Activity className="h-3 w-3 mr-1" />
                        {day.sessionCount} turnos
                      </Badge>
                    )}
                    {day.isPaused && !day.endTime && (
                      <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700">
                        <Pause className="h-3 w-3 mr-1" />
                        Pausado
                      </Badge>
                    )}
                    {day.truckCheck && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Check OK
                      </Badge>
                    )}
                    {day.matricula && (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700">
                        <Truck className="h-3 w-3 mr-1" />
                        {day.matricula}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
