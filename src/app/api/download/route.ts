import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DOWNLOAD_DIR = '/home/z/my-project/download';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return NextResponse.json({ error: 'Arquivo não especificado' }, { status: 400 });
    }

    // Segurança: prevenir path traversal
    const safeName = path.basename(filename);
    const filepath = path.join(DOWNLOAD_DIR, safeName);

    // Verificar se o arquivo está dentro do diretório permitido
    if (!filepath.startsWith(DOWNLOAD_DIR)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se o arquivo existe
    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    // Ler o arquivo
    const fileBuffer = fs.readFileSync(filepath);

    // Determinar o content-type
    const ext = path.extname(safeName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.zip': 'application/zip',
      '.sql': 'text/plain',
      '.md': 'text/markdown',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.txt': 'text/plain',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Retornar o arquivo
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Erro no download:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
