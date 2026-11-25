import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const plans = {
  monthly: { name: 'Plus monthly', price: 'CA$12', period: 'month' },
  annual: { name: 'Plus annual', price: 'CA$99', period: 'year' },
};

export default function BillingPreview({ userId }) {
  const storageKey = `rinkbeats-billing-demo:${userId}`;
  const [activePlan, setActivePlan] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved === 'monthly' || saved === 'annual' ? saved : null;
    } catch {
      return null;
    }
  });
  const [selection, setSelection] = useState(null);
  const [message, setMessage] = useState('');
  const pending = selection && plans[selection];

  function savePlan(plan) {
    try {
      if (plan) sessionStorage.setItem(storageKey, plan);
      else sessionStorage.removeItem(storageKey);
    } catch {
      // The demo still works in memory if browser storage is unavailable.
    }
    setActivePlan(plan);
    setSelection(null);
    setMessage(plan ? `Payment simulated. ${plans[plan].name} is active in this demo.` : 'Demo reset to Free.');
  }

  return (
    <section className="space-y-4 border-t border-border pt-8" aria-labelledby="billing-preview-heading">
      <div className="space-y-1">
        <h2 id="billing-preview-heading" className="section-label">Billing preview</h2>
        <p className="text-sm text-muted-foreground">Try a plan with a simulated payment. No money is charged and your account access won’t change.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
        <p>Demo plan <strong className="ml-1">{activePlan ? plans[activePlan].name : 'Free'}</strong></p>
        {activePlan && <Button type="button" variant="ghost" onClick={() => savePlan(null)}>Reset demo</Button>}
      </div>
      <p className="text-sm text-muted-foreground">Free includes your team’s library and setlists. Plus is a placeholder for the full shared catalog and curated setlists.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(plans).map(([id, plan]) => (
          <div key={id} className="space-y-3 rounded-lg border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground"><strong className="text-base text-foreground">{plan.price}</strong> / {plan.period}</p>
            </div>
            <Button type="button" variant="outline" className="w-full" disabled={activePlan === id}
              onClick={() => { setMessage(''); setSelection(id); }}>
              {activePlan === id ? 'Active in demo' : `Try ${id} plan`}
            </Button>
          </div>
        ))}
      </div>
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      <Dialog open={Boolean(pending)} onOpenChange={open => { if (!open) setSelection(null); }}>
        {pending && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Simulated checkout</DialogTitle>
              <DialogDescription>{pending.name} at {pending.price} per {pending.period}. You don’t need to enter payment details.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelection(null)}>Cancel</Button>
              <Button type="button" onClick={() => savePlan(selection)}>Simulate payment</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
