import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Key, Trash2, Edit, Search, X, RefreshCw } from 'lucide-react';

export interface Employee {
  id: number;
  matricule: string;
  nom_prenom: string;
  role: 'user' | 'chief' | 'cheif' | 'admin' | 'owner' | string;
  personnel?: string;
  fonction?: string;
  service?: string;
  observation?: string;
  created_at?: string;
}

interface EmployeeManagementProps {
  currentUserId?: number;
}

export default function EmployeeManagement({ currentUserId }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal states
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [formData, setFormData] = useState({
    matricule: '',
    nom_prenom: '',
    role: 'user',
    password: '',
    fonction: '',
    service: '',
    personnel: '',
    observation: ''
  });

  // Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [passwordEmpTarget, setPasswordEmpTarget] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');

  // Status/Alert message state
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setEmployees(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditingEmp(null);
    setFormData({
      matricule: `EMP${Math.floor(1000 + Math.random() * 9000)}`,
      nom_prenom: '',
      role: 'user',
      password: '',
      fonction: '',
      service: '',
      personnel: '',
      observation: ''
    });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setFormData({
      matricule: emp.matricule || '',
      nom_prenom: emp.nom_prenom || '',
      role: emp.role || 'user',
      password: '', // Leave blank unless changing
      fonction: emp.fonction || '',
      service: emp.service || '',
      personnel: emp.personnel || '',
      observation: emp.observation || ''
    });
    setIsAddEditOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom_prenom.trim()) {
      showAlert('error', 'Le nom & prénom est obligatoire.');
      return;
    }

    try {
      if (editingEmp) {
        // Edit employee
        const res = await fetch(`/api/employees/${editingEmp.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('success', `Employé ${formData.nom_prenom} mis à jour avec succès.`);
          setIsAddEditOpen(false);
          fetchEmployees();
        } else {
          showAlert('error', data.error || 'Erreur lors de la mise à jour.');
        }
      } else {
        // Add employee
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('success', `Nouvel employé ${formData.nom_prenom} créé.`);
          setIsAddEditOpen(false);
          fetchEmployees();
        } else {
          showAlert('error', data.error || 'Erreur lors de la création.');
        }
      }
    } catch (err) {
      showAlert('error', 'Erreur de connexion au serveur.');
    }
  };

  const handleOpenPasswordModal = (emp: Employee) => {
    setPasswordEmpTarget(emp);
    setNewPassword('');
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordEmpTarget) return;
    if (!newPassword.trim() || newPassword.trim().length < 3) {
      showAlert('error', 'Le mot de passe doit comporter au moins 3 caractères.');
      return;
    }

    try {
      const res = await fetch(`/api/employees/${passwordEmpTarget.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert('success', `Mot de passe de ${passwordEmpTarget.nom_prenom} modifié.`);
        setIsPasswordModalOpen(false);
      } else {
        showAlert('error', data.error || 'Erreur lors de la modification.');
      }
    } catch (err) {
      showAlert('error', 'Erreur de connexion au serveur.');
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (emp.id === currentUserId) {
      showAlert('error', 'Vous ne pouvez pas supprimer votre propre compte !');
      return;
    }

    if (!window.confirm(`Voulez-vous vraiment supprimer définitivement l'utilisateur ${emp.nom_prenom} (${emp.matricule}) ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert('success', `Utilisateur ${emp.nom_prenom} supprimé.`);
        fetchEmployees();
      } else {
        showAlert('error', data.error || 'Erreur lors de la suppression.');
      }
    } catch (err) {
      showAlert('error', 'Erreur de connexion au serveur.');
    }
  };

  const getRoleBadge = (role: string) => {
    const r = (role || '').toLowerCase().trim();
    if (r === 'owner') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 uppercase tracking-wide">
          <Shield className="w-3 h-3" />
          Owner
        </span>
      );
    }
    if (r === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 uppercase tracking-wide">
          Admin
        </span>
      );
    }
    if (r === 'chief' || r === 'cheif') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">
          Chef (Add/Edit)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
        User (Read-only)
      </span>
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase().trim();
    const nameMatch = (emp.nom_prenom || '').toLowerCase().includes(q);
    const matMatch = (emp.matricule || '').toLowerCase().includes(q);
    const serviceMatch = (emp.service || '').toLowerCase().includes(q);

    const r = (emp.role || '').toLowerCase().trim();
    let roleMatch = true;
    if (roleFilter !== 'ALL') {
      if (roleFilter === 'chief') {
        roleMatch = r === 'chief' || r === 'cheif';
      } else {
        roleMatch = r === roleFilter.toLowerCase();
      }
    }

    return (nameMatch || matMatch || serviceMatch) && roleMatch;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-6 w-full" id="employee_management_root">

      {/* Alert Toast */}
      {alert && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
            alert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{alert.message}</span>
          <button onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-600 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header bar — no icon, matches other pages */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
            Gestion des Utilisateurs &amp; Rôles
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Espace Owner : Gérez les comptes employés, attribuez les privilèges (User, Chef, Admin, Owner) et réinitialisez les mots de passe.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-[#f97316] hover:bg-[#ea580c] active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un Employé
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher nom, matricule, service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Filtrer Rôle:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tous les Rôles ({employees.length})</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="chief">Chef</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="px-4 py-3">Matricule</th>
              <th className="px-4 py-3">Nom &amp; Prénom</th>
              <th className="px-4 py-3">Rôle App</th>
              <th className="px-4 py-3">Service / Fonction</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#f97316]" />
                  <span className="text-xs font-medium">Chargement des utilisateurs...</span>
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400 font-semibold italic">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition group">
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{emp.matricule || '-'}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">{emp.nom_prenom}</td>
                  <td className="px-4 py-3.5">{getRoleBadge(emp.role)}</td>
                  <td className="px-4 py-3.5 text-slate-600">
                    <div className="font-semibold">{emp.service || '-'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{emp.fonction || ''}</div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(emp)}
                        className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded transition"
                        title="Modifier l'utilisateur & rôle"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenPasswordModal(emp)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                        title="Changer le mot de passe"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp)}
                        disabled={emp.id === currentUserId}
                        className={`p-1.5 rounded transition ${
                          emp.id === currentUserId
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title={emp.id === currentUserId ? 'Votre propre compte' : 'Supprimer'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: ADD / EDIT EMPLOYEE */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                {editingEmp ? `Modifier : ${editingEmp.nom_prenom}` : 'Ajouter un Nouvel Employé'}
              </h3>
              <button onClick={() => setIsAddEditOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Matricule *</label>
                  <input
                    type="text"
                    required
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#f97316] bg-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Rôle *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#f97316] bg-white font-bold"
                  >
                    <option value="user">User (Lecture seule)</option>
                    <option value="chief">Chef (Ajout + Modification)</option>
                    <option value="admin">Admin (Ajout + Modif + Suppression)</option>
                    <option value="owner">Owner (Contrôle total)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Nom &amp; Prénom *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: BENALI Mohamed"
                  value={formData.nom_prenom}
                  onChange={(e) => setFormData({ ...formData, nom_prenom: e.target.value })}
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#f97316] bg-white font-semibold"
                />
              </div>

              {!editingEmp && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Mot de Passe Initial</label>
                  <input
                    type="text"
                    placeholder="Vide = matricule utilisé comme mot de passe"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#f97316] bg-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Par défaut, si vide, l'utilisateur se connecte avec son matricule.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Service</label>
                  <input
                    type="text"
                    placeholder="ex: PRODUCTION / FORAGE"
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#f97316] bg-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Fonction</label>
                  <input
                    type="text"
                    placeholder="ex: Ingénieur Reservoir"
                    value={formData.fonction}
                    onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#f97316] bg-white font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#f97316] hover:bg-[#ea580c] rounded-lg transition shadow-sm"
                >
                  {editingEmp ? 'Mettre à jour' : "Créer l'utilisateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE PASSWORD */}
      {isPasswordModalOpen && passwordEmpTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-[#f97316]" />
                Nouveau Mot de Passe
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-700">{passwordEmpTarget.nom_prenom}</p>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Nouveau Mot de Passe *</label>
                <input
                  type="text"
                  required
                  placeholder="Saisissez le nouveau mot de passe"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#f97316] bg-white font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#f97316] hover:bg-[#ea580c] rounded-lg transition shadow-sm"
                >
                  Changer le Mot de Passe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
