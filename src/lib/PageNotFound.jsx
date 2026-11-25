import { useEffect } from 'react';
import { Home } from 'lucide-react';

export default function PageNotFound() {
    // Tell crawlers this is a real 404 once the page has settled.
    useEffect(() => {
        const meta = document.createElement('meta');
        meta.name = 'prerender-status-code';
        meta.content = '404';
        document.head.appendChild(meta);
        return () => {
            document.head.removeChild(meta);
        };
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
                        <div className="h-0.5 w-16 bg-border mx-auto"></div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-2xl font-medium text-foreground">
                            Page not found
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Check the address, or return to the library.
                        </p>
                    </div>

                    <div className="pt-6">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="inline-flex items-center min-h-11 px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-secondary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                        >
                            <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                            Back to library
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
