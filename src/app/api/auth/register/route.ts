import { NextRequest, NextResponse } from 'next/server';
import { createFirstUser, hasUsers } from '@/lib/auth';

// POST - Criar primeiro usuário (apenas se não houver usuários)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name } = body;

    // Validações
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Usuário deve ter pelo menos 3 caracteres' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar se já existe usuário
    const existingUsers = await hasUsers();
    if (existingUsers) {
      return NextResponse.json(
        { error: 'Já existe um usuário registado. Use o login.' },
        { status: 400 }
      );
    }

    // Criar primeiro usuário
    const result = await createFirstUser(username, password, name);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usuário criado com sucesso! Faça login.' 
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}
