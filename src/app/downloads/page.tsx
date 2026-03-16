import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ExternalLink, Github } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DownloadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Downloads
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Diário do Motorista - Código Fonte
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-emerald-600" />
              Obter o Código
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              O código fonte do Diário do Motorista está disponível no repositório do projeto.
              Você pode clonar ou fazer download diretamente.
            </p>
            
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
              <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-2">
                Versão Atual: v5.5
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>✅ Campo Matrícula do Caminhão</li>
                <li>✅ Relatórios por veículo</li>
                <li>✅ PWA (funciona offline)</li>
                <li>✅ GPS com detecção de país</li>
                <li>✅ Compatível com Next.js 16</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Repositório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Acesse o repositório para obter a última versão do código, reportar bugs ou contribuir.
            </p>
            <div className="flex gap-3">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Acessar Repositório
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">
                  Voltar ao Início
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
