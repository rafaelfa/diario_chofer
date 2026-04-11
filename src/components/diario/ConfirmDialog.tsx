'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogOption {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive';
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  options?: ConfirmDialogOption[];
  onConfirm?: () => void;
}

export function ConfirmDialog({ open, onClose, title, description, options, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-line">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {options ? (
            options.map((option, index) => (
              <Button 
                key={index}
                variant={option.variant || 'default'}
                onClick={option.onClick}
                className={option.variant === 'default' ? 'bg-emerald-600 hover:bg-emerald-700 h-12' : 'h-12'}
              >
                {option.label}
              </Button>
            ))
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="h-12">
                Cancelar
              </Button>
              {onConfirm && (
                <Button onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-700 h-12">
                  Confirmar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
