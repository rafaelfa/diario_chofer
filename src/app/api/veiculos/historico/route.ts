import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Histórico de KM por caminhão
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!matricula) {
      // Listar todos os veículos com resumo
      const veiculos = await db.workDay.findMany({
        where: {
          matricula: { not: null }
        },
        select: {
          matricula: true,
          startKm: true,
          endKm: true,
          date: true
        },
        orderBy: { date: 'desc' }
      });

      const veiculosMap: Record<string, any> = {};

      veiculos.forEach(v => {
        const key = v.matricula!;
        if (!veiculosMap[key]) {
          veiculosMap[key] = {
            matricula: key,
            totalViagens: 0,
            totalKm: 0,
            firstDate: v.date,
            lastDate: v.date,
            lastKm: v.endKm || 0
          };
        }

        veiculosMap[key].totalViagens++;
        if (v.endKm && v.startKm) {
          veiculosMap[key].totalKm += (v.endKm - v.startKm);
        }
        if (v.date < veiculosMap[key].firstDate) {
          veiculosMap[key].firstDate = v.date;
        }
        if (v.date > veiculosMap[key].lastDate) {
          veiculosMap[key].lastDate = v.date;
          if (v.endKm) veiculosMap[key].lastKm = v.endKm;
        }
      });

      return NextResponse.json({
        veiculos: Object.values(veiculosMap).sort((a, b) => b.lastDate.localeCompare ? 0 : 0)
      });
    }

    // Histórico de um veículo específico
    const historico = await db.workDay.findMany({
      where: {
        matricula: matricula.toUpperCase()
      },
      include: {
        events: {
          select: {
            id: true,
            type: true,
            startTime: true,
            endTime: true,
            notes: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: limit
    });

    const historicoFormatado = historico.map(day => ({
      id: day.id,
      date: day.date,
      startTime: day.startTime,
      endTime: day.endTime,
      startKm: day.startKm,
      endKm: day.endKm,
      kmTraveled: day.endKm && day.startKm ? day.endKm - day.startKm : null,
      startCountry: day.startCountry,
      endCountry: day.endCountry,
      lastRest: day.lastRest,
      truckCheck: day.truckCheck,
      events: day.events.length,
      eventsList: day.events
    }));

    // Calcular estatísticas do veículo
    const stats = {
      totalViagens: historico.length,
      totalKm: historico.reduce((sum, d) => sum + (d.endKm && d.startKm ? d.endKm - d.startKm : 0), 0),
      totalEvents: historico.reduce((sum, d) => sum + d.events.length, 0),
      firstKm: historico.length > 0 ? historico[historico.length - 1].startKm : null,
      lastKm: historico.length > 0 ? historico[0].endKm : null
    };

    return NextResponse.json({
      matricula: matricula.toUpperCase(),
      estatisticas: stats,
      historico: historicoFormatado
    });

  } catch (error) {
    console.error('Error fetching vehicle history:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }
}
