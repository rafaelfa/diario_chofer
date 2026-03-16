import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // API simplificada para compatibilidade com Vercel
  // Não usa sistema de arquivos local
  return NextResponse.json({ 
    error: 'Download não disponível nesta versão',
    message: 'Acesse a página de downloads para obter o código fonte',
    downloadsPage: '/downloads'
  }, { status: 404 });
}
