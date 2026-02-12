import { useState } from 'react';
import { CreditCard, Plus, UserPlus, Clock, Search } from 'lucide-react';

interface RFIDBadgeProps {
  devices: any[];
}

export function RFIDBadge({ devices }: RFIDBadgeProps) {
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const rfidDevices = devices.filter(d => d.type === 'rfid-badge');

  // Mock employees data
  const [employees] = useState([
    { id: 1, name: 'Jean Dupont', email: 'jean.dupont@company.fr', badgeId: 'A001', deviceId: 1, assigned: true },
    { id: 2, name: 'Marie Martin', email: 'marie.martin@company.fr', badgeId: 'A002', deviceId: 1, assigned: true },
    { id: 3, name: 'Pierre Durand', email: 'pierre.durand@company.fr', badgeId: 'A003', deviceId: 1, assigned: true },
    { id: 4, name: 'Sophie Bernard', email: 'sophie.bernard@company.fr', badgeId: null, deviceId: null, assigned: false },
    { id: 5, name: 'Luc Petit', email: 'luc.petit@company.fr', badgeId: null, deviceId: null, assigned: false },
  ]);

  // Mock history data
  const [history] = useState([
    { id: 1, employeeName: 'Jean Dupont', badgeId: 'A001', deviceName: 'Boîtier #001', action: 'Entrée', timestamp: '2026-02-06 08:30:15' },
    { id: 2, employeeName: 'Marie Martin', badgeId: 'A002', deviceName: 'Boîtier #001', action: 'Sortie', timestamp: '2026-02-06 12:15:42' },
    { id: 3, employeeName: 'Pierre Durand', badgeId: 'A003', deviceName: 'Boîtier #001', action: 'Entrée', timestamp: '2026-02-06 13:45:20' },
    { id: 4, employeeName: 'Jean Dupont', badgeId: 'A001', deviceName: 'Boîtier #001', action: 'Sortie', timestamp: '2026-02-06 17:55:33' },
  ]);

  const DeviceCard = ({ device }: any) => {
    const totalBadges = device.badgesIncluded + device.badgesAdded;
    const remainingBadges = totalBadges - device.badgesUsed;
    const usagePercent = (device.badgesUsed / totalBadges) * 100;
    
    return (
      <div 
        onClick={() => setSelectedDevice(device.id)}
        className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${
          selectedDevice === device.id 
            ? 'border-blue-500 shadow-lg' 
            : 'border-gray-200 hover:border-blue-300'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{device.name}</h3>
              <p className="text-sm text-gray-500">{device.location}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Badges inclus</p>
            <p className="text-lg font-semibold text-gray-900">{device.badgesIncluded}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Badges ajoutés</p>
            <p className="text-lg font-semibold text-blue-600">+{device.badgesAdded}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Badges utilisés</p>
            <p className="text-lg font-semibold text-orange-600">{device.badgesUsed}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Restants</p>
            <p className="text-lg font-semibold text-green-600">{remainingBadges}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Utilisation</span>
            <span>{usagePercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                usagePercent > 80 ? 'bg-orange-500' : 'bg-blue-600'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">RFID Badge / Présence</h2>
          <p className="text-gray-600 mt-1">Gérez vos badges RFID et suivez la présence de vos employés</p>
        </div>
        <button 
          onClick={() => setShowAssignModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Assigner un badge
        </button>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rfidDevices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {/* Assigned Badges */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Badges Assignés</h3>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rechercher un employé..."
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Badge ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boîtier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map(employee => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{employee.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {employee.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.badgeId ? (
                      <span className="text-sm font-mono font-medium text-blue-600">{employee.badgeId}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Non assigné</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {employee.deviceId ? `Boîtier #${String(employee.deviceId).padStart(3, '0')}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.assigned ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Assigné
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        En attente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-blue-600 hover:text-blue-700 font-medium">
                      {employee.assigned ? 'Modifier' : 'Assigner'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">Historique des Passages</h3>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Horodatage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Badge ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boîtier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {record.timestamp}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {record.employeeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                    {record.badgeId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {record.deviceName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      record.action === 'Entrée' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {record.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
