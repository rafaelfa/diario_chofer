import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <WifiOff className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-xl">Sem Conexão</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Você está offline no momento. Algumas funcionalidades podem não estar disponíveis.
          </p>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg text-sm">
            <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-2">
              ✅ Dados salvos localmente
            </p>
            <p className="text-muted-foreground">
              Suas alterações serão sincronizadas automaticamente quando a conexão for restaurada.
            </p>
          </div>
          <Button 
            onClick={() => window.location.reload()}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
