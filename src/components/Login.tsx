import React, { useState, useEffect } from "react";
import { Lock, User, ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { AnimatePresence } from "motion/react";
import LoginSplashScreen from "./LoginSplashScreen";

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [nomPrenom, setNomPrenom] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  // Change-password modal state
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePwdError, setChangePwdError] = useState("");
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Load saved credentials if "remember me" was checked
  useEffect(() => {
    const isRemembered = localStorage.getItem("rememberMe") === "true";
    if (isRemembered) {
      setRememberMe(true);
      setNomPrenom(localStorage.getItem("rememberedUser") || "");
      setPassword(localStorage.getItem("rememberedPass") || "");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomPrenom.trim()) {
      setError("Veuillez saisir votre nom d'utilisateur.");
      return;
    }
    setError("");
    setShowSplash(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdError("");

    if (newPassword.trim().length < 4) {
      setChangePwdError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePwdError("Les mots de passe ne correspondent pas.");
      return;
    }

    setChangePwdLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: pendingUser.id, new_password: newPassword })
      });
      const result = await res.json();
      if (result.success) {
        if (rememberMe) {
          localStorage.setItem("rememberMe", "true");
          localStorage.setItem("rememberedUser", nomPrenom);
          localStorage.setItem("rememberedPass", newPassword);
        } else {
          localStorage.removeItem("rememberMe");
          localStorage.removeItem("rememberedUser");
          localStorage.removeItem("rememberedPass");
        }
        onLogin(pendingUser);
      } else {
        setChangePwdError(result.error || "Erreur lors du changement de mot de passe.");
      }
    } catch {
      setChangePwdError("Erreur de connexion au serveur.");
    } finally {
      setChangePwdLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex font-sans bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('https://interfluid.net/hs-fs/hubfs/ITF%20-%20IMMAGINI%20SITO/PAGINE%20SETTORE/Settore%20Oil%26Gas.jpg?width=1280&height=960&name=Settore%20Oil%26Gas.jpg')" }}
    >
      {/* Dark Transparent Overlay */}
      <div className="absolute inset-0 bg-[#0c1222]/70 backdrop-blur-[2px]"></div>

      <div className="relative z-10 w-full flex flex-col lg:flex-row">
        {/* Left Side - Visual / Branding */}
        <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M0 40L40 0H20L0 20M40 40V20L20 40" stroke="white" strokeWidth="1" fill="none" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            </svg>
          </div>

          <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-[#f97316] blur-[150px] opacity-30 pointer-events-none"></div>

          <div className="relative z-10 flex items-center gap-3.5">
            <img src="/logo.svg" className="w-12 h-12 object-contain shrink-0" alt="Logo" />
            <span className="text-2xl font-black text-white tracking-tight">Wellbore Pro</span>
          </div>

          <div className="relative z-10 max-w-md">
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-6">
              Wellbore Pro.
            </h1>
            <p className="text-lg text-slate-300 font-medium leading-relaxed">
              Plateforme unifiée pour la gestion des puits, le suivi des complétions et l'historisation des données techniques.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-4 text-sm text-slate-400 font-medium">
            <span>© {new Date().getFullYear()} ENP. Tous droits réservés.</span>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 xl:p-24 relative">
          <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-2xl space-y-10 border border-slate-100">
            <div className="flex lg:hidden items-center gap-3.5 mb-8">
              <img src="/logo.svg" className="w-12 h-12 object-contain shrink-0" alt="Logo" />
              <span className="text-2xl font-black text-slate-900 tracking-tight">Wellbore Pro</span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Accès sécurisé</h2>
              <p className="text-slate-500 mt-2 text-sm font-medium">
                Veuillez vous connecter avec vos identifiants pour accéder à votre espace de travail.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-semibold flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest">
                    Nom &amp; Prénom
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={nomPrenom}
                      onChange={(e) => setNomPrenom(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all"
                      placeholder="Ex: A.BOUZAHRI"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all"
                      placeholder="Votre mot de passe"
                      required
                    />
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2.5 text-xs text-slate-600 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#f97316] focus:ring-[#f97316] focus:ring-offset-0 cursor-pointer"
                    />
                    <span>Se souvenir de moi</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`group w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-[#f97316]/25 ${
                  isLoading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {isLoading ? "Connexion en cours..." : "Se connecter"}
                {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      {showChangePwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 sm:p-10 space-y-6 border border-slate-100">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#f97316]/10 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-[#f97316]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Créer votre mot de passe</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Bienvenue <span className="font-bold text-slate-700">{pendingUser?.nom_prenom}</span> !<br />
                  Veuillez définir un nouveau mot de passe pour votre compte.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {changePwdError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  {changePwdError}
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showNewPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all"
                    placeholder="Minimum 4 caractères"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showConfirmPwd ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all"
                    placeholder="Répétez le mot de passe"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={changePwdLoading}
                className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-[#f97316]/25 ${
                  changePwdLoading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {changePwdLoading ? "Enregistrement..." : "Enregistrer et continuer"}
                {!changePwdLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Intro Splash Screen Animation Overlay ───────────────────────── */}
      <AnimatePresence>
        {showSplash && (
          <LoginSplashScreen
            nomPrenom={nomPrenom}
            password={password}
            rememberMe={rememberMe}
            onSuccess={(user) => {
              setShowSplash(false);
              onLogin(user);
            }}
            onMustChangePassword={(user) => {
              setPendingUser(user);
              setShowChangePwd(true);
              setShowSplash(false);
            }}
            onClose={(err) => {
              setShowSplash(false);
              if (err) setError(err);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
