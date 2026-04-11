import { FileQuestion, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="bg-amber-100 dark:bg-amber-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="text-6xl font-bold text-slate-300 dark:text-slate-600 mb-2">404</h1>
        <h2 className="text-xl font-bold mb-2">Página não encontrada</h2>
        <p className="text-muted-foreground mb-6">
          A página que procura não existe ou foi removida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full h-14 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
        >
          <Home className="h-5 w-5 mr-2" />
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}
