"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldAlert, Sparkles, Box, Code2, Waypoints, Terminal, Target } from "lucide-react";
import { GithubIcon as Github } from "@/components/icons/GithubIcon";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050B14] text-white selection:bg-purple-500/30 overflow-hidden font-sans">
      
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-[40%] left-0 w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none transform -translate-x-1/2" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-8 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="flex flex-col items-start z-10 max-w-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Target className="w-4 h-4 text-purple-500" />
              <span className="text-purple-500 text-xs font-bold tracking-widest uppercase">
                Engineering Intelligence Platform
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-[4.5rem] font-bold leading-[1.05] tracking-tight mb-8">
              See the big picture.<br />
              Understand the impact.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Ship with confidence.
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-gray-400 mb-10 leading-relaxed max-w-xl">
              Archmind maps your entire codebase, understands how everything connects, and predicts the impact of every change—before you ship.
            </p>

            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-gray-300">
              <div className="flex items-center gap-3">
                <Github className="w-5 h-5 text-purple-400" />
                <span>Connect your<br/>GitHub organization</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Get real insights<br/>in minutes</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-purple-400" />
                <span>Make better<br/>engineering decisions</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual (3D Isometric Graph) */}
          <div className="relative w-full h-[500px] lg:h-[700px] flex items-center justify-center lg:justify-end z-10 perspective-1000">
            <div className="relative w-[400px] h-[500px] transform-style-3d rotate-x-60 rotate-z-45">
              
              {/* Layer 1: Applications */}
              <div className="absolute top-0 left-0 w-full h-full border border-purple-500/30 bg-purple-500/5 shadow-[0_0_50px_rgba(168,85,247,0.15)] flex items-center justify-center transform translate-z-[150px]">
                 {/* Nodes */}
                 <div className="absolute top-[20%] left-[30%] w-3 h-3 bg-purple-400 rounded-full shadow-[0_0_15px_#c084fc]" />
                 <div className="absolute top-[40%] left-[70%] w-3 h-3 bg-purple-400 rounded-full shadow-[0_0_15px_#c084fc]" />
                 <div className="absolute top-[70%] left-[40%] w-3 h-3 bg-purple-400 rounded-full shadow-[0_0_15px_#c084fc]" />
                 {/* Lines */}
                 <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1="30%" y1="20%" x2="70%" y2="40%" stroke="#c084fc" strokeWidth="1" opacity="0.5" />
                    <line x1="70%" y1="40%" x2="40%" y2="70%" stroke="#c084fc" strokeWidth="1" opacity="0.5" />
                 </svg>
              </div>

              {/* Layer 2: Services */}
              <div className="absolute top-0 left-0 w-full h-full border border-blue-500/30 bg-blue-500/5 shadow-[0_0_50px_rgba(59,130,246,0.15)] flex items-center justify-center transform translate-z-[50px]">
                 {/* Nodes */}
                 <div className="absolute top-[30%] left-[20%] w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_15px_#60a5fa]" />
                 <div className="absolute top-[50%] left-[80%] w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_15px_#60a5fa]" />
                 <div className="absolute top-[80%] left-[50%] w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_15px_#60a5fa]" />
                 <div className="absolute top-[60%] left-[30%] w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_15px_#60a5fa]" />
                 {/* Lines */}
                 <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1="20%" y1="30%" x2="30%" y2="60%" stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
                    <line x1="30%" y1="60%" x2="50%" y2="80%" stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
                    <line x1="80%" y1="50%" x2="50%" y2="80%" stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
                 </svg>
              </div>

              {/* Layer 3: Libraries */}
              <div className="absolute top-0 left-0 w-full h-full border border-teal-500/30 bg-teal-500/5 shadow-[0_0_50px_rgba(20,184,166,0.15)] flex items-center justify-center transform translate-z-[-50px]">
                 {/* Nodes */}
                 <div className="absolute top-[40%] left-[40%] w-3 h-3 bg-teal-400 rounded-full shadow-[0_0_15px_#2dd4bf]" />
                 <div className="absolute top-[20%] left-[60%] w-3 h-3 bg-teal-400 rounded-full shadow-[0_0_15px_#2dd4bf]" />
                 <div className="absolute top-[70%] left-[70%] w-3 h-3 bg-teal-400 rounded-full shadow-[0_0_15px_#2dd4bf]" />
                 {/* Lines */}
                 <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1="40%" y1="40%" x2="60%" y2="20%" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
                    <line x1="40%" y1="40%" x2="70%" y2="70%" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
                 </svg>
              </div>

              {/* Layer 4: Infrastructure */}
              <div className="absolute top-0 left-0 w-full h-full border border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.15)] flex items-center justify-center transform translate-z-[-150px]">
                 {/* Core Node */}
                 <div className="absolute top-[50%] left-[50%] w-5 h-5 bg-emerald-400 rounded-full shadow-[0_0_30px_#34d399] flex items-center justify-center">
                   <div className="w-full h-full rounded-full bg-emerald-400 animate-ping opacity-50" />
                 </div>
              </div>

              {/* Connecting vertical lines between layers */}
              <div className="absolute inset-0 w-full h-full">
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ transform: 'translateZ(-150px) rotateX(-90deg) translateY(150px)' }}>
                   {/* This is a bit tricky to do purely in CSS 3D space with SVG, so we'll simulate the vertical connections using glowing pseudo-elements or a dedicated 3D container. */}
                </svg>
              </div>
            </div>
            
            {/* Layer Labels (positioned absolutely relative to the container) */}
            <div className="absolute right-0 top-[15%] text-[10px] font-bold text-purple-400 tracking-widest uppercase">Applications</div>
            <div className="absolute right-0 top-[40%] text-[10px] font-bold text-blue-400 tracking-widest uppercase">Services</div>
            <div className="absolute right-0 top-[65%] text-[10px] font-bold text-teal-400 tracking-widest uppercase">Libraries</div>
            <div className="absolute right-0 top-[90%] text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Infrastructure</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-8 max-w-[1400px] mx-auto text-center">
        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything you need to move fast, safely</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-16">
          From deep code understanding to actionable recommendations—Archmind gives your team the clarity to build better software.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {/* Card 1 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Waypoints className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Deep Code<br/>Understanding</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              We build a living graph of your codebase to surface relationships, dependencies, and hidden complexity.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
              <ShieldAlert className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Impact<br/>Analysis</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Know exactly what breaks, what&apos;s affected, and how much effort a change will take.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6">
              <Box className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">AI-Powered<br/>Planning</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Get step-by-step implementation plans, migration strategies, and intelligent recommendations.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
              <Code2 className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Execute with<br/>Confidence</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Generate PRs, track progress, and keep your architecture healthy over time.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-8 max-w-[1200px] mx-auto text-center border-t border-white/5">
        <div className="text-purple-500 text-xs font-bold tracking-widest uppercase mb-4">
          How it works
        </div>
        <h2 className="text-3xl lg:text-4xl font-bold mb-20">From complexity to clarity</h2>

        <div className="flex flex-col md:flex-row justify-between relative">
          
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-10 left-12 right-12 border-t border-dashed border-white/20 -z-10" />

          {/* Step 1 */}
          <div className="flex flex-col items-center max-w-[240px] mx-auto mb-12 md:mb-0">
            <div className="w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Github className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-purple-400 font-bold mb-2">01</div>
            <h3 className="text-xl font-bold mb-3">Connect</h3>
            <p className="text-sm text-gray-400">
              Connect your GitHub organization and select repositories.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center max-w-[240px] mx-auto mb-12 md:mb-0">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
              <Box className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-blue-400 font-bold mb-2">02</div>
            <h3 className="text-xl font-bold mb-3">Index</h3>
            <p className="text-sm text-gray-400">
              We index your code and build a real-time knowledge graph.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center max-w-[240px] mx-auto mb-12 md:mb-0">
            <div className="w-20 h-20 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-teal-400" />
            </div>
            <div className="text-teal-400 font-bold mb-2">03</div>
            <h3 className="text-xl font-bold mb-3">Analyze</h3>
            <p className="text-sm text-gray-400">
              Ask questions, run impact analysis, and get actionable insights.
            </p>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center max-w-[240px] mx-auto">
            <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
              <Target className="w-8 h-8 text-orange-400" />
            </div>
            <div className="text-orange-400 font-bold mb-2">04</div>
            <h3 className="text-xl font-bold mb-3">Evolve</h3>
            <p className="text-sm text-gray-400">
              Execute plans, generate PRs, and continuously improve your architecture.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
