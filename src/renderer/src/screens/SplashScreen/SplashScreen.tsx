import { useEffect } from "react";

interface SplashScreenProps {
  onFinished: () => void;
  status?: string;
}

function SplashScreen({ onFinished, status }: SplashScreenProps): React.JSX.Element {
  useEffect(() => {
    onFinished();
  }, [onFinished]);

  return (
    <div className="splash-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a0a)' }}>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-display, var(--font-sans))', color: 'var(--accent, #0f766e)', letterSpacing: 1 }}>
        Hermes Mission Control
      </div>
      {status && (
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-dim, #888)', fontFamily: 'var(--font-sans)' }}>
          {status}
        </div>
      )}
      <div style={{ marginTop: 24, width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent, #0f766e)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

export default SplashScreen;
