import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Buscar último KM final de uma matrícula específica
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');

    if (!matricula) {
      return NextResponse.json({ error: 'Matrícula é obrigatória' }, { status: 400 });
    }

    // Validar formato da matrícula
    const matriculaRegex = /^[A-Z]{2}-\d{2}-[A-Z0-9]{2}$/;
    const matriculaUpper = matricula.toUpperCase();
    
    if (!matriculaRegex.test(matriculaUpper)) {
      return NextResponse.json({ error: 'Formato de matrícula inválido' }, { status: 400 });
    }

    // Buscar o último registro finalizado desta matrícula
    const lastRecord = await db.workDay.findFirst({
      where: {
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
    console.error('Error fetching last KM:', error);
    return NextResponse.json({ error: 'Erro ao buscar último KM' }, { status: 500 });
  }
}
