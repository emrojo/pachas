'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Delete, RotateCcw, Sparkles, Check, Calculator as CalcIcon } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

export interface VirtualCalculatorProps {
  initialExpression?: string;
  onResultChange?: (result: number) => void;
  className?: string;
}

export const VirtualCalculator: React.FC<VirtualCalculatorProps> = ({
  initialExpression,
  onResultChange,
  className = '',
}) => {
  const { t } = useTranslation();
  const [displayValue, setDisplayValue] = useState('0');
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [memory, setMemory] = useState<number | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [lastOperator, setLastOperator] = useState<string | null>(null);
  const [justCalculated, setJustCalculated] = useState(false);
  const [flashNotification, setFlashNotification] = useState<string | null>(null);

  // Safely evaluate math expression string with European/standard math
  const evaluateMath = useCallback((exprStr: string): number | null => {
    try {
      // Replace symbols with standard JS operators
      const sanitized = exprStr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/,/g, '.')
        .replace(/[^0-9+\-*/.() ]/g, '');

      // Defensively parse arithmetic
      // eslint-disable-next-line no-new-func
      const result = Function(`'use strict'; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 10000) / 10000;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Handle number and decimal input
  const inputDigit = useCallback((digit: string) => {
    if (waitingForOperand || justCalculated) {
      setDisplayValue(digit === '.' ? '0.' : digit);
      setWaitingForOperand(false);
      setJustCalculated(false);
    } else {
      if (digit === '.') {
        if (!displayValue.includes('.')) {
          setDisplayValue(displayValue + '.');
        }
      } else {
        setDisplayValue(displayValue === '0' ? digit : displayValue + digit);
      }
    }
  }, [displayValue, waitingForOperand, justCalculated]);

  // Handle operators (+, -, ×, ÷)
  const performOperator = useCallback((nextOperator: string) => {
    const inputValue = parseFloat(displayValue.replace(/,/g, '.'));

    if (justCalculated) {
      setExpression(`${displayValue} ${nextOperator}`);
      setWaitingForOperand(true);
      setJustCalculated(false);
      setLastOperator(nextOperator);
      return;
    }

    if (expression && !waitingForOperand) {
      const fullExpr = `${expression} ${displayValue}`;
      const evaluated = evaluateMath(fullExpr);
      if (evaluated !== null) {
        setDisplayValue(String(evaluated));
        setExpression(`${evaluated} ${nextOperator}`);
        if (onResultChange) onResultChange(evaluated);
      } else {
        setExpression(`${displayValue} ${nextOperator}`);
      }
    } else {
      setExpression(`${displayValue} ${nextOperator}`);
    }

    setWaitingForOperand(true);
    setLastOperator(nextOperator);
  }, [displayValue, expression, waitingForOperand, justCalculated, evaluateMath, onResultChange]);

  // Handle equals (=)
  const calculateResult = useCallback(() => {
    if (!expression) return;
    const fullExpr = `${expression} ${displayValue}`;
    const result = evaluateMath(fullExpr);

    if (result !== null) {
      const formattedHistory = `${fullExpr} = ${result}`;
      setHistory((prev) => [formattedHistory, ...prev.slice(0, 4)]);
      setDisplayValue(String(result));
      setExpression('');
      setJustCalculated(true);
      setWaitingForOperand(false);
      setLastOperator(null);
      if (onResultChange) onResultChange(result);
    }
  }, [expression, displayValue, evaluateMath, onResultChange]);

  // Clear All
  const clearAll = useCallback(() => {
    setDisplayValue('0');
    setExpression('');
    setWaitingForOperand(false);
    setJustCalculated(false);
    setLastOperator(null);
  }, []);

  // Backspace
  const handleBackspace = useCallback(() => {
    if (justCalculated || waitingForOperand) return;
    if (displayValue.length > 1) {
      setDisplayValue(displayValue.slice(0, -1));
    } else {
      setDisplayValue('0');
    }
  }, [displayValue, justCalculated, waitingForOperand]);

  // Toggle Sign (±)
  const toggleSign = useCallback(() => {
    const val = parseFloat(displayValue.replace(/,/g, '.'));
    if (val !== 0) {
      setDisplayValue(String(-val));
    }
  }, [displayValue]);

  // Percentage (%)
  const inputPercent = useCallback(() => {
    const val = parseFloat(displayValue.replace(/,/g, '.'));
    const result = val / 100;
    setDisplayValue(String(result));
  }, [displayValue]);

  // Public method to load external expression into calculator
  const loadExternalExpression = useCallback((exprStr: string) => {
    const evaluated = evaluateMath(exprStr);
    if (evaluated !== null) {
      setExpression(exprStr);
      setDisplayValue(String(evaluated));
      setJustCalculated(true);
      setWaitingForOperand(false);
      setHistory((prev) => [`${exprStr} = ${evaluated}`, ...prev.slice(0, 4)]);
      setFlashNotification(t('audit.calcLoaded'));
      setTimeout(() => setFlashNotification(null), 2500);
      if (onResultChange) onResultChange(evaluated);
    }
  }, [evaluateMath, onResultChange, t]);

  // Watch for initialExpression changes from parent
  useEffect(() => {
    if (initialExpression) {
      loadExternalExpression(initialExpression);
    }
  }, [initialExpression, loadExternalExpression]);

  // Physical Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in text inputs or textareas
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        inputDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        inputDigit('.');
      } else if (e.key === '+' || e.key === '-') {
        performOperator(e.key);
      } else if (e.key === '*') {
        performOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        performOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        calculateResult();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        clearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputDigit, performOperator, calculateResult, handleBackspace, clearAll]);

  // Format display string with European thousand periods for display
  const formatDisplay = (numStr: string) => {
    if (numStr === 'Error' || numStr === 'NaN') return 'Error';
    const parts = numStr.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
  };

  return (
    <div
      className={`bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-800 flex flex-col justify-between select-none ${className}`}
    >
      {/* Header / Brand */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CalcIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {t('audit.calculatorTitle')}
          </span>
        </div>

        {flashNotification && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse flex items-center gap-1">
            <Check className="w-3 h-3" />
            {flashNotification}
          </span>
        )}
      </div>

      {/* LCD Display Screen */}
      <div className="my-4 bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 flex flex-col justify-end items-end min-h-[90px] shadow-inner font-mono relative overflow-hidden">
        {/* Upper expression / memory line */}
        <div className="text-xs text-slate-400 h-5 truncate max-w-full text-right">
          {expression || (history.length > 0 ? history[0] : '')}
        </div>

        {/* Main Number Display */}
        <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-400 overflow-x-auto max-w-full no-scrollbar">
          {formatDisplay(displayValue)}
        </div>
      </div>

      {/* Calculator Keypad */}
      <div className="grid grid-cols-4 gap-2 text-sm font-bold">
        {/* Row 1 */}
        <button
          type="button"
          onClick={clearAll}
          className="p-3 sm:p-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          title={t('audit.clearAll')}
        >
          AC
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          title={t('audit.backspace')}
        >
          <Delete className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={inputPercent}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          %
        </button>

        <button
          type="button"
          onClick={() => performOperator('÷')}
          className={`p-3 sm:p-3.5 rounded-xl border active:scale-95 transition-all flex items-center justify-center text-lg cursor-pointer ${
            lastOperator === '÷'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
          }`}
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => inputDigit('7')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => inputDigit('8')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => inputDigit('9')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => performOperator('×')}
          className={`p-3 sm:p-3.5 rounded-xl border active:scale-95 transition-all flex items-center justify-center text-lg cursor-pointer ${
            lastOperator === '×'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
          }`}
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => inputDigit('4')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => inputDigit('5')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => inputDigit('6')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => performOperator('-')}
          className={`p-3 sm:p-3.5 rounded-xl border active:scale-95 transition-all flex items-center justify-center text-lg cursor-pointer ${
            lastOperator === '-'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
          }`}
        >
          -
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={() => inputDigit('1')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => inputDigit('2')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => inputDigit('3')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => performOperator('+')}
          className={`p-3 sm:p-3.5 rounded-xl border active:scale-95 transition-all flex items-center justify-center text-lg cursor-pointer ${
            lastOperator === '+'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
          }`}
        >
          +
        </button>

        {/* Row 5 */}
        <button
          type="button"
          onClick={toggleSign}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          ±
        </button>
        <button
          type="button"
          onClick={() => inputDigit('0')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => inputDigit('.')}
          className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-white border border-slate-700/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          ,
        </button>
        <button
          type="button"
          onClick={calculateResult}
          className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black shadow-lg shadow-emerald-500/30 border border-emerald-400/40 active:scale-95 transition-all flex items-center justify-center text-lg cursor-pointer"
        >
          =
        </button>
      </div>

      {/* Footer hint */}
      <div className="pt-3 mt-2 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
        {t('audit.calculatorHint')}
      </div>
    </div>
  );
};
