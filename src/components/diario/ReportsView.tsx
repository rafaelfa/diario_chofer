'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw, FileText, AlertTriangle, BarChart3, History, Car, Truck, Download, X,
} from 'lucide-react';
import type { Report, VehicleStats, VehicleHistory } from '@/lib/types';
import { formatDatePt } from '@/lib/timezone';
import { formatDecimalHours } from '@/lib/time';

interface ReportsViewProps {
  weeklyReport: Report | null;
  vehicleStats: VehicleStats[];
  selectedVehicle: string | null;
  vehicleHistory: VehicleHistory[];
  loadingVehicles: boolean;
  loadingPdf: boolean;
  reportType: 'weekly' | 'monthly' | 'custom';
  setReportType: (type: 'weekly' | 'monthly' | 'custom') => void;
  customDateStart: string;
  setCustomDateStart: (v: string) => void;
  customDateEnd: string;
  setCustomDateEnd: (v: string) => void;
  onGeneratePdf: (type: 'weekly' | 'monthly' | 'custom', matricula?: string) => Promise<void>;
  onLoadVehicleHistory: (matricula: string) => void;
}

export function ReportsView({
  weeklyReport,
  vehicleStats,
  selectedVehicle,
  vehicleHistory,
  loadingVehicles,
  loadingPdf,
  reportType,
  setReportType,
  customDateStart,
  setCustomDateStart,
  customDateEnd,
  setCustomDateEnd,
  onGeneratePdf,
  onLoadVehicleHistory,
}: ReportsViewProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Relatórios</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {/* Seletor de Tipo */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant={reportType === 'weekly' ? 'default' : 'outline'} size="sm" onClick={() => setReportType('weekly')} className={reportType === 'weekly' ? 'bg-emerald-600 hover:bg-emerald-700 h-12' : 'h-12'}>Semanal</Button>
            <Button variant={reportType === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => setReportType('monthly')} className={reportType === 'monthly' ? 'bg-emerald-600 hover:bg-emerald-700 h-12' : 'h-12'}>Mensal</Button>
            <Button variant={reportType === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setReportType('custom')} className={reportType === 'custom' ? 'bg-purple-600 hover:bg-purple-700 h-12' : 'h-12'}>Período</Button>
          </div>

          {reportType === 'custom' && (
            <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-purple-700 dark:text-purple-300">📅 Data Início</Label>
                    <Input type="date" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)} className="h-12 text-lg border-purple-300 dark:border-purple-700 focus:ring-purple-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-purple-700 dark:text-purple-300">📅 Data Fim</Label>
                    <Input type="date" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)} className="h-12 text-lg border-purple-300 dark:border-purple-700 focus:ring-purple-500" />
                  </div>
                </div>
                {customDateStart && customDateEnd && (
                  <p className="text-sm text-center text-muted-foreground mt-3">
                    Período: {new Date(customDateStart).toLocaleDateString('pt-PT')} a {new Date(customDateEnd).toLocaleDateString('pt-PT')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Gerar PDF */}
          <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Gerar Relatório {reportType === 'weekly' ? 'Semanal' : reportType === 'monthly' ? 'Mensal' : 'do Período'}</p>
                    <p className="text-xs text-muted-foreground">Abrirá em nova janela para impressão/PDF</p>
                  </div>
                </div>
                <Button onClick={() => onGeneratePdf(reportType)} disabled={loadingPdf || (reportType === 'custom' && (!customDateStart || !customDateEnd))} className="bg-blue-600 hover:bg-blue-700 h-12 disabled:opacity-50">
                  {loadingPdf ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <Download className="h-5 w-5 mr-2" />}
                  PDF
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
              <CardDescription>Clique em um veículo para ver o histórico detalhado</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingVehicles ? (
                <div className="text-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : vehicleStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhum veículo registado ainda</p>
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
                      onClick={() => onLoadVehicleHistory(v.matricula)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-blue-600" />
                          <span className="font-bold">{v.matricula}</span>
                        </div>
                        <Badge variant="outline">{v.viagens} viagens</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <div><p className="font-bold">{v.totalKm.toLocaleString()}</p><p className="text-xs text-muted-foreground">km</p></div>
                        <div><p className="font-bold">{v.totalHoras}h</p><p className="text-xs text-muted-foreground">horas</p></div>
                        <div><p className="font-bold">{v.mediaKmPorDia}</p><p className="text-xs text-muted-foreground">km/dia</p></div>
                        <div><p className="font-bold">{v.kmFinal?.toLocaleString() || '-'}</p><p className="text-xs text-muted-foreground">KM atual</p></div>
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
                    <Button size="sm" variant="outline" onClick={() => onGeneratePdf(reportType, selectedVehicle)} disabled={loadingPdf} className="h-10">
                      <Download className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onLoadVehicleHistory('')} className="h-10">
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
                          <span className="font-medium">{h.date ? formatDatePt(h.date as string, { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}</span>
                          <span className="text-xs text-muted-foreground">{h.startTime} - {h.endTime || 'em curso'}</span>
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
                      <p className="text-2xl font-bold">{formatDecimalHours(weeklyReport.statistics.totalHours)}</p>
                      <p className="text-xs text-muted-foreground">total de horas</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                      <p className="text-2xl font-bold">{weeklyReport.statistics.totalKm}</p>
                      <p className="text-xs text-muted-foreground">km percorridos</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                      <p className="text-2xl font-bold">{formatDecimalHours(weeklyReport.statistics.avgHoursPerDay)}</p>
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
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Limites Legais (Reg. CE 561/2006)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span>Condução diária máxima</span>
                  <Badge>9h (10h 2x/semana)</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span>Condução semanal máxima</span>
                  <Badge>56h</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span>Condução contínua</span>
                  <Badge>4h30 → pausa 45min</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span>Descanso diário</span>
                  <Badge>11h (9h 3x/semana)</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
