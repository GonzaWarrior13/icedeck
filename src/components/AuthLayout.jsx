import React from "react";
import { Disc3 } from "lucide-react";
import BrandMark from "@/components/dj/BrandMark";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="px-5 md:px-10 pt-[calc(1.5rem+env(safe-area-inset-top))] md:pt-8">
        <BrandMark size="lg" />
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-10 md:py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              {Icon && <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} aria-hidden="true" />}
              <span className="section-label">Rinkbeats</span>
            </div>
            <h1 className="font-display text-[40px] font-semibold leading-[1] tracking-[-0.01em] text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="bg-card border border-border rounded-[14px] p-6 md:p-8">
            {children}
          </div>

          {footer && (
            <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
          )}

          <div className="mt-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/60">
            <Disc3 className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
            Hockey game music controller
          </div>
        </div>
      </div>
    </div>
  );
}