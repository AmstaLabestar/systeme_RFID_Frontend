import { CreditCard, DoorOpen, Fingerprint, MessageSquare, TrendingUp, AlertTriangle } from 'lucide-react';
import type { PageId } from '@/app/shared/types';

interface DashboardProps {
  devices: any[];
  onNavigate: (page: PageId) => void;
}

export function Dashboard({ devices, onNavigate }: DashboardProps) {
  const stats = {
    totalDevices: devices.length,
    rfidBadge: devices.filter(d => d.type === 'rfid-badge').length,
    rfidDoor: devices.filter(d => d.type === 'rfid-door').length,
    fingerprint: devices.filter(d => d.type === 'fingerprint').length,
    feedback: devices.filter(d => d.type === 'feedback').length,
  };

  const totalBadges = devices
    .filter(d => d.type === 'rfid-badge')
    .reduce((sum, d) => sum + d.badgesIncluded + d.badgesAdded, 0);
    
  const usedBadges = devices
    .filter(d => d.type === 'rfid-badge')
    .reduce((sum, d) => sum + d.badgesUsed, 0);

  const totalFingerprints = devices
    .filter(d => d.type === 'fingerprint')
    .reduce((sum, d) => sum + d.capacity, 0);
    
  const usedFingerprints = devices
    .filter(d => d.type === 'fingerprint')
    .reduce((sum, d) => sum + d.used, 0);

  const totalDoors = devices
    .filter(d => d.type === 'rfid-door')
    .reduce((sum, d) => sum + d.doors, 0);

  const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl p-6 border-2 ${color} cursor-pointer hover:shadow-lg transition-shadow`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 ${color.replace('border', 'bg').replace('500', '100')} rounded-lg`}>
          <Icon className={`w-6 h-6 ${color.replace('border', 'text')}`} />
        </div>
        <TrendingUp className="w-5 h-5 text-green-500" />
      </div>
      <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );

  const alerts = [];
  if (usedBadges / totalBadges > 0.8) {
    alerts.push({
      message: 'Capacité badges RFID à 80%',
      action: () => onNavigate('marketplace'),
    });
  }
  if (usedFingerprints / totalFingerprints > 0.8) {
    alerts.push({
      message: 'Capacité empreintes à 80%',
      action: () => onNavigate('marketplace'),
    });
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, idx) => (
            <div 
              key={idx}
              className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <p className="text-orange-800 font-medium">{alert.message}</p>
              </div>
              <button 
                onClick={alert.action}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Augmenter la capacité
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Boîtiers RFID Badge"
          value={stats.rfidBadge}
          icon={CreditCard}
          color="border-blue-500"
          onClick={() => onNavigate('rfid-badge')}
        />
        <StatCard 
          title="Boîtiers RFID Porte"
          value={stats.rfidDoor}
          icon={DoorOpen}
          color="border-purple-500"
          onClick={() => onNavigate('rfid-door')}
        />
        <StatCard 
          title="Boîtiers Empreinte"
          value={stats.fingerprint}
          icon={Fingerprint}
          color="border-green-500"
          onClick={() => onNavigate('fingerprint')}
        />
        <StatCard 
          title="Boîtiers Feedback"
          value={stats.feedback}
          icon={MessageSquare}
          color="border-orange-500"
          onClick={() => onNavigate('feedback')}
        />
      </div>

      {/* Capacity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Badges RFID</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total disponible</span>
              <span className="font-semibold">{totalBadges}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Utilisés</span>
              <span className="font-semibold text-blue-600">{usedBadges}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Restants</span>
              <span className="font-semibold text-green-600">{totalBadges - usedBadges}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(usedBadges / totalBadges) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Empreintes Digitales</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total disponible</span>
              <span className="font-semibold">{totalFingerprints}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Utilisées</span>
              <span className="font-semibold text-green-600">{usedFingerprints}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Restantes</span>
              <span className="font-semibold text-green-600">{totalFingerprints - usedFingerprints}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${(usedFingerprints / totalFingerprints) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Portes Configurées</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total portes</span>
              <span className="font-semibold">{totalDoors}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Actives</span>
              <span className="font-semibold text-purple-600">{totalDoors}</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <button 
                onClick={() => onNavigate('rfid-door')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Gérer les autorisations →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Activité Récente</h3>
        <div className="space-y-3">
          {[
            { type: 'badge', message: 'Nouveau badge assigné à Jean Dupont', time: 'Il y a 5 min', device: 'Boîtier #001' },
            { type: 'door', message: 'Accès porte principale - Marie Martin', time: 'Il y a 12 min', device: 'Boîtier #003' },
            { type: 'fingerprint', message: 'Nouvelle empreinte enregistrée', time: 'Il y a 1h', device: 'Boîtier #002' },
            { type: 'feedback', message: 'Feedback positif reçu', time: 'Il y a 2h', device: 'Boîtier #004' },
          ].map((activity, idx) => (
            <div key={idx} className="flex items-start gap-3 py-3 border-b last:border-b-0">
              <div className={`p-2 rounded-lg ${
                activity.type === 'badge' ? 'bg-blue-100' :
                activity.type === 'door' ? 'bg-purple-100' :
                activity.type === 'fingerprint' ? 'bg-green-100' :
                'bg-orange-100'
              }`}>
                {activity.type === 'badge' && <CreditCard className="w-4 h-4 text-blue-600" />}
                {activity.type === 'door' && <DoorOpen className="w-4 h-4 text-purple-600" />}
                {activity.type === 'fingerprint' && <Fingerprint className="w-4 h-4 text-green-600" />}
                {activity.type === 'feedback' && <MessageSquare className="w-4 h-4 text-orange-600" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{activity.time}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">{activity.device}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
