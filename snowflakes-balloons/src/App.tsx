/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Snowflake, 
  Circle, 
  Timer, 
  RotateCcw, 
  Sparkles, 
  Square,
  ChevronRight,
  Info
} from 'lucide-react';

interface Particle {
  id: string;
  x: number;          // horizontal percent (0-100)
  size: number;       // element size (px)
  duration: number;   // fall/rise speed (seconds)
  drift: number;      // horizontal offset amplitude
  opacity: number;    // translucent scaling
  rotation: number;   // initial rotation degrees
  color: string;      // custom modern tailwind color
}

export default function App() {
  // Simulator state
  const [activeEffect, setActiveEffect] = useState<'none' | 'snowflakes' | 'balloons'>('none');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Persistent statistics tracking
  const [snowflakeCount, setSnowflakeCount] = useState<number>(() => {
    const saved = localStorage.getItem('stat_snowflakes_run');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [balloonCount, setBalloonCount] = useState<number>(() => {
    const saved = localStorage.getItem('stat_balloons_run');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Save stats when updated
  useEffect(() => {
    localStorage.setItem('stat_snowflakes_run', snowflakeCount.toString());
  }, [snowflakeCount]);

  useEffect(() => {
    localStorage.setItem('stat_balloons_run', balloonCount.toString());
  }, [balloonCount]);

  // Effect Tick Countdown Timer (5.0s -> 0.0s)
  useEffect(() => {
    if (activeEffect === 'none') {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = parseFloat((prev - 0.1).toFixed(1));
        if (next <= 0) {
          clearInterval(interval);
          setActiveEffect('none');
          return 0;
        }
        return next;
      });
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [activeEffect]);

  // Handle active effect particle streams
  useEffect(() => {
    if (activeEffect === 'none') {
      // Allow remaining active particles to drift off screen, then clear completely
      const cleanup = setTimeout(() => {
        setParticles([]);
      }, 5000);
      return () => clearTimeout(cleanup);
    }

    // Immediately clear other particle states when commencing a fresh effect
    setParticles([]);

    // Determine configuration values
    const isSnow = activeEffect === 'snowflakes';
    const spawnRateMs = isSnow ? 140 : 200; // snowflakes are slightly denser than balloons

    const helperRandomChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const snowflakeColors = [
      'text-blue-200', 
      'text-slate-300', 
      'text-cyan-200', 
      'text-indigo-100', 
      'text-sky-200', 
      'text-white'
    ];

    const balloonColors = [
      'text-rose-400', 
      'text-emerald-400', 
      'text-sky-400', 
      'text-amber-400', 
      'text-purple-400', 
      'text-cyan-400', 
      'text-orange-400', 
      'text-indigo-400',
      'text-pink-400'
    ];

    const spawner = setInterval(() => {
      setParticles((prev) => {
        const id = Math.random().toString(36).substring(2, 9);
        const x = Math.random() * 90 + 5; // offset 5% from extreme edge lines
        
        // Medium size scales as requested
        const size = isSnow 
          ? 20 + Math.random() * 12  // 20px - 32px is a true high-contrast "medium size" snowflake
          : 34 + Math.random() * 14; // 34px - 48px is a perfect "medium size" balloon

        // Organic timing variations
        const duration = isSnow
          ? 3.0 + Math.random() * 1.8  // speed range: 3s to 4.8s
          : 3.5 + Math.random() * 2.0; // speed range: 3.5s to 5.5s

        const newParticle: Particle = {
          id,
          x,
          size,
          duration,
          drift: (Math.random() - 0.5) * 50, // horizontal drift offset
          opacity: 0.6 + Math.random() * 0.4, // micro layer depth
          rotation: Math.random() * 360,
          color: isSnow ? helperRandomChoice(snowflakeColors) : helperRandomChoice(balloonColors)
        };

        // Slice array to top 65 particles to safeguard rendering performance
        return [...prev, newParticle].slice(-65);
      });
    }, spawnRateMs);

    return () => {
      clearInterval(spawner);
    };
  }, [activeEffect]);

  // Control Actions
  const handleTriggerSnowflakes = () => {
    setSnowflakeCount((prev) => prev + 1);
    setTimeLeft(5.0);
    setActiveEffect('snowflakes');
  };

  const handleTriggerBalloons = () => {
    setBalloonCount((prev) => prev + 1);
    setTimeLeft(5.0);
    setActiveEffect('balloons');
  };

  const handleStopEffect = () => {
    setActiveEffect('none');
    setTimeLeft(0);
    setParticles([]);
  };

  const handleResetStats = () => {
    setSnowflakeCount(0);
    setBalloonCount(0);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0A0C10] text-[#F1F5F9] flex flex-col justify-between overflow-hidden font-sans border border-[#1E293B]">
      
      {/* Visual Canvas Sandbox Overlay (z-50 but pointer-events-none to prevent touch blockages) */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {particles.map((p) => {
            if (activeEffect === 'snowflakes' || p.duration > 0) {
              const isSnow = activeEffect === 'snowflakes' || (particles[0] && particles[0].color.includes('white'));
              
              return (
                <motion.div
                  key={p.id}
                  initial={{ 
                    y: activeEffect === 'snowflakes' ? '-10vh' : '110vh', 
                    x: `${p.x}vw`, 
                    opacity: 0,
                    rotate: p.rotation 
                  }}
                  animate={{ 
                    y: activeEffect === 'snowflakes' ? '110vh' : '-10vh', 
                    opacity: [0, p.opacity, p.opacity, 0],
                    rotate: activeEffect === 'snowflakes' ? p.rotation + 180 : 0,
                    x: [
                      `${p.x}vw`, 
                      `${p.x + (p.drift / 10)}vw`, 
                      `${p.x - (p.drift / 10)}vw`, 
                      `${p.x}vw`
                    ]
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.4 } }}
                  transition={{ 
                    duration: p.duration, 
                    ease: "linear",
                    times: [0, 0.1, 0.9, 1]
                  }}
                  className="absolute pointer-events-none"
                  style={{ width: p.size, height: p.size }}
                >
                  {activeEffect === 'snowflakes' ? (
                    <Snowflake 
                      className={`${p.color} w-full h-full drop-shadow-[0_2px_4px_rgba(15,23,42,0.15)]`} 
                      style={{ strokeWidth: 1.5 }}
                    />
                  ) : (
                    <div className="relative flex flex-col items-center">
                      <Circle 
                        className={`${p.color} w-full h-full drop-shadow-[0_4px_8px_rgba(15,23,42,0.2)]`} 
                        style={{ fill: 'currentColor', strokeWidth: 1.5 }}
                      />
                      {/* A tiny triangle/knot at the base of the balloon  */}
                      <div className={`w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-l-transparent border-r-transparent border-b-current ${p.color} -mt-0.5`} />
                      {/* Elegant swaying thread */}
                      <span className="w-0.5 h-5 opacity-40 block mt-0.5" style={{ backgroundColor: 'currentColor' }} />
                    </div>
                  )}
                </motion.div>
              );
            }
            return null;
          })}
        </AnimatePresence>
      </div>

      {/* Radial-gradient atmospheric background */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_50%_50%,#111827_0%,#0A0C10_100%)]" />

      {/* Decorative Atmosphere tint backdrop */}
      <AnimatePresence>
        {activeEffect !== 'none' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`fixed inset-0 pointer-events-none z-10 transition-colors duration-500 ${
              activeEffect === 'snowflakes' 
                ? 'bg-gradient-to-b from-blue-500/10 to-cyan-500/5' 
                : 'bg-gradient-to-t from-rose-500/15 to-indigo-500/5'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Primary Elegant Layout Header */}
      <header className="border-b border-[#1E293B] bg-[#0F172A] z-20 px-10 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-950 text-slate-400 rounded-sm border border-[#1E293B]">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-400" />
            </div>
            <div>
              <h1 className="text-white text-sm font-light tracking-[0.2em] uppercase">
                Aether / Dynamics
              </h1>
              <p className="text-xs text-[#64748B] font-mono tracking-wide mt-0.5">
                Simulation Module v4.2.0
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-center">
            {/* Real-time System Status Indicator */}
            <div className={`px-3 py-1 rounded-sm text-[10px] tracking-wider font-mono uppercase flex items-center gap-2 ${
              activeEffect !== 'none' 
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800 animate-pulse' 
                : 'bg-slate-950 text-slate-400 border border-[#1E293B]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full block ${
                activeEffect !== 'none' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`} />
              {activeEffect !== 'none' ? 'SYSTEM ACTIVE' : 'SYSTEM READY'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Simulation Control Center Workspace */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col items-center justify-center z-20 gap-10">
        
        {/* Elegant Hero Text */}
        <div className="text-center max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-extralight text-white tracking-tight leading-tight">
            Environmental Synthesis
          </h2>
          <p className="text-sm text-[#64748B] tracking-wide leading-relaxed mt-4">
            Experience the formal orchestration of particle physics. Select a simulation module below to initialize the localized atmospheric rendering sequence.
          </p>
        </div>

        {/* Simulation Control Board */}
        <div className="w-full max-w-xl bg-[#0F172A] border border-[#1E293B] rounded-sm p-8 relative overflow-hidden shadow-2xl">
          
          {/* Subtle card grid ornament */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-950/20 to-slate-950/20 rounded-bl-full -z-10 opacity-30" />
          
          <div className="mb-6 flex items-start justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-indigo-400 tracking-widest uppercase">Console Panel</span>
              <h2 className="text-2xl font-light text-white tracking-tight mt-1">Calibrated Effects</h2>
            </div>
            <div className="bg-[#0A0C10] p-2.5 rounded-sm text-slate-400 border border-[#1E293B]">
              <Timer className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <p className="text-sm text-[#94A3B8] leading-relaxed mb-8">
            Trigger beautifully weighted particle cascades designed for professional presentation reviews. Animations execute automatically for precisely <span className="font-semibold text-white">5 seconds</span> and adjust gracefully on desktop grids.
          </p>

          {/* Visual Ticker Countdown (Only visible when active) */}
          <AnimatePresence mode="wait">
            {activeEffect !== 'none' ? (
              <motion.div 
                key={activeEffect}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="mb-8 p-4 bg-[#0A0C10] rounded-sm text-white border border-[#1E293B]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {activeEffect === 'snowflakes' ? (
                      <Snowflake className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-rose-400 animate-bounce" style={{ fill: 'currentColor' }} />
                    )}
                    <span className="text-xs font-mono font-semibold tracking-wider uppercase text-slate-300">
                      Active Stream: <strong className="text-white capitalize">{activeEffect}</strong>
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold tracking-wide bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900 text-emerald-400">
                    {timeLeft.toFixed(1)}s
                  </span>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="w-full h-1 bg-[#1E293B] rounded-sm overflow-hidden">
                  <motion.div 
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / 5) * 100}%` }}
                    transition={{ ease: 'linear', duration: 0.05 }}
                    className={`h-full ${
                      activeEffect === 'snowflakes' ? 'bg-gradient-to-r from-cyan-400 to-blue-500' : 'bg-gradient-to-r from-rose-400 to-indigo-500'
                    }`}
                  />
                </div>
              </motion.div>
            ) : (
              <div className="mb-8 p-4 rounded-sm border border-dashed border-[#1E293B] bg-[#0A0C10]/40 text-slate-400 flex items-center justify-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-mono tracking-wider text-[#64748B] uppercase select-none">
                  Idle — Select atmosphere sequence below
                </span>
              </div>
            )}
          </AnimatePresence>

          {/* Trigger Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Snowflakes Button */}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTriggerSnowflakes}
              className={`flex items-center justify-between p-4.5 rounded-sm border font-semibold text-sm transition-all duration-300 cursor-pointer ${
                activeEffect === 'snowflakes'
                  ? 'border-cyan-400 bg-cyan-950/20 text-cyan-100 shadow-sm'
                  : 'border-[#334155] bg-[#0A0C10]/80 hover:bg-[#F1F5F9] hover:text-[#0A0C10] hover:border-[#F1F5F9] text-[#F1F5F9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-sm ${
                  activeEffect === 'snowflakes' ? 'bg-cyan-400 text-[#0A0C10]' : 'bg-slate-900 border border-[#1E293B] text-cyan-400'
                }`}>
                  <Snowflake className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-light tracking-wide uppercase text-xs">Snowflakes</div>
                  <div className="text-[10px] text-slate-500 font-mono">Medium Cascade</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </motion.button>

            {/* Balloons Button */}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTriggerBalloons}
              className={`flex items-center justify-between p-4.5 rounded-sm border font-semibold text-sm transition-all duration-300 cursor-pointer ${
                activeEffect === 'balloons'
                  ? 'border-rose-400 bg-rose-950/20 text-rose-100 shadow-sm'
                  : 'border-[#334155] bg-[#0A0C10]/80 hover:bg-[#F1F5F9] hover:text-[#0A0C10] hover:border-[#F1F5F9] text-[#F1F5F9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-sm ${
                  activeEffect === 'balloons' ? 'bg-rose-400 text-[#0A0C10]' : 'bg-slate-900 border border-[#1E293B] text-rose-400'
                }`}>
                  <Circle className="w-3.5 h-3.5" style={{ fill: 'currentColor' }} />
                </div>
                <div className="text-left">
                  <div className="font-light tracking-wide uppercase text-xs">Balloons</div>
                  <div className="text-[10px] text-slate-500 font-mono">Medium Rise</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </motion.button>
            
          </div>

          {/* Stop Button */}
          <AnimatePresence>
            {activeEffect !== 'none' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4"
              >
                <button
                  onClick={handleStopEffect}
                  className="w-full py-3 border border-rose-800 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-mono text-[10px] tracking-widest uppercase rounded-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                  Terminate Simulation
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider lines */}
          <div className="my-8 border-t border-[#1E293B]" />

          {/* Historical Session Stats */}
          <div>
            <div className="flex items-center justify-between mb-3 text-[10px] font-mono font-light text-[#64748B] uppercase tracking-[0.15em]">
              <span>Session Log Statistics</span>
              {(snowflakeCount > 0 || balloonCount > 0) && (
                <button 
                  onClick={handleResetStats}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer font-mono font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear Logs
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-[#0A0C10] rounded-sm border border-[#1E293B]">
                <div className="text-[#64748B] text-[10px] font-mono uppercase tracking-wider">Snowflakes Cascaded</div>
                <div className="text-2xl font-light text-white tracking-tight mt-1">{snowflakeCount}</div>
              </div>
              <div className="p-3.5 bg-[#0A0C10] rounded-sm border border-[#1E293B]">
                <div className="text-[#64748B] text-[10px] font-mono uppercase tracking-wider">Balloons Launched</div>
                <div className="text-2xl font-light text-white tracking-tight mt-1">{balloonCount}</div>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Primary Elegant Layout Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0F172A] py-6 z-20">
        <div className="max-w-5xl mx-auto px-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-[#475569] font-mono tracking-wider text-center md:text-left">
            SYSTEM STATUS: SECURE &bull; VERSION 4.2.0-STABLE
          </p>
          <div className="flex items-center gap-6">
            <span className="text-[10px] text-[#475569] font-mono tracking-widest uppercase">&copy; 2026 AETHER DYNAMICS CORP.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

