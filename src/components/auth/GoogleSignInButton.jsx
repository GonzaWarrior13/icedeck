import React, { useEffect, useRef, useState } from 'react';

// This is Google's own rendered Sign in with Google button, not an imitation.
// Requires a Google Web OAuth Client ID and Supabase's Google provider enabled.
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
let gisPromise;
function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => window.google?.accounts?.id
      ? resolve(window.google)
      : reject(new Error('Google sign-in did not initialize.'));
    script.onerror = () => reject(new Error('Unable to load Google sign-in. Check browser extensions or network settings.'));
    document.head.appendChild(script);
  }).catch(error => { gisPromise = null; throw error; });
  return gisPromise;
}

export default function GoogleSignInButton({ onCredential, onError, disabled = false }) {
  const buttonRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [loading, setLoading] = useState(Boolean(clientId));
  callbackRef.current = onCredential;
  errorRef.current = onError;

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let mounted = true;
    loadGoogleIdentityServices().then(google => {
      if (!mounted || !buttonRef.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: response => {
          if (response?.credential) callbackRef.current?.(response.credential);
          else errorRef.current?.(new Error('Google did not provide a sign-in credential.'));
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      buttonRef.current.replaceChildren();
      google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(360, Math.max(220, buttonRef.current.clientWidth || 320)),
      });
      setLoading(false);
    }).catch(error => {
      if (mounted) { setLoading(false); errorRef.current?.(error); }
    });
    return () => { mounted = false; };
  }, []);

  if (!clientId) return <p className="text-xs text-muted-foreground">
    Google sign-in needs a Google Web Client ID configured by the IceDeck administrator.
  </p>;

  return <div aria-busy={loading || disabled} className={disabled ? 'pointer-events-none opacity-50' : ''}>
    <div ref={buttonRef} className="w-full flex justify-center min-h-10" />
    {loading && <p className="text-xs text-center text-muted-foreground">Loading Google sign-in…</p>}
  </div>;
}
