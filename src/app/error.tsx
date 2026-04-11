'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro capturado pelo Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="bg-red-100 dark:bg-red-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-xl font-bold mb-2">Algo correu mal</h1>
        <p className="text-muted-foreground mb-6">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        {error.message && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-6 font-mono break-words">
            {error.message}
          </p>
        )}
        <Button
          onClick={reset}
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-14 font-bold"
        >
          <RotateCcw className="h-5 w-5 mr-2" />
          Tentar Novamente
        </Button>
      </div>
    </div>
  );
}
