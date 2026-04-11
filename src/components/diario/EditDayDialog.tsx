'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Save } from 'lucide-react';
import type { WorkDay } from '@/lib/types';

export interface EditFormState {
  date: string;
  startTime: string;
  endTime: string;
  startCountry: string;
  endCountry: string;
  startKm: string;
  endKm: string;
  observations: string;
  matricula: string;
}

interface EditDayDialogProps {
  day: WorkDay | null;
  form: EditFormState;
  onFormChange: (form: EditFormState) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditDayDialog({ day, form, onFormChange, onSave, onClose }: EditDayDialogProps) {
  if (!day) return null;

  return (
    <Dialog open={!!day} onOpenChange={onClose}>
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
                value={form.date}
                onChange={(e) => onFormChange({...form, date: e.target.value})}
                className="h-12"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora Início</Label>
              <Input 
                type="time"
                value={form.startTime}
                onChange={(e) => onFormChange({...form, startTime: e.target.value})}
                className="h-12"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Hora Fim</Label>
              <Input 
                type="time"
                value={form.endTime}
                onChange={(e) => onFormChange({...form, endTime: e.target.value})}
                className="h-12"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">País Início</Label>
              <Input 
                placeholder="Portugal"
                value={form.startCountry}
                onChange={(e) => onFormChange({...form, startCountry: e.target.value})}
                className="h-12"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">País Fim</Label>
              <Input 
                placeholder="Espanha"
                value={form.endCountry}
                onChange={(e) => onFormChange({...form, endCountry: e.target.value})}
                className="h-12"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">KM Inicial</Label>
              <Input 
                type="number"
                placeholder="125000"
                value={form.startKm}
                onChange={(e) => onFormChange({...form, startKm: e.target.value})}
                className="h-12"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">KM Final</Label>
            <Input 
              type="number"
              placeholder="125500"
              value={form.endKm}
              onChange={(e) => onFormChange({...form, endKm: e.target.value})}
              className="h-12"
            />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Matrícula do Caminhão</Label>
            <Input 
              placeholder="PT-12-AB"
              value={form.matricula}
              onChange={(e) => onFormChange({...form, matricula: e.target.value.toUpperCase()})}
              maxLength={8}
              className="uppercase h-12"
            />
            <p className="text-xs text-muted-foreground">Formato: AA-00-BB</p>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea 
              placeholder="Notas adicionais..."
              value={form.observations}
              onChange={(e) => onFormChange({...form, observations: e.target.value})}
              rows={2}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-12">
            Cancelar
          </Button>
          <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700 h-12">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
