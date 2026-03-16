import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Estatísticas por veículo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');

    // Buscar todos os dias com matrícula
    const workDays = await db.workDay.findMany({
      where: matricula ? { matricula: matricula.toUpperCase() } : { matricula: { not: null } },
      include: { events: true },
      orderBy: { date: 'desc' }
    });

    // Agrupar por matrícula
    const stats: Record<string, any> = {};

    workDays.forEach(day => {
      const key = day.matricula!;
      if (!stats[key]) {
        stats[key] = {
          matricula: key,
          viagens: 0,
          totalKm: 0,
          totalHoras: 0,
          totalEventos: 0,
          diasTrabalhados: new Set(),
          primeiroRegistro: day.date,
          ultimoRegistro: day.date,
          kmInicial: day.startKm,
          kmFinal: day.endKm,
          paises: new Set(),
          manutencoes: 0
        };
      }

      stats[key].viagens++;
      stats[key].diasTrabalhados.add(day.date.toISOString().split('T')[0]);

      // KM
      if (day.endKm && day.startKm) {
        stats[key].totalKm += day.endKm - day.startKm;
      }
      if (day.endKm) {
        stats[key].kmFinal = Math.max(stats[key].kmFinal || 0, day.endKm);
      }
      if (day.startKm && (!stats[key].kmInicial || day.startKm < stats[key].kmInicial)) {
        stats[key].kmInicial = day.startKm;
      }

      // Horas
      if (day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        let hours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
        if (hours < 0) hours += 24;
        stats[key].totalHoras += hours;
      }

      // Eventos
      stats[key].totalEventos += day.events.length;

      // Datas
      if (day.date < stats[key].primeiroRegistro) {
        stats[key].primeiroRegistro = day.date;
      }
      if (day.date > stats[key].ultimoRegistro) {
        stats[key].ultimoRegistro = day.date;
      }

      // Países
      if (day.startCountry) stats[key].paises.add(day.startCountry);
      if (day.endCountry) stats[key].paises.add(day.endCountry);

      // Check do caminhão
      if (day.truckCheck) stats[key].manutencoes++;
    });

    // Formatar resultado
    const resultado = Object.values(stats).map((v: any) => ({
      matricula: v.matricula,
      viagens: v.viagens,
      diasTrabalhados: v.diasTrabalhados.size,
      totalKm: v.totalKm,
      totalHoras: parseFloat(v.totalHoras.toFixed(1)),
      mediaKmPorDia: v.diasTrabalhados.size > 0 ? Math.round(v.totalKm / v.diasTrabalhados.size) : 0,
      mediaHorasPorDia: v.diasTrabalhados.size > 0 ? parseFloat((v.totalHoras / v.diasTrabalhados.size).toFixed(1)) : 0,
      totalEventos: v.totalEventos,
      kmInicial: v.kmInicial,
      kmFinal: v.kmFinal,
      primeiroRegistro: v.primeiroRegistro,
      ultimoRegistro: v.ultimoRegistro,
      paises: Array.from(v.paises),
      checksRealizados: v.manutencoes
    }));

    // Ordenar por total de KM (mais rodados primeiro)
    resultado.sort((a: any, b: any) => b.totalKm - a.totalKm);

    // Estatísticas gerais
    const geral = {
      totalVeiculos: resultado.length,
      totalKmFrota: resultado.reduce((sum: number, v: any) => sum + v.totalKm, 0),
      totalHorasFrota: parseFloat(resultado.reduce((sum: number, v: any) => sum + v.totalHoras, 0).toFixed(1)),
      totalViagens: resultado.reduce((sum: number, v: any) => sum + v.viagens, 0),
      mediaKmPorVeiculo: resultado.length > 0 ? Math.round(resultado.reduce((sum: number, v: any) => sum + v.totalKm, 0) / resultado.length) : 0
    };

    return NextResponse.json({
      geral,
      veiculos: resultado
    });

  } catch (error) {
    console.error('Error fetching vehicle statistics:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 });
  }
}
