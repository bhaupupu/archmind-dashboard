"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Box, ShieldAlert, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050B14] flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none" />

      {/* Main Content */}
      <main className="z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto mt-20 mb-32">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-blue-400 mb-8"
        >
          <Sparkles className="w-4 h-4" />
          <span>Introducing Archmind 1.0</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight"
        >
          Real-time engineering <br className="hidden md:block" />
          intelligence for your codebase
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl"
        >
          Connect your GitHub repositories and instantly understand architectural impacts, 
          detect cross-service risks, and streamline your engineering workflows with AI.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 w-full justify-center"
        >
          <Link href="/login">
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all hover:shadow-[0_0_40px_rgba(37,99,235,0.5)]">
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </motion.div>

        {/* Feature Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full text-left"
        >
          {[
            {
              title: "Cross-Repo Dependency Mapping",
              description: "Automatically discover and visualize how your microservices depend on each other.",
              icon: Box,
              color: "text-blue-400",
              bg: "bg-blue-500/10"
            },
            {
              title: "AI Impact Analysis",
              description: "Ask what happens if you change a core library, and let Gemini trace the full blast radius.",
              icon: Sparkles,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10"
            },
            {
              title: "Risk Detection",
              description: "Identify architectural vulnerabilities and hidden tight-coupling before you merge.",
              icon: ShieldAlert,
              color: "text-amber-400",
              bg: "bg-amber-500/10"
            }
          ].map((feature, i) => (
            <div key={i} className="flex flex-col p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </motion.div>
      </main>

    </div>
  );
}
