'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pause, FastForward, RefreshCw } from 'lucide-react';

interface PauseDialogProps {
  open: boolean;
  onClose: () => void;
  pauseKm: string;
  onKmChange: (km: string) => void;
  onConfirm: () => void;
  isProcessing: boolean;
  isResume?: boolean;
  lastKnownKm?: number | null;
}

export function PauseDialog({ open, onClose, pauseKm, onKmChange, onConfirm, isProcessing, isResume = false, lastKnownKm }: PauseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            {isResume ? <FastForward className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            {isResume ? 'Retomar Condução' : 'Pausar Condução'}
          </DialogTitle>
          <DialogDescription>
            {isResume 
              ? 'Informe o KM atual do veículo para retomar sua condução.'
              : 'Informe o KM atual para registrar o fim do seu turno. O outro motorista pode assumir.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Mostrar último KM conhecido */}
          {lastKnownKm && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-muted-foreground">Último KM registrado:</p>
              <p className="text-xl font-bold text-emerald-600">
                {lastKnownKm.toLocaleString()}
              </p>
            </div>
          )}
          
          <div className="space-y-1">
            <Label className="text-xs">KM Atual do Veículo</Label>
            <Input 
              type="number"
              placeholder="125500"
              value={pauseKm}
              onChange={(e) => onKmChange(e.target.value)}
              className="text-lg h-14"
            />
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto h-12">
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={isProcessing}
            className={`w-full sm:w-auto h-12 ${isResume ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : isResume ? (
              <FastForward className="h-4 w-4 mr-2" />
            ) : (
              <Pause className="h-4 w-4 mr-2" />
            )}
            {isResume ? 'RETOMAR' : 'PAUSAR'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
