'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pause, FastForward, RefreshCw } from 'lucide-react';

interface PauseDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  isResume?: boolean;
}

export function PauseDialog({ open, onClose, onConfirm, isProcessing, isResume = false }: PauseDialogProps) {
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
              ? 'A condução será retomada.'
              : 'A condução será pausada. O outro motorista pode assumir.'}
          </DialogDescription>
        </DialogHeader>

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
