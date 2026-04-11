'use client';

import { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface MatriculaPlateInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando os 3 campos estão preenchidos (6 caracteres completos) */
  onComplete?: () => void;
}

/**
 * Input visual de matrícula europeia (AA-00-BB).
 * Extrai o componente que estava embutido em page.tsx.
 * Suporta auto-focus entre campos e callback onComplete.
 */
export function MatriculaPlateInput({ value, onChange, onComplete }: MatriculaPlateInputProps) {
  const parts = value.split('-');
  const part1 = parts[0] ?? '';
  const part2 = parts[1] ?? '';
  const part3 = parts[2] ?? '';

  const input2Ref = useRef<HTMLInputElement>(null);
  const input3Ref = useRef<HTMLInputElement>(null);

  const rebuild = (p1: string, p2: string, p3: string) =>
    [p1, p2, p3].filter(Boolean).join('-');

  // Quando part1 atinge 2 letras, avançar para part2
  useEffect(() => {
    if (part1.length === 2 && part2.length === 0) {
      input2Ref.current?.focus();
    }
  }, [part1.length, part2.length]);

  // Quando part2 atinge 2 números, avançar para part3
  useEffect(() => {
    if (part2.length === 2 && part3.length === 0) {
      input3Ref.current?.focus();
    }
  }, [part2.length, part3.length]);

  // Quando todos os 3 estão preenchidos, chamar onComplete
  useEffect(() => {
    if (part1.length === 2 && part2.length === 2 && part3.length === 2) {
      onComplete?.();
    }
  }, [part1.length, part2.length, part3.length, onComplete]);

  return (
    <div className="flex items-center justify-center gap-1">
      {/* Parte 1: 2 letras */}
      <Input
        value={part1}
        onChange={(e) => {
          const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
          onChange(rebuild(val, part2, part3));
        }}
        placeholder="PT"
        maxLength={2}
        className="w-14 h-14 text-center text-xl font-bold uppercase bg-blue-600 text-white border-blue-700 placeholder:text-blue-300"
      />

      <span className="text-2xl font-bold text-slate-400">-</span>

      {/* Parte 2: 2 números */}
      <Input
        ref={input2Ref}
        value={part2}
        onChange={(e) => {
          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
          onChange(rebuild(part1, val, part3));
        }}
        placeholder="12"
        maxLength={2}
        className="w-14 h-14 text-center text-xl font-bold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600"
      />

      <span className="text-2xl font-bold text-slate-400">-</span>

      {/* Parte 3: 2 letras/números */}
      <Input
        ref={input3Ref}
        value={part3}
        onChange={(e) => {
          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
          onChange(rebuild(part1, part2, val));
        }}
        placeholder="AB"
        maxLength={2}
        className="w-14 h-14 text-center text-xl font-bold uppercase bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600"
      />
    </div>
  );
}
