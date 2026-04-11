'use client';

/**
 * Hook useDialogManager — manages toast, confirm dialogs, view/edit/delete states,
 * and pause/resume dialog state.
 */

import { useState, useCallback } from 'react';
import type { WorkDay, ToastState } from '@/lib/types';
import type { ConfirmDialogState, BreakState } from './useDiarioActions';
import type { EditFormState } from '@/components/diario/EditDayDialog';

export function useDialogManager() {
  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // View/Edit/Delete day
  const [viewingDay, setViewingDay] = useState<WorkDay | null>(null);
  const [editingDay, setEditingDay] = useState<WorkDay | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    date: '',
    startTime: '',
    endTime: '',
    startCountry: '',
    endCountry: '',
    startKm: '',
    endKm: '',
    observations: '',
    matricula: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<WorkDay | null>(null);

  // Pause/Resume
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseKm, setPauseKm] = useState('');
  const [isProcessingPause, setIsProcessingPause] = useState(false);

  // Break (1 driver)
  const [breakState, setBreakState] = useState<BreakState>({
    isActive: false,
    startTime: null,
    type: 'none',
    completedBreakMinutes: 0,
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  return {
    // Toast
    toast,
    setToast,
    showToast,

    // Confirm dialog
    confirmDialog,
    setConfirmDialog,

    // View/Edit/Delete
    viewingDay,
    setViewingDay,
    editingDay,
    setEditingDay,
    editForm,
    setEditForm,
    deleteConfirm,
    setDeleteConfirm,

    // Pause/Resume
    showPauseDialog,
    setShowPauseDialog,
    pauseKm,
    setPauseKm,
    isProcessingPause,
    setIsProcessingPause,

    // Break (1 driver)
    breakState,
    setBreakState,
  };
}
