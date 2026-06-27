import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Disc3 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Auth() {
  const { login, register, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || "/";

  const [mode, setMode] = useState("login"); // login | register | verify
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
        navigate(returnTo, { replace: true });
      } else if (mode === "register") {
        await register(email, password);
        setMode("verify");
      } else if (mode === "verify") {
        await verifyOtp(email, otp);
        await login(email, password);
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      if (err?.status === 403 && mode === "login") {
        setError("Email not verified yet. Enter the code we emailed you.");
        setMode("verify");
      } else {
        setError(err?.message || "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    login: "Welcome back",
    register: "Create your account",
    verify: "Verify your email",
  };

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <div className="flex items-center gap-2 justify-center mb-8">
        <Disc3 className="w-8 h-8 text-amber-400" />
        <span className="font-bold text-xl">Groove Cellar</span>
      </div>

      <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6">
        <h1 className="text-xl font-bold mb-1">{titles[mode]}</h1>
        <p className="text-sm text-neutral-400 mb-6">
          {mode === "verify"
            ? `Enter the 6-digit code sent to ${email}.`
            : "Members get faster checkout and full order history."}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handle} className="space-y-3">
          {mode !== "verify" && (
            <>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-4 outline-none focus:border-amber-400"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-4 outline-none focus:border-amber-400"
              />
            </>
          )}

          {mode === "verify" && (
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-4 outline-none focus:border-amber-400 tracking-[0.3em] text-center"
            />
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-amber-400 text-neutral-950 font-semibold hover:bg-amber-300 disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : "Verify & sign in"}
          </button>
        </form>

        {mode !== "verify" && (
          <p className="mt-5 text-sm text-neutral-400 text-center">
            {mode === "login" ? "New here?" : "Already a member?"}{" "}
            <button
              onClick={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
              className="text-amber-400 hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-neutral-500">
        <Link to="/" className="hover:text-neutral-300">
          ← Back to shop
        </Link>
      </p>
    </div>
  );
}
