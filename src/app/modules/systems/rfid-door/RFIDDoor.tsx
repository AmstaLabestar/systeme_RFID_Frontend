import { useState } from 'react';
import { DoorOpen, Shield, Clock, Search, CheckCircle, XCircle } from 'lucide-react';

interface RFIDDoorProps {
  devices: any[];
}

export function RFIDDoor({ devices }: RFIDDoorProps) {
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);

  const doorDevices = devices.filter(d => d.type === 'rfid-door');

  // Mock doors configuration
  const [doors] = useState([
    { 
      id: 1, 
      deviceId: 3,
      name: 'Porte Principale', 
      location: 'Hall d\'entrée', 
      status: 'active',
      authorizedBadges: 12,
      totalAccess: 145 
    },
    { 
      id: 2, 
      deviceId: 3,
      name: 'Salle Serveurs', 
      location: 'Sous-sol', 
      status: 'active',
      authorizedBadges: 3,
      totalAccess: 24 
    },
    { 
      id: 3, 
      deviceId: 3,
      name: 'Bureau Direction', 
      location: 'Étage 2', 
      status: 'active',
      authorizedBadges: 5,
      totalAccess: 67 
    },
  ]);

  // Mock badge authorizations
  const [authorizations] = useState([
    { badgeId: 'A001', employeeName: 'Jean Dupont', doors: [1, 2, 3], role: 'Admin' },
    { badgeId: 'A002', employeeName: 'Marie Martin', doors: [1, 3], role: 'Manager' },
    { badgeId: 'A003', employeeName: 'Pierre Durand', doors: [1], role: 'Employé' },
    { badgeId: 'A004', employeeName: 'Sophie Bernard', doors: [1, 2], role: 'IT' },
  ]);

  // Mock access history
  const [accessHistory] = useState([
    { 
      id: 1, 
      timestamp: '2026-02-06 09:15:23', 
      employeeName: 'Jean Dupont', 
      badgeId: 'A001',
      doorName: 'Porte Principale',
      deviceName: 'Boîtier #003',
      status: 'granted',
      action: 'Entrée'
    },
    { 
      id: 2, 
      timestamp: '2026-02-06 09:20:45', 
      employeeName: 'Sophie Bernard', 
      badgeId: 'A004',
      doorName: 'Salle Serveurs',
      deviceName: 'Boîtier #003',
      status: 'granted',
      action: 'Entrée'
    },
    { 
      id: 3, 
      timestamp: '2026-02-06 10:05:12', 
      employeeName: 'Pierre Durand', 
      badgeId: 'A003',
      doorName: 'Bureau Direction',
      deviceName: 'Boîtier #003',
      status: 'denied',
      action: 'Tentative'
    },
    { 
      id: 4, 
      timestamp: '2026-02-06 11:30:18', 
      employeeName: 'Marie Martin', 
      badgeId: 'A002',
      doorName: 'Bureau Direction',
      deviceName: 'Boîtier #003',
      status: 'granted',
      action: 'Entrée'
    },
  ]);

  const DeviceCard = ({ device }: any) => {
    return (
      <div 
        onClick={() => setSelectedDevice(device.id)}
        className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${
          selectedDevice === device.id 
            ? 'border-purple-500 shadow-lg' 
            : 'border-gray-200 hover:border-purple-300'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DoorOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{device.name}</h3>
              <p className="text-sm text-gray-500">{device.location}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Portes configurées</p>
            <p className="text-2xl font-bold text-purple-600">{device.doors}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Statut</p>
            <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              Actif
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">RFID Porte</h2>
          <p className="text-gray-600 mt-1">Gérez les accès aux portes sécurisées</p>
        </div>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2">
          <DoorOpen className="w-4 h-4" />
          Configurer une porte
        </button>
      </div>

      {/* Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doorDevices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {/* Doors Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Configuration des Portes</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Porte
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Localisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boîtier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Badges autorisés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Accès aujourd'hui
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
              {doors.map(door => (
                <tr key={door.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{door.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {door.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    Boîtier #{String(door.deviceId).padStart(3, '0')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-purple-600">{door.authorizedBadges}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {door.totalAccess} accès
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      {door.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-purple-600 hover:text-purple-700 font-medium">
                      Gérer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Badge Authorizations */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-gray-900">Autorisations par Badge</h3>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rechercher..."
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Badge ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Porte Principale
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salle Serveurs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bureau Direction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {authorizations.map(auth => (
                <tr key={auth.badgeId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono font-medium text-blue-600">{auth.badgeId}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {auth.employeeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                      {auth.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {auth.doors.includes(1) ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {auth.doors.includes(2) ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {auth.doors.includes(3) ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-purple-600 hover:text-purple-700 font-medium">
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-semibold text-gray-900">Historique des Accès</h3>
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
                  Porte
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boîtier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accessHistory.map(record => (
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
                    {record.doorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {record.deviceName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.status === 'granted' ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-700 font-medium">Autorisé</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-700 font-medium">Refusé</span>
                      </div>
                    )}
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
