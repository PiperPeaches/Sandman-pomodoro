import { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import Balatro from "../popup/Balatro";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faEnvelopeCircleCheck } from '@fortawesome/free-solid-svg-icons';
import "./Auth.css";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    // Check for existing session
    const checkSession = async () => {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsSuccess(true);
        setTimeout(() => window.close(), 2500);
      }
    };
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setIsSuccess(true);
        setTimeout(() => window.close(), 2500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!supabase) throw new Error("Supabase not initialized");
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, password, options: { data: { username } }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: "Verification email sent! Please check your inbox." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange handles the success state for sign-in
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) });
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-bg">
          <Balatro color1="#000000" color2="#1e3a8a" color3="#000000" />
        </div>
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center', animation: 'sandman-fade-in 0.8s ease-out' }}>
            <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '4rem', color: '#34c759', marginBottom: '20px' }} />
            <h1 className="auth-title" style={{ background: 'white', WebkitTextFillColor: 'white' }}>Welcome back!</h1>
            <p className="auth-subtitle" style={{ color: 'white', opacity: 0.8 }}>
              You have successfully entered the dream.
            </p>
            <p style={{ marginTop: '30px', fontSize: '0.8rem', color: '#8E8E93' }}>
              This tab will close automatically...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <Balatro color1="#000000" color2="#581c87" color3="#1e1b4b" />
      </div>
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">The Sandman</h1>
            <p className="auth-subtitle">{isSignUp ? "Join the dream" : "Welcome back"}</p>
          </div>

          {message?.type === 'success' && isSignUp ? (
             <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <FontAwesomeIcon icon={faEnvelopeCircleCheck} style={{ fontSize: '3rem', color: 'var(--accent-color)', marginBottom: '15px' }} />
                <p style={{ color: 'white', lineHeight: '1.6' }}>{message.text}</p>
                <button onClick={() => window.close()} className="auth-btn" style={{ marginTop: '20px' }}>Close Tab</button>
             </div>
          ) : (
            <form onSubmit={handleAuth} className="auth-form">
              {isSignUp && (
                <div className="input-group">
                  <label>Display Name</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Dreamer" required />
                </div>
              )}
              <div className="input-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dreamer@example.com" required />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>

              {message && <div className={`auth-message ${message.type}`}>{message.text}</div>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Processing..." : (isSignUp ? "Sign Up" : "Sign In")}
              </button>
            </form>
          )}

          {!isSuccess && !(message?.type === 'success' && isSignUp) && (
            <div className="auth-footer">
              <button onClick={() => setIsSignUp(!isSignUp)} className="switch-btn">
                {isSignUp ? "Back to Sign In" : "Create an Account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
