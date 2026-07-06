import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GithubIcon as Github } from "@/components/icons/GithubIcon";

export function MarketingNav() {
  return (
    <header className="absolute top-0 left-0 right-0 h-20 flex items-center justify-between px-8 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 22H7L12 12L17 22H22L12 2Z" fill="url(#paint0_linear)"/>
            <path d="M12 2L17 12H7L12 2Z" fill="#8B5CF6"/>
            <defs>
              <linearGradient id="paint0_linear" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B5CF6"/>
                <stop offset="1" stopColor="#3B82F6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="text-white font-bold tracking-widest text-lg uppercase">Archmind</span>
      </div>

      {/* Center Links */}
      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
        <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
          Product <ChevronDown className="w-4 h-4 opacity-70" />
        </div>
        <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
          Solutions <ChevronDown className="w-4 h-4 opacity-70" />
        </div>
        <Link href="#" className="hover:text-white transition-colors">Pricing</Link>
        <Link href="#" className="hover:text-white transition-colors">Docs</Link>
        <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
          Resources <ChevronDown className="w-4 h-4 opacity-70" />
        </div>
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-6">
        <Link href="/login" className="text-sm font-medium text-white/90 hover:text-white transition-colors">
          Sign in
        </Link>
        <a href="https://github.com/bhaupupu/archmind-dashboard" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white rounded-full px-5 h-9 text-sm font-medium">
            <Github className="w-4 h-4 mr-2" />
            Star on GitHub
          </Button>
        </a>
      </div>
    </header>
  );
}
