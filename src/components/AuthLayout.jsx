import React from "react";
import BrandMark from "@/components/dj/BrandMark";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="px-5 md:px-10 pt-[calc(1.5rem+env(safe-area-inset-top))] md:pt-8">
        <BrandMark size="lg" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-7 sm:px-6 sm:py-12">
        <div className="w-full max-w-[424px]">
          <div className="mb-6">
            {Icon && <Icon className="mb-3 h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />}
            <h1 className="workspace-title text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 sm:p-7">
            {children}
          </div>

          {footer && (
            <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
          )}

        </div>
      </div>
    </div>
  );
}
