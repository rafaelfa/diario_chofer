import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET - Listar todos os dias de trabalho
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Prisma.WorkDayWhereInput = {};

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const workDays = await db.workDay.findMany({
      where,
      include: {
        events: {
          orderBy: { time: 'asc' }
        }
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'desc' }
      ]
    });

    // Adicionar campos calculados
    const workDaysWithCalculations = workDays.map(day => {
      const kmTraveled = day.endKm && day.startKm ? day.endKm - day.startKm : null;

      // Calcular horas trabalhadas
      let hoursWorked: number | null = null;
      if (day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        hoursWorked = (endMinutes - startMinutes) / 60;
        if (hoursWorked < 0) hoursWorked += 24; // Passou da meia-noite
      }

      return {
        ...day,
        kmTraveled,
        hoursWorked: hoursWorked ? parseFloat(hoursWorked.toFixed(2)) : null,
        totalEvents: day.events.length
      };
    });

    return NextResponse.json(workDaysWithCalculations);
  } catch (error) {
    console.error('Error fetching work days:', error);
    return NextResponse.json({ error: 'Erro ao buscar dias de trabalho' }, { status: 500 });
  }
}

// POST - Criar novo dia de trabalho (sempre cria novo)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('=== RECEBENDO DADOS ===');
    console.log('Body completo:', JSON.stringify(body, null, 2));
    console.log('startKm recebido:', body.startKm, 'tipo:', typeof body.startKm);
    
    const { 
      date, 
      startTime, 
      startCountry, 
      startKm, 
      lastRest, 
      truckCheck,
      matricula 
    } = body;

    // Validar formato da matrícula (formato europeu: AA-00-BB ou AA-00-00)
    if (matricula) {
      const matriculaRegex = /^[A-Z]{2}-\d{2}-[A-Z0-9]{2}$/;
      if (!matriculaRegex.test(matricula.toUpperCase())) {
        return NextResponse.json({ 
          error: 'Formato de matrícula inválido. Use o formato AA-00-BB (ex: PT-12-AB)' 
        }, { status: 400 });
      }
    }

    // Se tiver matrícula e KM inicial, validar contra último registro
    if (matricula && startKm) {
      const kmValue = parseInt(String(startKm), 10);
      const lastRecord = await db.workDay.findFirst({
        where: { 
          matricula: matricula.toUpperCase(),
          endTime: { not: null } // Apenas registros finalizados
        },
        orderBy: { date: 'desc' },
        select: { endKm: true, date: true }
      });

      if (lastRecord && lastRecord.endKm && kmValue < lastRecord.endKm) {
        return NextResponse.json({ 
          error: `KM inicial (${kmValue}) não pode ser menor que o KM final do último registro deste caminhão (${lastRecord.endKm})` 
        }, { status: 400 });
      }
    }

    // Converter a data para o início do dia (UTC)
    const workDate = new Date(date);
    workDate.setHours(0, 0, 0, 0);

    // Preparar dados - converter startKm para número
    const kmValue = startKm ? parseInt(String(startKm), 10) : null;
    console.log('KM convertido:', kmValue, 'tipo:', typeof kmValue);
    
    const dataToSave = {
      date: workDate,
      startTime: startTime || new Date().toTimeString().slice(0, 5),
      startCountry: startCountry || null,
      startKm: kmValue,
      lastRest: lastRest || null,
      truckCheck: Boolean(truckCheck),
      matricula: matricula ? matricula.toUpperCase() : null,
    };
    
    console.log('=== DADOS A SALVAR ===');
    console.log(JSON.stringify(dataToSave, null, 2));

    // Sempre criar novo registro (permite múltiplas jornadas por dia)
    const workDay = await db.workDay.create({
      data: dataToSave,
      include: {
        events: true
      }
    });

    console.log('=== REGISTRO CRIADO ===');
    console.log('workDay.startKm:', workDay.startKm);
    console.log(JSON.stringify(workDay, null, 2));

    return NextResponse.json(workDay);
  } catch (error) {
    console.error('Error creating work day:', error);
    return NextResponse.json({ error: 'Erro ao criar dia de trabalho' }, { status: 500 });
  }
}
