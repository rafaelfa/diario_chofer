'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface MatriculaPlateInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando os 3 campos estão preenchidos (6 caracteres completos) */
  onComplete?: () => void;
}

/** Mantém apenas letras e números, em maiúsculas. */
function sanitize(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Converte o valor completo ("PT12AB" ou "PT-12-AB") nos 3 segmentos de até 2 chars. */
function splitParts(value: string): [string, string, string] {
  const clean = sanitize(value).slice(0, 6);
  return [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6)];
}

/**
 * Input visual de matrícula em 3 quadros (ex: PT-12-AB).
 *
 * Cada quadro aceita QUALQUER combinação de letras e números — sem máscara
 * por posição. O auto-avanço é feito na tecla digitada (rAF), nunca via
 * useEffect, para não roubar o foco/teclado durante a digitação.
 */
export function MatriculaPlateInput({ value, onChange, onComplete }: MatriculaPlateInputProps) {
  const [parts, setParts] = useState<[string, string, string]>(() => splitParts(value));
  // Última string que NÓS enviamos ao pai. Serve para distinguir "mudança externa"
  // (reset do form) de eco da nossa própria onChange — sem isso, um `value` do pai
  // que normalize diferente causaria loop de re-sync e perda do caractere digitado.
  const lastEmitted = useRef<string>(value);

  // Sincroniza com mudanças EXTERNAS (ex: reset do formulário após salvar).
  useEffect(() => {
    if (value === lastEmitted.current) return; // eco do nosso próprio commit → ignora
    lastEmitted.current = value;
    setParts(splitParts(value));
  }, [value]);

  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const commit = (next: [string, string, string]) => {
    setParts(next);
    const joined = next.join('');
    const emitted = joined ? `${joined.slice(0, 2)}-${joined.slice(2, 4)}${joined.length > 4 ? `-${joined.slice(4, 6)}` : ''}` : '';
    lastEmitted.current = emitted;
    onChange(emitted);
  };

  /** Avança o foco ao completar um quadro (dispara na TECLA, não em re-render). */
  const focusNext = (i: number) => {
    requestAnimationFrame(() => refs[i + 1]?.current?.focus());
  };

  const handleChange = (i: number, raw: string) => {
    const val = sanitize(raw).slice(0, 2);
    const next: [string, string, string] = [...parts];
    next[i] = val;
    commit(next);
    if (val.length === 2 && i < 2) focusNext(i);
  };

  // Quando todos os 3 quadros estão completos, avisa o pai (uma vez por valor completo).
  // IMPORTANTE: usa ref para a callback — se `onComplete` ficasse nas dependências do
  // efeito, cada tecla recriaria a closure no pai e dispararia foco em outro campo no
  // meio da digitação (bug: "primeiro quadro não aceita número").
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completeNotified = useRef(false);
  useEffect(() => {
    const isComplete = parts.every((p) => p.length === 2);
    if (isComplete && !completeNotified.current) {
      completeNotified.current = true;
      onCompleteRef.current?.();
    } else if (!isComplete) {
      completeNotified.current = false;
    }
  }, [parts]);

  const boxClass =
    'w-14 h-14 text-center text-xl font-bold uppercase bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 focus-visible:border-blue-500 focus-visible:ring-blue-500/40';

  return (
    <div className="flex items-center justify-center gap-1">
      {parts.map((part, i) => (
        <div key={i} className="contents">
          {i > 0 && <span className="text-2xl font-bold text-slate-400">-</span>}
          <Input
            ref={refs[i]}
            value={part}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => {
              // Backspace num quadro vazio volta para o anterior (UX de placa).
              if (e.key === 'Backspace' && part === '' && i > 0) {
                e.preventDefault();
                refs[i - 1]?.current?.focus();
              }
            }}
            placeholder={['AA', '00', 'BB'][i]}
            maxLength={2}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className={boxClass}
          />
        </div>
      ))}
    </div>
  );
}
