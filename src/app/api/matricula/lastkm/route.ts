import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { logError } from '@/lib/logger';
import { validateMatricula } from '@/lib/validators';

// GET - Buscar último KM final de uma matrícula específica DO USUÁRIO LOGADO
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');

    if (!matricula) {
      return NextResponse.json({ error: 'Matrícula é obrigatória' }, { status: 400 });
    }

    // Validar formato da matrícula
    const { valid, normalized: matriculaUpper } = validateMatricula(matricula);

    if (!valid) {
      return NextResponse.json({ error: 'Formato de matrícula inválido' }, { status: 400 });
    }

    // ✅ ISOLAMENTO: Buscar o último registro DO USUÁRIO LOGADO
    const lastRecord = await db.workDay.findFirst({
      where: {
        userId,  // ← OBRIGATÓRIO: isolamento por usuário
        matricula: matriculaUpper,
        endTime: { not: null }, // Apenas registros finalizados
        endKm: { not: null }    // Com KM final registrado
      },
      orderBy: [
        { date: 'desc' },
        { endTime: 'desc' }
      ],
      select: {
        id: true,
        date: true,
        endKm: true,
        endCountry: true,
        endTime: true
      }
    });

    if (!lastRecord) {
      return NextResponse.json({
        found: false,
        message: 'Nenhum registro anterior encontrado para esta matrícula'
      });
    }

    return NextResponse.json({
      found: true,
      lastKm: lastRecord.endKm,
      date: lastRecord.date,
      endTime: lastRecord.endTime,
      endCountry: lastRecord.endCountry
    });

  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error fetching last KM:', error);
    return NextResponse.json({ error: 'Erro ao buscar último KM' }, { status: 500 });
  }
}
