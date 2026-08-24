import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowLeft, ShieldCheck, Lock } from "lucide-react";

interface LoginSplashScreenProps {
  nomPrenom: string;
  password: string;
  rememberMe: boolean;
  onSuccess: (user: any) => void;
  onMustChangePassword: (user: any) => void;
  onClose: (errorMessage?: string) => void;
}

export default function LoginSplashScreen({
  nomPrenom,
  password,
  rememberMe,
  onSuccess,
  onMustChangePassword,
  onClose
}: LoginSplashScreenProps) {
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Progress simulation interval for checking phase
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (status === "checking") {
          // Cap simulated progress at 65% while waiting for API
          if (prev < 65) return prev + 3;
          return prev;
        }
        return prev;
      });
    }, 50);

    // 2. Perform authentic API check
    const verifyCredentials = async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nom_prenom: nomPrenom, password })
        });

        const data = await response.json();

        // Small deliberate delay for smooth UX feel
        await new Promise((r) => setTimeout(r, 600));

        if (!isMounted) return;

        if (data.success && data.user) {
          if (data.must_change_password) {
            onMustChangePassword(data.user);
            return;
          }

          // Remember me persistence
          if (rememberMe) {
            localStorage.setItem("rememberMe", "true");
            localStorage.setItem("rememberedUser", nomPrenom);
            localStorage.setItem("rememberedPass", password);
          } else {
            localStorage.removeItem("rememberMe");
            localStorage.removeItem("rememberedUser");
            localStorage.removeItem("rememberedPass");
          }

          setUserData(data.user);
          setStatus("success");
          setProgress(100);

          // Complete splash after success animation
          setTimeout(() => {
            if (isMounted) {
              onSuccess(data.user);
            }
          }, 1400);
        } else {
          const err = data.error || "Identifiant ou mot de passe incorrect.";
          setStatus("error");
          setErrorMessage(err);
          setTimeout(() => {
            if (isMounted) {
              onClose(err);
            }
          }, 1300);
        }
      } catch (err) {
        if (isMounted) {
          const errText = "Erreur de connexion au serveur.";
          setStatus("error");
          setErrorMessage(errText);
          setTimeout(() => {
            if (isMounted) {
              onClose(errText);
            }
          }, 1300);
        }
      }
    };

    verifyCredentials();

    return () => {
      isMounted = false;
      clearInterval(progressInterval);
    };
  }, [nomPrenom, password, rememberMe]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070c18] text-white overflow-hidden font-sans select-none"
    >
      {/* Background Radial Glow Effects */}
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success-glow"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.35, scale: 1.1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-emerald-500 rounded-full blur-[180px] pointer-events-none"
          />
        ) : status === "error" ? (
          <motion.div
            key="error-glow"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.4, scale: 1.1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-rose-600 rounded-full blur-[180px] pointer-events-none"
          />
        ) : (
          <motion.div key="default-glow" className="pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#f97316] rounded-full blur-[180px] opacity-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[#0b9d96] rounded-full blur-[160px] opacity-15" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="splash-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2,2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#splash-grid)" />
        </svg>
      </div>

      {/* Main Container */}
      <motion.div
        animate={
          status === "error"
            ? { x: [-12, 12, -8, 8, -4, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.45 }}
        className="relative z-10 flex flex-col items-center max-w-md px-6 text-center"
      >
        {/* Animated Logo Container with Dynamic State Halo & Orbit Rings */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Outer Pulsing Glow Halo */}
          <motion.div
            animate={{
              scale: status === "error" ? 1.2 : [0.95, 1.25, 0.95],
              opacity: status === "error" ? 0.8 : [0.35, 0.75, 0.35]
            }}
            transition={{ duration: 2.5, repeat: status === "error" ? 0 : Infinity, ease: "easeInOut" }}
            className={`absolute w-44 h-44 rounded-3xl blur-xl transition-colors duration-500 ${
              status === "success"
                ? "bg-emerald-500/50"
                : status === "error"
                ? "bg-rose-500/60"
                : "bg-gradient-to-tr from-[#f97316]/30 via-[#0b9d96]/20 to-[#38bdf8]/30"
            }`}
          />

          {/* Outer Rotating Technical Orbit Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className={`absolute w-48 h-48 rounded-full border border-dashed flex items-center justify-center transition-colors duration-500 ${
              status === "success"
                ? "border-emerald-400/60"
                : status === "error"
                ? "border-rose-500/60"
                : "border-[#f97316]/50"
            }`}
          >
            <div className={`absolute -top-1.5 w-3.5 h-3.5 rounded-full shadow-lg ${
              status === "success" ? "bg-emerald-400 shadow-emerald-400" : status === "error" ? "bg-rose-500 shadow-rose-500" : "bg-[#f97316] shadow-[#f97316]/80"
            }`} />
            <div className={`absolute -bottom-1.5 w-3.5 h-3.5 rounded-full shadow-lg ${
              status === "success" ? "bg-teal-300 shadow-teal-300" : status === "error" ? "bg-rose-400 shadow-rose-400" : "bg-[#0b9d96] shadow-[#0b9d96]/80"
            }`} />
          </motion.div>

          {/* Inner Counter-Rotating Orbit Ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
            className={`absolute w-40 h-40 rounded-full border-2 border-transparent transition-colors duration-500 ${
              status === "success"
                ? "border-t-emerald-300 border-r-emerald-500/30"
                : status === "error"
                ? "border-t-rose-400 border-r-rose-600/30"
                : "border-t-[#38bdf8] border-r-[#0b9d96]/40"
            }`}
          />

          {/* Core Logo Image with State Badge */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{
              scale: status === "success" ? [1, 1.15, 1] : status === "error" ? 0.95 : 1
            }}
            transition={{ duration: 0.4 }}
            className={`relative z-10 w-28 h-28 p-3 rounded-2xl bg-[#0c1222] border shadow-2xl flex items-center justify-center backdrop-blur-md transition-colors duration-500 ${
              status === "success"
                ? "border-emerald-500 shadow-emerald-500/30"
                : status === "error"
                ? "border-rose-500 shadow-rose-500/40"
                : "border-slate-700/80 shadow-black/80"
            }`}
          >
            <img
              src="/logo.svg"
              className={`w-full h-full object-contain transition-all duration-300 ${
                status === "error" ? "filter grayscale brightness-75 drop-shadow-[0_0_10px_rgba(244,63,94,0.6)]" : "filter drop-shadow-[0_0_12px_rgba(249,115,22,0.4)]"
              }`}
              alt="Wellbore Pro Logo"
            />

            {/* Dynamic Status Icon Overlay */}
            <AnimatePresence>
              {status === "success" && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/50"
                >
                  <CheckCircle2 className="w-6 h-6 stroke-[3]" />
                </motion.div>
              )}
              {status === "error" && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/50"
                >
                  <XCircle className="w-6 h-6 stroke-[3]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Brand Title & Subtitle */}
        <div className="space-y-1 mb-6">
          <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 uppercase">
            Wellbore Pro
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Gestion &amp; Ingénierie des Puits
          </p>
        </div>

        {/* User Badge */}
        <div className="mb-6 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-2 shadow-inner">
          <span className={`w-2 h-2 rounded-full ${
            status === "success" ? "bg-emerald-400 animate-ping" : status === "error" ? "bg-rose-500" : "bg-[#f97316] animate-pulse"
          }`} />
          <span>Utilisateur: <strong className="text-white">{nomPrenom || "Anonyme"}</strong></span>
        </div>

        {/* Status Message & Progress Section */}
        <div className="w-full space-y-3">
          {/* Status Label */}
          <div className="flex items-center justify-between text-xs font-bold px-1">
            <span className={`tracking-wide transition-colors duration-300 ${
              status === "success" ? "text-emerald-400" : status === "error" ? "text-rose-400" : "text-slate-300"
            }`}>
              {status === "checking" && "Vérification des identifiants..."}
              {status === "success" && "Connexion réussie ! Chargement de l'application..."}
              {status === "error" && "Échec de l'authentification"}
            </span>

            {status === "checking" && (
              <span className="font-mono text-[#f97316] text-sm font-black">{progress}%</span>
            )}
          </div>

          {/* Progress Bar Track */}
          <div className="relative w-full">
            <div className={`absolute inset-0 blur-md rounded-full pointer-events-none transition-colors duration-500 ${
              status === "success" ? "bg-emerald-500/30" : status === "error" ? "bg-rose-500/30" : "bg-[#f97316]/20"
            }`} />

            <div className="w-full h-2.5 bg-slate-900/90 rounded-full overflow-hidden p-0.5 border border-slate-800/80 shadow-inner relative z-10">
              <motion.div
                className={`h-full rounded-full relative transition-all duration-300 ${
                  status === "success"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : status === "error"
                    ? "bg-gradient-to-r from-rose-600 to-red-500"
                    : "bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#0b9d96]"
                }`}
                style={{ width: `${status === "error" ? 100 : progress}%` }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white rounded-full shadow-[0_0_12px_#ffffff]" />
              </motion.div>
            </div>
          </div>

          {/* Error Details */}
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-2"
            >
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
