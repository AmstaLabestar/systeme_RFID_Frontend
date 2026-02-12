import { Building2, Users, Shield, Bell } from 'lucide-react';

export function Settings() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold text-gray-900">Informations de l'entreprise</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de l'entreprise
            </label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue="TechCorp Solutions"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input 
                type="email" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="contact@techcorp.fr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              <input 
                type="tel" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="+33 1 23 45 67 89"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold text-gray-900">Gestion des utilisateurs</h3>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Ajouter un utilisateur
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold text-gray-900">Notifications</h3>
        </div>
        <div className="space-y-3">
          {[
            'Alertes de capacité',
            'Nouveaux accès',
            'Badges non assignés',
            'Rapports hebdomadaires'
          ].map((notif) => (
            <label key={notif} className="flex items-center gap-3">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded"
                defaultChecked
              />
              <span className="text-sm text-gray-700">{notif}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold text-gray-900">Sécurité</h3>
        </div>
        <div className="space-y-4">
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Changer le mot de passe
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Authentification à deux facteurs
          </button>
        </div>
      </div>
    </div>
  );
}
