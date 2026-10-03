'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BriefcaseBusiness, PackageOpen, RefreshCw } from 'lucide-react';
import type { WorkActivityType } from '@/lib/types';

export const ACTIVITY_LABELS: Record<WorkActivityType, string> = {
  loading: 'Carregamento',
  unloading: 'Descarregamento',
  refueling: 'Abastecimento',
  other: 'Outro trabalho sem condução',
};

interface NonDrivingActivityDialogProps {
  open: boolean;
  mode: 'start' | 'finish';
  activityType: WorkActivityType;
  onActivityTypeChange: (type: WorkActivityType) => void;
  currentKm: string;
  onKmChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function NonDrivingActivityDialog({
  open,
  mode,
  activityType,
  onActivityTypeChange,
  currentKm,
  onKmChange,
  onClose,
  onConfirm,
  isProcessing,
}: NonDrivingActivityDialogProps) {
  const isStarting = mode === 'start';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            {isStarting ? <BriefcaseBusiness className="h-5 w-5" /> : <PackageOpen className="h-5 w-5" />}
            {isStarting ? 'Iniciar atividade sem condução' : 'Retomar condução'}
          </DialogTitle>
          <DialogDescription>
            {isStarting
              ? 'A condução ficará pausada durante o trabalho. A amplitude da jornada continua contando.'
              : `Atividade: ${ACTIVITY_LABELS[activityType]}. Informe o odómetro para continuar a condução.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isStarting && (
            <div className="space-y-2">
              <Label htmlFor="non-driving-type">Tipo de atividade</Label>
              <select
                id="non-driving-type"
                value={activityType}
                onChange={event => onActivityTypeChange(event.target.value as WorkActivityType)}
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="non-driving-km">KM atual do veículo</Label>
            <Input
              id="non-driving-km"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="125500"
              value={currentKm}
              onChange={event => onKmChange(event.target.value)}
              className="h-12 text-base"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} className="h-12 w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing} className="h-12 w-full bg-blue-700 hover:bg-blue-800 sm:w-auto">
            {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isStarting ? 'INICIAR ATIVIDADE' : 'RETOMAR CONDUÇÃO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
