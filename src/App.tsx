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
  History
} from 'lucide-react';
import { Exercise, Operation, UserSettings, MasteryData, SessionResult } from './types';

const TABLES = Array.from({ length: 11 }, (_, i) => i);

export default function App() {
  const [mode, setMode] = useState<'settings' | 'practice' | 'results'>('settings');
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('tafel-settings');
    return saved ? JSON.parse(saved) : { playerName: '', multiplicationTables: [], divisionTables: [], exerciseCount: 10 };
  });
  const [mastery, setMastery] = useState<MasteryData>(() => {
    const saved = localStorage.getItem('tafel-mastery');
    return saved ? JSON.parse(saved) : {};
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
    const githubUrl = 'https://raw.githubusercontent.com/evensglenn/tafelkampioen/main/public/success.mp3';
    
    const getLocalUrl = () => {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const path = (baseUrl + '/success.mp3').replace(/\/+/g, '/');
      return new URL(path, window.location.origin).href;
    };

    const loadAndPlay = async (url: string) => {
      const cacheBuster = `?t=${Date.now()}`;
      const finalUrl = url + cacheBuster;
      console.log('Poging tot laden:', finalUrl);
      
      const response = await fetch(finalUrl);
      if (!response.ok) throw new Error(`Server fout: ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      
      // DEBUG: Log de eerste 50 bytes om te zien wat voor bestand het echt is
      const header = new Uint8Array(arrayBuffer.slice(0, 50));
      const headerText = new TextDecoder().decode(header);
      console.log('Bestand header (eerste 50 bytes):', headerText);
      
      if (headerText.includes('version https://git-lfs')) {
        throw new Error('Dit is een Git LFS pointer bestand, geen echt MP3 bestand. Upload het echte bestand naar GitHub.');
      }

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContext();
      
      try {
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start(0);
        console.log('Audio succesvol gestart via BufferSource!');
      } catch (decodeError) {
        console.warn('Buffer decoding mislukt, probeer standaard Audio element...', decodeError);
        // Fallback naar standaard Audio element met Blob
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        await audio.play();
        console.log('Audio succesvol gestart via Blob URL!');
      }
    };

    try {
      await loadAndPlay(getLocalUrl());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Lokaal mislukt:', msg);
      try {
        await loadAndPlay(githubUrl);
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        console.error('Alle audio-pogingen mislukt:', msg2);
      }
    }
  }, []);

  const handleAnswer = useCallback((answer: string | null) => {
    if (!currentExercise || feedback) return;

    stopTimer();
    const isCorrect = answer !== null && parseInt(answer) === currentExercise.result;
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    
    // Update mastery
    const tableKey = currentExercise.op === 'multiplication' 
      ? (settings.multiplicationTables.includes(currentExercise.a) ? currentExercise.a : currentExercise.b)
      : currentExercise.b;
    
    const key = `${currentExercise.op}-${tableKey}`;
    setMastery(prev => {
      const currentScore = prev[key] || 0;
      const nextScore = isCorrect 
        ? Math.min(10, currentScore + 1) 
        : Math.max(0, currentScore - 1);
      return { ...prev, [key]: nextScore };
    });

    const nextStats = {
      correct: stats.correct + (isCorrect ? 1 : 0),
      total: stats.total + 1
    };
    
    setStats(nextStats);
    setHistory(prev => [...prev, { exercise: currentExercise, correct: isCorrect }]);

    setTimeout(() => {
      if (nextStats.total >= activeTotal) {
        // Save to session history
        const result: SessionResult = {
          id: crypto.randomUUID(),
          playerName: settings.playerName || 'Anoniem',
          correct: nextStats.correct,
          total: nextStats.total,
          timestamp: Date.now(),
          multiplicationTables: [...settings.multiplicationTables],
          divisionTables: [...settings.divisionTables],
        };
        setSessionHistory(prev => [result, ...prev].slice(0, 5)); // Keep last 5
        
        // Play success sound if 0 errors
        if (nextStats.correct === nextStats.total) {
          playSuccessSound();
          
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#f59e0b']
          });
        }

        setMode('results');
      } else {
        setExercisePool(prev => prev.slice(1));
        setCurrentExercise(null); // Clear current to trigger useEffect
        setUserAnswer('');
        setFeedback(null);
        startTimer();
      }
    }, 1000);
  }, [currentExercise, feedback, stats, activeTotal, startTimer, stopTimer, settings.multiplicationTables, settings.playerName]);

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

  useEffect(() => {
    localStorage.setItem('tafel-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('tafel-mastery', JSON.stringify(mastery));
  }, [mastery]);

  useEffect(() => {
    localStorage.setItem('tafel-session-history', JSON.stringify(sessionHistory));
  }, [sessionHistory]);

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
      alert('Vul eerst je naam in!');
      return;
    }
    if (settings.multiplicationTables.length === 0 && settings.divisionTables.length === 0) {
      alert('Kies eerst minstens één tafel om te oefenen!');
      return;
    }

    // Generate pool
    const pool: Exercise[] = [];
    
    settings.multiplicationTables.forEach(table => {
      for (let i = 0; i <= 10; i++) {
        pool.push({ a: table, b: i, op: 'multiplication', result: table * i });
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
    startTimer();
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
    startTimer();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 min-h-screen flex flex-col font-sans">
      <header className="mb-8 text-center">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex items-center justify-center gap-3 mb-2"
        >
          <Brain className="w-10 h-10 text-purple-500" />
          <h1 className="text-4xl font-bold text-emerald-600 font-display">
            TafelKampioen
          </h1>
        </motion.div>
        <p className="text-stone-500">Word de meester van de tafels!</p>
      </header>

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
                <h2 className="text-xl font-semibold flex items-center gap-2 text-stone-700">
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
                      className="w-full px-4 py-3 rounded-xl bg-stone-100 border-2 border-transparent focus:border-purple-400 focus:bg-white outline-none transition-all font-medium text-stone-700"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
                      <Calculator className="w-4 h-4" /> Vermenigvuldigen (×)
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {TABLES.map(n => (
                        <button
                          key={`mul-${n}`}
                          onClick={() => toggleTable(n, 'multiplication')}
                          className={`
                            h-12 rounded-xl font-bold transition-all duration-200
                            ${settings.multiplicationTables.includes(n)
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105'
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}
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
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {TABLES.map(n => (
                        <button
                          key={`div-${n}`}
                          disabled={n === 0}
                          onClick={() => toggleTable(n, 'division')}
                          className={`
                            h-12 rounded-xl font-bold transition-all duration-200
                            ${n === 0 ? 'opacity-20 cursor-not-allowed' : ''}
                            ${settings.divisionTables.includes(n)
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 scale-105'
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}
                          `}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-stone-100">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Aantal sommen
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {([10, 20, 50, 'all'] as const).map(count => (
                      <button
                        key={`count-${count}`}
                        onClick={() => setSettings(prev => ({ ...prev, exerciseCount: count }))}
                        className={`
                          h-12 rounded-xl font-bold transition-all duration-200
                          ${settings.exerciseCount === count
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-200 scale-105'
                            : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}
                        `}
                      >
                        {count === 'all' ? 'Alle' : count}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startPractice}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 group"
                >
                  <Play className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  Start Oefenen!
                </button>
              </div>

              {sessionHistory.length > 0 && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                    <History className="w-4 h-4" /> Laatste resultaten
                  </h3>
                  <div className="space-y-2">
                    {sessionHistory.map((result) => (
                      <div 
                        key={result.id}
                        className="flex flex-col py-3 px-4 bg-white/50 rounded-xl border border-stone-100 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-700">{result.playerName}</span>
                          <span className="font-mono font-bold text-emerald-600">
                            {result.correct} / {result.total}
                          </span>
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
                      </div>
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
              className="flex-1 flex flex-col items-center justify-center space-y-8"
            >
              <div className="w-full max-w-md glass rounded-3xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-stone-100">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.total / activeTotal) * 100}%` }}
                  />
                </div>
                
                {/* Timer bar */}
                <div className="absolute top-2 left-0 w-full h-1.5 bg-stone-50 overflow-hidden">
                  <motion.div 
                    className={`h-full transition-colors duration-300 ${timeLeft < 3 ? 'bg-red-500' : 'bg-orange-400'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / 15) * 100}%` }}
                    transition={{ duration: 0.05, ease: 'linear' }}
                  />
                </div>

                <div className="flex justify-between items-center mb-8">
                  <button 
                    onClick={() => {
                      stopTimer();
                      setMode('settings');
                    }}
                    className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <span className="font-bold text-stone-400">
                    Vraag {Math.min(stats.total + 1, activeTotal)} van {activeTotal}
                  </span>
                  <div className="w-10" />
                </div>

                <div className="text-7xl font-display font-bold text-stone-800 mb-12 flex items-center justify-center gap-4">
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
                  <span className="text-stone-300">=</span>
                </div>

                {currentExercise.isChallenge && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute top-12 right-8 bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Challenge!
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="relative">
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
                      ${feedback === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 
                        feedback === 'incorrect' ? 'border-red-500 bg-red-50 text-red-700' : 
                        'border-stone-200 focus:border-emerald-400 bg-white'}
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
                </form>

                <p className="mt-6 text-stone-400 text-sm font-medium">
                  Druk op Enter om te controleren
                </p>
              </div>
            </motion.div>
          )}

          {mode === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-3xl p-8 text-center space-y-8"
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
                <h2 className="text-3xl font-bold text-stone-800">Goed gedaan, {settings.playerName}!</h2>
                <p className="text-stone-500">Je bent echt een Einstein.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-6 rounded-2xl">
                  <div className="text-3xl font-bold text-emerald-600">{stats.correct}</div>
                  <div className="text-sm text-emerald-600/60 font-bold uppercase tracking-wider">Goed</div>
                </div>
                <div className="bg-stone-50 p-6 rounded-2xl">
                  <div className="text-3xl font-bold text-stone-600">{stats.total - stats.correct}</div>
                  <div className="text-sm text-stone-600/60 font-bold uppercase tracking-wider">Fout</div>
                </div>
              </div>

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
                  className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold text-lg hover:bg-stone-200 transition-colors"
                >
                  Instellingen aanpassen
                </button>
              </div>

              <div className="pt-6 border-t border-stone-100">
                <h3 className="text-left font-bold text-stone-400 mb-4 uppercase text-xs tracking-widest">Overzicht</h3>
                <div className="space-y-2">
                  {history.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-stone-600">
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

      <footer className="mt-8 text-center text-stone-400 text-xs space-y-1">
        <p>Gemaakt voor kleine kampioenen 🌟</p>
        <p>Deze app is met behulp van AI gemaakt door Glenn Evens.</p>
        <p className="opacity-50 pt-2">v1.2.8</p>
      </footer>
    </div>
  );
}
