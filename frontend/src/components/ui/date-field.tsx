"use client";

/**
 * `DateField` — seletor de data por **três listas** (Dia / Mês / Ano).
 *
 * Substitui o `<input type="date">` nativo, que renderiza um calendário
 * DIFERENTE em cada aparelho/navegador (e às vezes buga). Com três `<select>`
 * o comportamento é IDÊNTICO em todo dispositivo e é fácil pular para um ano
 * distante (ideal para data de nascimento). Valor no formato ISO `YYYY-MM-DD`.
 */

import { useEffect, useMemo, useState } from "react";

import { Select, SelectOption } from "@/components/ui/select";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

interface DateFieldProps {
  /** Data ISO `YYYY-MM-DD` ou string vazia. */
  value: string;
  onChange: (iso: string) => void;
  /** Ano mais recente selecionável (default = ano atual). */
  maxYear?: number;
  /** Ano mais antigo selecionável (default = maxYear − 100). */
  minYear?: number;
  id?: string;
  className?: string;
}

function parse(iso: string): { y: string; m: string; d: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return { y: "", m: "", d: "" };
  return { y: match[1], m: match[2], d: match[3] };
}

function daysInMonth(yy: string, mm: string): number {
  const yi = Number(yy);
  const mi = Number(mm);
  if (!yi || !mi) return 31;
  return new Date(yi, mi, 0).getDate();
}

export function DateField({
  value,
  onChange,
  maxYear,
  minYear,
  id,
  className,
}: DateFieldProps) {
  const yMax = maxYear ?? new Date().getFullYear();
  const yMin = minYear ?? yMax - 100;

  // Estado interno: acumula as seleções parciais. (Derivar tudo do `value`
  // combinado deadlocava — cada escolha isolada era descartada.)
  const initial = parse(value);
  const [y, setY] = useState(initial.y);
  const [m, setM] = useState(initial.m);
  const [d, setD] = useState(initial.d);

  // Sincroniza apenas quando o `value` externo for uma data COMPLETA (ex.:
  // edição/preenchimento programático); um value vazio não apaga o parcial.
  useEffect(() => {
    const p = parse(value);
    if (p.y && p.m && p.d) {
      setY(p.y);
      setM(p.m);
      setD(p.d);
    }
  }, [value]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let yr = yMax; yr >= yMin; yr--) arr.push(yr);
    return arr;
  }, [yMax, yMin]);

  const days = useMemo(() => {
    const total = daysInMonth(y, m);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [y, m]);

  function emit(ny: string, nm: string, nd: string) {
    // Garante dia válido para o mês (ex.: 31 → 30 em abril, 29/28 em fev).
    let fd = nd;
    if (ny && nm && nd) {
      const dd = Math.min(Number(nd), daysInMonth(ny, nm));
      fd = String(dd).padStart(2, "0");
    }
    setY(ny);
    setM(nm);
    setD(fd);
    onChange(ny && nm && fd ? `${ny}-${nm}-${fd}` : "");
  }

  return (
    <div className={className ?? "grid grid-cols-3 gap-2"}>
      <Select
        id={id ? `${id}-dia` : undefined}
        aria-label="Dia"
        value={d}
        onChange={(e) => emit(y, m, e.target.value)}
      >
        <SelectOption value="">Dia</SelectOption>
        {days.map((dd) => (
          <SelectOption key={dd} value={String(dd).padStart(2, "0")}>
            {dd}
          </SelectOption>
        ))}
      </Select>
      <Select
        aria-label="Mês"
        value={m}
        onChange={(e) => emit(y, e.target.value, d)}
      >
        <SelectOption value="">Mês</SelectOption>
        {MESES.map((nome, i) => (
          <SelectOption key={nome} value={String(i + 1).padStart(2, "0")}>
            {nome}
          </SelectOption>
        ))}
      </Select>
      <Select
        aria-label="Ano"
        value={y}
        onChange={(e) => emit(e.target.value, m, d)}
      >
        <SelectOption value="">Ano</SelectOption>
        {years.map((yr) => (
          <SelectOption key={yr} value={String(yr)}>
            {yr}
          </SelectOption>
        ))}
      </Select>
    </div>
  );
}
