/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Settings, 
  Play, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Brain,
  ChevronLeft,
  Calculator,
  Divide,
  Sparkles,
  User,
  History,
  X,
  Info,
  Trash2,
  Timer,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { Exercise, Operation, UserSettings, SessionResult, ThemePreference } from './types';

const TABLES = Array.from({ length: 11 }, (_, i) => i);
const APP_VERSION = __APP_VERSION__;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minuten

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Licht', icon: Sun },
  { value: 'auto', label: 'Automatisch', icon: Monitor },
  { value: 'dark', label: 'Donker', icon: Moon },
];

const PERFECT_SCORE_MESSAGES = [
  'Wow, geen enkele fout! Jij bent een echte tafelkampioen!',
  'Foutloos! Dat verdient een gouden medaille! 🏅',
  'Perfect! Jij hebt deze tafels helemaal onder de knie.',
  'Voltreffer! Alles goed, knap hoor!',
  'Wauw, 100%! Jij bent niet te stoppen!',
  'Superbrein! Geen enkele som ontsnapte aan jou.',
];

const GOOD_SCORE_MESSAGES = [
  'Goed bezig! Nog even oefenen en het is perfect.',
  'Sterk gedaan! Je wordt steeds beter.',
  'Knap werk! Je bent al een heel eind op weg.',
  'Mooi resultaat! Op naar de volgende ronde.',
  'Goed gedaan! Je hersenen hebben hard gewerkt.',
];

const ENCOURAGE_MESSAGES = [
  'Goed geprobeerd! Oefening baart kunst.',
  'Elke keer oefenen maakt je sterker. Ga zo door!',
  'Niet getreurd, volgende keer gaat het nog beter!',
  'Je bent op de goede weg, blijf oefenen!',
  'Fouten maken hoort erbij — zo leer je het echt.',
];

export default function App() {
  const [mode, setMode] = useState<'settings' | 'practice' | 'results'>('settings');
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('tafel-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      playerName: '',
      multiplicationTables: [],
      divisionTables: [],
      exerciseCount: 10,
      trackTime: true,
      theme: 'auto',
      ...parsed
    };
  });
  const [sessionHistory, setSessionHistory] = useState<SessionResult[]>(() => {
    const saved = localStorage.getItem('tafel-session-history');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // Migrate old data if necessary
      return parsed.map((item: any) => ({
        ...item,
        multiplicationTables: item.multiplicationTables || [],
        divisionTables: item.divisionTables || []
      }));
    } catch (e) {
      return [];
    }
  });
  
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [exercisePool, setExercisePool] = useState<Exercise[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [history, setHistory] = useState<{ exercise: Exercise; correct: boolean }[]>([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedSession, setSelectedSession] = useState<SessionResult | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const handleAnswerRef = useRef<(answer: string | null) => void>(() => {});

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.05) {
          stopTimer();
          handleAnswerRef.current(null); // Timeout
          return 0;
        }
        return prev - 0.05;
      });
    }, 50);
  }, [stopTimer]);

  const playSuccessSound = useCallback(async () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const localUrl = (window.location.origin + baseUrl + `/success.mp3`).replace(/([^:]\/)\/+/g, "$1");
    
    try {
      const audio = new Audio(localUrl);
      await audio.play();
    } catch (e) {
      console.warn('Audio afspelen mislukt:', e);
    }
  }, []);

  const handleAnswer = useCallback((answer: string | null) => {
    if (!currentExercise || feedback) return;

    stopTimer();
    const isCorrect = answer !== null && parseInt(answer) === currentExercise.result;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    const nextStats = {
      correct: stats.correct + (isCorrect ? 1 : 0),
      total: stats.total + 1
    };
    
    setStats(nextStats);
    setHistory(prev => [...prev, { exercise: currentExercise, correct: isCorrect }]);

    setTimeout(() => {
      if (nextStats.total >= activeTotal) {
        // Save to session history
        const isTimeTracked = settings.trackTime !== false;
        const now = Date.now();
        const duration = isTimeTracked && sessionStartTime ? now - sessionStartTime : undefined;
        const averageTimePerSum = isTimeTracked && duration !== undefined ? duration / nextStats.total : undefined;
        const allCorrect = nextStats.correct === nextStats.total;

        let recordBeaten = false;
        if (isTimeTracked && allCorrect && averageTimePerSum !== undefined) {
          if (!settings.personalBest || averageTimePerSum < settings.personalBest) {
            setSettings(prev => ({ ...prev, personalBest: averageTimePerSum }));
            recordBeaten = true;
          }
        }
        setIsNewRecord(recordBeaten);

        const scoreRatio = nextStats.correct / nextStats.total;
        const messagePool = allCorrect
          ? PERFECT_SCORE_MESSAGES
          : scoreRatio >= 0.7
            ? GOOD_SCORE_MESSAGES
            : ENCOURAGE_MESSAGES;
        setResultMessage(messagePool[Math.floor(Math.random() * messagePool.length)]);

        const result: SessionResult = {
          id: crypto.randomUUID(),
          playerName: settings.playerName || 'Anoniem',
          correct: nextStats.correct,
          total: nextStats.total,
          timestamp: now,
          duration,
          averageTimePerSum,
          trackTime: isTimeTracked,
          multiplicationTables: [...settings.multiplicationTables],
          divisionTables: [...settings.divisionTables],
          history: [...history, { exercise: currentExercise, correct: isCorrect }]
        };
        setSessionHistory(prev => [result, ...prev].slice(0, 5)); // Keep last 5
        
        // Play success sound if 0 errors
        if (allCorrect) {
          playSuccessSound();
          
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: recordBeaten ? ['#fbbf24', '#f59e0b', '#d97706'] : ['#10b981', '#3b82f6', '#f59e0b']
          });
        }

        setMode('results');
        setSessionStartTime(null);
      } else {
        setExercisePool(prev => prev.slice(1));
        setCurrentExercise(null); // Clear current to trigger useEffect
        setUserAnswer('');
        setFeedback(null);
        if (settings.trackTime !== false) {
          startTimer();
        }
      }
    }, 500);
  }, [
    currentExercise, 
    feedback, 
    stats, 
    activeTotal, 
    startTimer, 
    stopTimer, 
    settings.multiplicationTables, 
    settings.divisionTables,
    settings.playerName, 
    settings.trackTime,
    settings.personalBest,
    sessionStartTime,
    history, 
    playSuccessSound
  ]);

  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  useEffect(() => {
    if (mode === 'practice' && !currentExercise && exercisePool.length > 0) {
      setCurrentExercise(exercisePool[0]);
    }
  }, [mode, currentExercise, exercisePool]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (userAnswer === '') return;
    handleAnswer(userAnswer);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // Auto-focus logic
  useEffect(() => {
    if (mode === 'practice' && !feedback) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode, currentExercise, feedback]);

  // Keep focus if user clicks away during practice
  useEffect(() => {
    const handleGlobalClick = () => {
      if (mode === 'practice' && !feedback) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [mode, feedback]);

  // Check periodically whether a newer version is live on GitHub Pages
  useEffect(() => {
    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL || '/';
        const url = `${baseUrl}version.json?t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.version && data.version !== APP_VERSION) {
          setUpdateAvailable(true);
        }
      } catch (e) {
        // Offline of netwerkfout: stil negeren, we proberen het later opnieuw
      }
    };

    checkForUpdate();
    const interval = setInterval(checkForUpdate, VERSION_CHECK_INTERVAL);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Apply the light/dark/auto theme preference to <html data-theme="...">
  useEffect(() => {
    const theme = settings.theme || 'auto';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyResolvedTheme = () => {
      const resolved = theme === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.style.colorScheme = resolved;
    };

    applyResolvedTheme();

    if (theme === 'auto') {
      mediaQuery.addEventListener('change', applyResolvedTheme);
      return () => mediaQuery.removeEventListener('change', applyResolvedTheme);
    }
  }, [settings.theme]);

  useEffect(() => {
    localStorage.setItem('tafel-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('tafel-session-history', JSON.stringify(sessionHistory));
  }, [sessionHistory]);

  // One-time cleanup: mastery tracking was removed, drop any leftover data.
  useEffect(() => {
    localStorage.removeItem('tafel-mastery');
  }, []);

  const totalPossible = (settings.multiplicationTables.length * 11) + (settings.divisionTables.length * 11);

  useEffect(() => {
    if (settings.exerciseCount !== 'all' && settings.exerciseCount > totalPossible && totalPossible > 0) {
      setSettings(prev => ({ ...prev, exerciseCount: 10 }));
    }
  }, [totalPossible, settings.exerciseCount]);

  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!validationMessage) return;
    const timer = setTimeout(() => setValidationMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [validationMessage]);

  const clearHistory = () => {
    setSessionHistory([]);
    setShowClearHistoryModal(false);
  };

  const toggleTable = (num: number, op: Operation) => {
    setSettings(prev => {
      const key = op === 'multiplication' ? 'multiplicationTables' : 'divisionTables';
      const current = prev[key];
      const next = current.includes(num) 
        ? current.filter(n => n !== num)
        : [...current, num].sort((a, b) => a - b);
      return { ...prev, [key]: next };
    });
  };

  const startPractice = () => {
    if (!settings.playerName.trim()) {
      setValidationMessage('Vul eerst je naam in!');
      return;
    }
    if (settings.multiplicationTables.length === 0 && settings.divisionTables.length === 0) {
      setValidationMessage('Kies eerst minstens één tafel om te oefenen!');
      return;
    }
    setValidationMessage(null);

    // Generate pool
    const pool: Exercise[] = [];
    
    settings.multiplicationTables.forEach(table => {
      for (let i = 0; i <= 10; i++) {
        pool.push({ a: i, b: table, op: 'multiplication', result: table * i });
      }
    });

    settings.divisionTables.forEach(table => {
      for (let i = 0; i <= 10; i++) {
        pool.push({ a: table * i, b: table, op: 'division', result: i });
      }
    });

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const finalPool = settings.exerciseCount === 'all' ? pool : pool.slice(0, settings.exerciseCount);

    setStats({ correct: 0, total: 0 });
    setHistory([]);
    setActiveTotal(finalPool.length);
    setExercisePool(finalPool);
    setCurrentExercise(finalPool[0]);
    setMode('practice');
    setUserAnswer('');
    setFeedback(null);
    setIsNewRecord(false);
    if (settings.trackTime !== false) {
      setSessionStartTime(Date.now());
      startTimer();
    } else {
      setSessionStartTime(null);
      stopTimer();
    }
  };

  const retryMistakes = () => {
    const mistakes = history.filter(h => !h.correct).map(h => h.exercise);
    if (mistakes.length === 0) return;

    // Shuffle mistakes
    const pool = [...mistakes];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    setStats({ correct: 0, total: 0 });
    setHistory([]);
    setActiveTotal(pool.length);
    setExercisePool(pool);
    setCurrentExercise(pool[0]);
    setMode('practice');
    setUserAnswer('');
    setFeedback(null);
    if (settings.trackTime !== false) {
      startTimer();
    } else {
      stopTimer();
    }
  };

  const isPracticing = mode === 'practice';

  const themeToggle = (
    <div className="inline-flex items-center p-0.5 rounded-full bg-stone-100 dark:bg-stone-800/80 border border-stone-200/60 dark:border-stone-700/60">
      {THEME_OPTIONS.map(opt => {
        const Icon = opt.icon;
        const isActive = (settings.theme || 'auto') === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, theme: opt.value }))}
            aria-label={opt.label}
            aria-pressed={isActive}
            title={opt.label}
            className={`
              p-1 rounded-full transition-colors
              ${isActive
                ? 'bg-white dark:bg-stone-600 text-purple-600 dark:text-purple-300 shadow-sm'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'}
            `}
          >
            <Icon className="w-3 h-3" />
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 min-h-screen flex flex-col font-sans transition-[max-width] duration-300 ${isPracticing ? 'py-4' : 'py-8'}`}>
      {/* Small screens: logo takes the full width, so the toggle gets its own row above it */}
      <div className="flex justify-end mb-1.5 lg:hidden">
        {themeToggle}
      </div>

      <header className={`relative text-center ${isPracticing ? 'mb-2' : 'mb-8'}`}>
        {/* Wide screens: plenty of room beside the logo, so the toggle sits inline and costs no extra height */}
        <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2">
          {themeToggle}
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`flex items-center justify-center gap-2 ${isPracticing ? '' : 'gap-3 mb-2'}`}
        >
          <Brain className={`text-purple-500 transition-all ${isPracticing ? 'w-6 h-6' : 'w-10 h-10'}`} />
          <h1 className={`font-bold text-emerald-600 font-display transition-all ${isPracticing ? 'text-xl' : 'text-4xl'}`}>
            TafelKampioen
          </h1>
        </motion.div>
        {!isPracticing && <p className="text-stone-500 dark:text-stone-400">Word de meester van de tafels!</p>}
      </header>

      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-blue-50 border border-blue-100 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900/50 dark:text-blue-300 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCw className={`w-4 h-4 shrink-0 ${isReloading ? 'animate-spin' : ''}`} />
              Nieuwe versie beschikbaar!
            </div>
            <button
              onClick={() => {
                setIsReloading(true);
                // Cache-busting query zodat de browser echt een verse pagina ophaalt
                // in plaats van de oude versie uit cache te herladen.
                const url = new URL(window.location.href);
                url.searchParams.set('_v', Date.now().toString());
                window.location.href = url.toString();
              }}
              disabled={isReloading}
              className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shrink-0 disabled:opacity-60 disabled:cursor-wait"
            >
              {isReloading ? 'Bezig...' : 'Vernieuwen'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {mode === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="glass rounded-3xl p-6 space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-200">
                  <Settings className="w-5 h-5" /> Instellingen
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" /> Naam van de speler
                    </h3>
                    <input
                      type="text"
                      value={settings.playerName}
                      onChange={(e) => setSettings(prev => ({ ...prev, playerName: e.target.value }))}
                      placeholder="Typ je naam..."
                      className="w-full px-4 py-3 rounded-xl bg-stone-100 dark:bg-stone-800 border-2 border-transparent focus:border-purple-400 focus:bg-white dark:focus:bg-stone-900 outline-none transition-all font-medium text-stone-700 dark:text-stone-200"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
                      <Calculator className="w-4 h-4" /> Vermenigvuldigen (×)
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-2">
                      {TABLES.map(n => (
                        <button
                          key={`mul-${n}`}
                          onClick={() => toggleTable(n, 'multiplication')}
                          className={`
                            h-12 rounded-xl font-bold transition-all duration-200
                            ${settings.multiplicationTables.includes(n)
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40 scale-105'
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700'}
                          `}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
                      <Divide className="w-4 h-4" /> Delen (÷)
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-2">
                      {TABLES.filter(n => n !== 0).map(n => (
                        <button
                          key={`div-${n}`}
                          onClick={() => toggleTable(n, 'division')}
                          className={`
                            h-12 rounded-xl font-bold transition-all duration-200
                            ${settings.divisionTables.includes(n)
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40 scale-105'
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700'}
                          `}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-stone-100 dark:border-stone-800 space-y-6">
                  {settings.personalBest && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-50 border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-xl text-amber-600 dark:text-amber-400">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-amber-600/60 dark:text-amber-400/70 tracking-wider">Snelheidsrecord</p>
                          <p className="text-amber-900 dark:text-amber-200 font-bold">{(settings.personalBest / 1000).toFixed(2)}s <span className="text-xs font-normal opacity-60">per som</span></p>
                        </div>
                      </div>
                      {settings.trackTime === false && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-lg font-semibold">
                          Tijd uit
                        </span>
                      )}
                    </motion.div>
                  )}

                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Aantal sommen
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {([10, 20, 50, 'all'] as const).map(count => {
                        const isDisabled = count !== 'all' && count > totalPossible;
                        return (
                          <button
                            key={`count-${count}`}
                            disabled={isDisabled}
                            onClick={() => setSettings(prev => ({ ...prev, exerciseCount: count }))}
                            className={`
                              h-12 rounded-xl font-bold transition-all duration-200
                              ${isDisabled ? 'opacity-20 cursor-not-allowed grayscale' : ''}
                              ${settings.exerciseCount === count
                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-200 dark:shadow-purple-900/40 scale-105'
                                : 'bg-stone-100 text-stone-400 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700'}
                            `}
                          >
                            {count === 'all' ? 'Alle' : count}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-orange-50 border border-orange-100 dark:bg-orange-950/30 dark:border-orange-900/50 rounded-2xl px-4 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                        <span className="font-bold text-sm text-stone-700 dark:text-stone-200">Tijd bijhouden</span>
                      </div>
                      <p className="text-xs text-stone-400">
                        {settings.trackTime !== false
                          ? 'Snelheid meten en tijdslimiet (15 sec per som)'
                          : 'Rustig oefenen zonder tijdslimiet'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.trackTime !== false}
                      onClick={() => setSettings(prev => ({ ...prev, trackTime: !(prev.trackTime !== false) }))}
                      className={`
                        relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                        ${settings.trackTime !== false ? 'bg-emerald-500' : 'bg-stone-200 dark:bg-stone-700'}
                      `}
                    >
                      <span
                        aria-hidden="true"
                        className={`
                          pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
                          ${settings.trackTime !== false ? 'translate-x-5' : 'translate-x-0'}
                        `}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {validationMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-50 border border-red-100 text-red-600 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold overflow-hidden"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {validationMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={startPractice}
                className={`
                  w-full py-4 text-white rounded-2xl font-bold text-xl shadow-xl transition-all flex items-center justify-center gap-2 group
                  ${totalPossible === 0
                    ? 'bg-stone-300 dark:bg-stone-700 shadow-none'
                    : 'bg-emerald-600 shadow-emerald-100 dark:shadow-none hover:bg-emerald-700'}
                `}
              >
                <Play className={`w-6 h-6 transition-transform ${totalPossible > 0 ? 'group-hover:translate-x-1' : ''}`} />
                Start met oefenen!
              </button>

              {sessionHistory.length > 0 && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                      <History className="w-4 h-4" /> Laatste resultaten
                    </h3>
                    <button
                      onClick={() => setShowClearHistoryModal(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-xs font-bold text-stone-300 dark:text-stone-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      title="Historiek wissen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sessionHistory.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => setSelectedSession(result)}
                        className="w-full flex flex-col py-3 px-4 bg-white/50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700 space-y-1 hover:bg-white hover:border-purple-200 dark:hover:bg-stone-800 dark:hover:border-purple-800 transition-all text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-700 dark:text-stone-200">{result.playerName}</span>
                          <div className="flex items-center gap-2">
                            {result.trackTime !== false && result.averageTimePerSum !== undefined && (
                              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {(result.averageTimePerSum / 1000).toFixed(1)}s
                              </span>
                            )}
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {result.correct} / {result.total}
                            </span>
                            <Info className="w-3 h-3 text-stone-300 dark:text-stone-600" />
                          </div>
                        </div>
                        <div className="text-[10px] text-stone-400 flex flex-wrap gap-1">
                          {(result.multiplicationTables?.length ?? 0) > 0 && (
                            <span>×: {result.multiplicationTables.join(', ')}</span>
                          )}
                          {(result.multiplicationTables?.length ?? 0) > 0 && (result.divisionTables?.length ?? 0) > 0 && <span>|</span>}
                          {(result.divisionTables?.length ?? 0) > 0 && (
                            <span>÷: {result.divisionTables.join(', ')}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {mode === 'practice' && currentExercise && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center w-full"
            >
              <div className="w-full max-w-md lg:max-w-xl flex-1 flex flex-col glass rounded-3xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-stone-100 dark:bg-stone-800">
                  <motion.div
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.total / activeTotal) * 100}%` }}
                  />
                </div>

                {/* Timer bar */}
                {settings.trackTime !== false && (
                  <div className="absolute top-2 left-0 w-full h-1.5 bg-stone-50 dark:bg-stone-800/60 overflow-hidden">
                    <motion.div 
                      className={`h-full transition-colors duration-300 ${timeLeft < 3 ? 'bg-red-500' : 'bg-orange-400'}`}
                      initial={{ width: '100%' }}
                      animate={{ width: `${(timeLeft / 15) * 100}%` }}
                      transition={{ duration: 0.05, ease: 'linear' }}
                    />
                  </div>
                )}

                <div className="flex justify-between items-center mb-8">
                  <button 
                    onClick={() => {
                      stopTimer();
                      setMode('settings');
                    }}
                    className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-400 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <span className="font-bold text-stone-400">
                    Vraag {feedback ? stats.total : stats.total + 1} van {activeTotal}
                  </span>
                  <div className="w-10" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="text-7xl sm:text-8xl font-display font-bold text-stone-800 dark:text-stone-100 flex items-center justify-center gap-4">
                    {currentExercise.display ? (
                      <span className="text-5xl">{currentExercise.display}</span>
                    ) : (
                      <>
                        <span>{currentExercise.a}</span>
                        <span className="text-emerald-500 text-5xl">
                          {currentExercise.op === 'multiplication' ? '×' : '÷'}
                        </span>
                        <span>{currentExercise.b}</span>
                      </>
                    )}
                    <span className="text-stone-300 dark:text-stone-600">=</span>
                  </div>

                  {currentExercise.isChallenge && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute top-12 right-8 bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Challenge!
                    </motion.div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      disabled={!!feedback}
                      className={`
                        w-full text-center text-5xl font-bold py-4 rounded-2xl border-4 outline-none transition-all
                        ${feedback === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                          feedback === 'incorrect' ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                          'border-stone-200 dark:border-stone-700 focus:border-emerald-400 bg-white dark:bg-stone-900'}
                      `}
                      placeholder="?"
                    />
                    
                    <AnimatePresence>
                      {feedback && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute -right-4 -top-4"
                        >
                          {feedback === 'correct' ? (
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 fill-white" />
                          ) : (
                            <XCircle className="w-12 h-12 text-red-500 fill-white" />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="submit"
                    disabled={!!feedback || userAnswer === ''}
                    className={`
                      w-full py-4 rounded-2xl font-bold text-xl shadow-lg transition-all flex items-center justify-center gap-2
                      ${!!feedback || userAnswer === ''
                        ? 'bg-stone-100 text-stone-300 dark:bg-stone-800 dark:text-stone-600 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-emerald-100 dark:shadow-none'}
                    `}
                  >
                    Controleer
                  </button>
                </form>

                <p className="mt-4 text-stone-400 text-[10px] font-medium uppercase tracking-widest">
                  Klik op de knop of druk op Enter
                </p>
              </div>
            </motion.div>
          )}

          {mode === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-3xl p-8 text-center space-y-8 w-full max-w-2xl lg:max-w-3xl mx-auto"
            >
              <div className="space-y-2">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <Brain className="w-full h-full text-purple-500" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles className="w-8 h-8 text-yellow-400" />
                  </motion.div>
                </div>
                <h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100">Goed gedaan, {settings.playerName}!</h2>
                <p className="text-stone-500 dark:text-stone-400">{resultMessage}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-6 rounded-2xl">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.correct}</div>
                  <div className="text-sm text-emerald-600/60 dark:text-emerald-400/70 font-bold uppercase tracking-wider">Goed</div>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/60 p-6 rounded-2xl">
                  <div className="text-3xl font-bold text-stone-600 dark:text-stone-300">{stats.total - stats.correct}</div>
                  <div className="text-sm text-stone-600/60 dark:text-stone-400/70 font-bold uppercase tracking-wider">Fout</div>
                </div>
              </div>

              {stats.correct === stats.total && settings.trackTime !== false && sessionHistory[0]?.averageTimePerSum !== undefined && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`p-6 rounded-3xl text-center relative overflow-hidden ${isNewRecord ? 'bg-amber-50 border-4 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' : 'bg-blue-50 border-4 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900'}`}
                >
                  {isNewRecord && (
                    <div className="absolute -top-1 -right-1 bg-amber-400 text-white px-3 py-1 text-[10px] font-black uppercase tracking-tighter rotate-12 shadow-sm">
                      Nieuw Record!
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <p className={`text-xs font-bold uppercase tracking-widest ${isNewRecord ? 'text-amber-600 dark:text-amber-400' : 'text-blue-500 dark:text-blue-400'}`}>
                      {isNewRecord ? 'WAUW! NIEUW RECORD!' : 'Gemiddelde Snelheid'}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-black ${isNewRecord ? 'text-amber-900 dark:text-amber-200' : 'text-blue-900 dark:text-blue-200'}`}>
                        {(sessionHistory[0]?.averageTimePerSum ? sessionHistory[0].averageTimePerSum / 1000 : 0).toFixed(2)}
                      </span>
                      <span className={`text-xl font-bold ${isNewRecord ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>sec</span>
                    </div>
                    <p className={`text-xs mt-1 ${isNewRecord ? 'text-amber-600/60 dark:text-amber-400/70' : 'text-blue-600/60 dark:text-blue-400/70'} font-medium`}>per som</p>
                  </div>
                </motion.div>
              )}

              <div className="space-y-3">
                {stats.total - stats.correct > 0 && (
                  <button
                    onClick={retryMistakes}
                    className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" /> Fouten opnieuw maken
                  </button>
                )}
                <button
                  onClick={startPractice}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> Alles opnieuw!
                </button>
                <button
                  onClick={() => setMode('settings')}
                  className="w-full py-4 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 rounded-2xl font-bold text-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Instellingen aanpassen
                </button>
              </div>

              <div className="pt-6 border-t border-stone-100 dark:border-stone-800">
                <h3 className="text-left font-bold text-stone-400 mb-4 uppercase text-xs tracking-widest">Overzicht</h3>
                <div className="space-y-2">
                  {history.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-stone-600 dark:text-stone-300">
                        {item.exercise.a} {item.exercise.op === 'multiplication' ? '×' : '÷'} {item.exercise.b} = {item.exercise.result}
                      </span>
                      {item.correct ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedSession(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/60">
                <div>
                  <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">{selectedSession.playerName}</h3>
                  <p className="text-xs text-stone-400">
                    {new Date(selectedSession.timestamp).toLocaleString('nl-NL')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-2 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl text-center">
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{selectedSession.correct}</div>
                    <div className="text-[10px] text-emerald-600/60 dark:text-emerald-400/70 font-bold uppercase">Goed</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-2xl text-center">
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">{selectedSession.total - selectedSession.correct}</div>
                    <div className="text-[10px] text-red-600/60 dark:text-red-400/70 font-bold uppercase">Fout</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-2xl text-center">
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedSession.trackTime !== false && selectedSession.averageTimePerSum !== undefined
                        ? `${(selectedSession.averageTimePerSum / 1000).toFixed(1)}s`
                        : '-'}
                    </div>
                    <div className="text-[10px] text-blue-600/60 dark:text-blue-400/70 font-bold uppercase">
                      {selectedSession.trackTime !== false && selectedSession.averageTimePerSum !== undefined
                        ? 'Snelheid'
                        : 'Geen tijd'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Selectie</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSession.multiplicationTables.map(t => (
                      <span key={`m-${t}`} className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-lg text-xs font-bold">× {t}</span>
                    ))}
                    {selectedSession.divisionTables.map(t => (
                      <span key={`d-${t}`} className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg text-xs font-bold">÷ {t}</span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Sommen</h4>
                  <div className="space-y-2">
                    {selectedSession.history.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-stone-50 dark:border-stone-800 last:border-0">
                        <span className="text-stone-600 dark:text-stone-300 font-medium">
                          {item.exercise.a} {item.exercise.op === 'multiplication' ? '×' : '÷'} {item.exercise.b} = {item.exercise.result}
                        </span>
                        {item.correct ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowClearHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="mx-auto w-12 h-12 bg-red-100 text-red-500 dark:bg-red-950/40 dark:text-red-400 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Geschiedenis wissen?</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                  Dit verwijdert alle opgeslagen resultaten. Dit kan niet ongedaan gemaakt worden.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowClearHistoryModal(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={clearHistory}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  Wissen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isPracticing && (
        <footer className="mt-8 text-center text-stone-400 text-xs space-y-1">
          <p>Gemaakt voor kleine kampioenen 🌟</p>
          <p className="opacity-50 pt-2">v{APP_VERSION}</p>
        </footer>
      )}
    </div>
  );
}
