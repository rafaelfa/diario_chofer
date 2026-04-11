'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import type { WorkDay } from '@/lib/types';
import { useWorkDays } from '@/hooks/useWorkDays';
import { useReports } from '@/hooks/useReports';
import { useDiarioActions } from '@/hooks/useDiarioActions';
import { BottomNav } from '@/components/BottomNav';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/diario/ConfirmDialog';
import { PauseDialog } from '@/components/diario/PauseDialog';
import { ViewDayDialog } from '@/components/diario/ViewDayDialog';
import { EditDayDialog } from '@/components/diario/EditDayDialog';
import { AppHeader } from '@/components/diario/AppHeader';
import { MainView } from '@/components/diario/MainView';
import { HistoryView } from '@/components/diario/HistoryView';
import { ReportsView } from '@/components/diario/ReportsView';
import { SettingsView } from '@/components/diario/SettingsView';

const APP_VERSION = '4.1.7';

export default function DiarioMotorista() {
  const wd = useWorkDays();
  const rp = useReports();
  const actions = useDiarioActions(wd, rp);

  const {
    activeView, setActiveView, toast, setToast,
    confirmDialog, setConfirmDialog,
    startForm, setStartForm, endForm, setEndForm,
    newEvent, setNewEvent, showEventInput, setShowEventInput,
    showEndForm, setShowEndForm,
    lastKmInfo, setLastKmInfo, checkingMatricula,
    reportType, setReportType, customDateStart, setCustomDateStart,
    customDateEnd, setCustomDateEnd, loadingPdf,
    isOnline, loadingGps, gpsError, getLocation,
    currentUser, currentDay, workDays, isLoading,
    viewingDay, setViewingDay, editingDay, setEditingDay,
    editForm, setEditForm, deleteConfirm, setDeleteConfirm,
    showPauseDialog, setShowPauseDialog, pauseKm, setPauseKm, isProcessingPause,
    breakState,
    breakMinutes,
    conformity, workingTime,
    isStarting, isEnding, isSaving,
    handleStartDay, handleEndDay, handleAddEvent,
    handlePauseDriving, handleResumeDriving, handleOpenPauseDialog, handleConfirmResume,
    handleStartBreak, handleEndBreak,
    handleOpenBreak,
    handleViewDay, handleEditClick, handleSaveEdit, handleDeleteDay,
    handleGeneratePdf, handleLogout,
    formatTime, formatDate, loadWorkDays,
    weeklyReport, vehicleStats, selectedVehicle, vehicleHistory,
    loadingVehicles, loadVehicleHistory,
  } = actions;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 pb-14 sm:pb-0">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Diálogo de Confirmação */}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          options={confirmDialog.options}
          onConfirm={confirmDialog.onConfirm}
        />
      )}

      {/* Header */}
      <AppHeader
        activeView={activeView}
        onViewChange={setActiveView}
        isOnline={isOnline}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-3 py-3 max-w-4xl lg:max-w-6xl">
        {/* VIEW: MAIN */}
        {activeView === 'main' && (
          <MainView
            currentDay={currentDay}
            isLoading={isLoading}
            weeklyReport={weeklyReport}
            conformity={conformity}
            workingTime={workingTime}
            startForm={startForm}
            setStartForm={setStartForm}
            endForm={endForm}
            setEndForm={setEndForm}
            newEvent={newEvent}
            setNewEvent={setNewEvent}
            showEventInput={showEventInput}
            setShowEventInput={setShowEventInput}
            showEndForm={showEndForm}
            setShowEndForm={setShowEndForm}
            lastKmInfo={lastKmInfo}
            setLastKmInfo={setLastKmInfo}
            checkingMatricula={checkingMatricula}
            gpsCountry={actions.gpsCountry}
            loadingGps={loadingGps}
            gpsError={gpsError}
            getLocation={getLocation}
            formatTime={formatTime}
            formatDate={formatDate}
            checkLastKm={actions.checkLastKm}
            onStartDay={handleStartDay}
            onEndDay={handleEndDay}
            onAddEvent={handleAddEvent}
            onPauseDriving={handlePauseDriving}
            onResumeDriving={handleResumeDriving}
            onOpenPauseDialog={handleOpenPauseDialog}
            onLoadWorkDays={loadWorkDays}
            isStarting={isStarting}
            isEnding={isEnding}
            isSaving={isSaving}
            breakState={breakState}
            breakMinutes={breakMinutes}
            onOpenBreak={handleOpenBreak}
            onStartBreak={handleStartBreak}
            onEndBreak={handleEndBreak}
          />
        )}

        {/* VIEW: HISTÓRICO */}
        {activeView === 'history' && (
          <HistoryView
            workDays={workDays}
            isLoading={isLoading}
            onViewDay={handleViewDay}
            onEditDay={handleEditClick}
            onDeleteDay={setDeleteConfirm}
            formatDate={formatDate}
          />
        )}

        {/* VIEW: RELATÓRIOS */}
        {activeView === 'reports' && (
          <ReportsView
            weeklyReport={weeklyReport}
            vehicleStats={vehicleStats}
            selectedVehicle={selectedVehicle}
            vehicleHistory={vehicleHistory}
            loadingVehicles={loadingVehicles}
            loadingPdf={loadingPdf}
            reportType={reportType}
            setReportType={setReportType}
            customDateStart={customDateStart}
            setCustomDateStart={setCustomDateStart}
            customDateEnd={customDateEnd}
            setCustomDateEnd={setCustomDateEnd}
            onGeneratePdf={handleGeneratePdf}
            onLoadVehicleHistory={loadVehicleHistory}
          />
        )}

        {/* VIEW: CONFIGURAÇÕES */}
        {activeView === 'settings' && (
          <SettingsView
            currentUser={currentUser}
            onLogout={handleLogout}
            appVersion={APP_VERSION}
          />
        )}
      </main>

      {/* Diálogos */}
      <ViewDayDialog day={viewingDay} onClose={() => setViewingDay(null)} onEdit={handleEditClick} />
      <EditDayDialog day={editingDay} form={editForm} onFormChange={setEditForm} onSave={handleSaveEdit} onClose={() => setEditingDay(null)} />

      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Excluir Jornada
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a jornada de {formatDate(deleteConfirm.date)}?
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300">
              ⚠️ Esta ação não pode ser desfeita. Todos os eventos associados também serão excluídos.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="h-12">Cancelar</Button>
              <Button onClick={handleDeleteDay} variant="destructive" className="h-12">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showPauseDialog && currentDay && (
        <PauseDialog
          open={showPauseDialog}
          onClose={() => setShowPauseDialog(false)}
          pauseKm={pauseKm}
          onKmChange={setPauseKm}
          onConfirm={currentDay.isPaused ? handleConfirmResume : handlePauseDriving}
          isProcessing={isProcessingPause}
          isResume={currentDay.isPaused}
          lastKnownKm={currentDay.lastSessionKm || currentDay.startKm}
        />
      )}

      <BottomNav activeView={activeView} setActiveView={setActiveView} />
    </div>
  );
}
