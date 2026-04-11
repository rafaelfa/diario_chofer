'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, LogOut } from 'lucide-react';

interface SettingsViewProps {
  currentUser: { username: string } | null;
  onLogout: () => void;
  appVersion: string;
}

export function SettingsView({
  currentUser,
  onLogout,
  appVersion,
}: SettingsViewProps) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold">Configurações</h2>

      {/* Perfil */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">{currentUser?.username}</p>
                <p className="text-xs text-muted-foreground">Motorista</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={onLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-12"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info do App */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sobre o App</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
              <span>Versão</span>
              <Badge variant="outline">{appVersion}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
              <span>Regulamento</span>
              <Badge>CE 561/2006</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
