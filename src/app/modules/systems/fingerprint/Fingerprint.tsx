import { useState } from 'react';
import { Fingerprint as FingerprintIcon, UserPlus, Clock, Search } from 'lucide-react';

interface FingerprintProps {
  devices: any[];
}

export function Fingerprint({ devices }: FingerprintProps) {
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);

  const fingerprintDevices = devices.filter(d => d.type === 'fingerprint');
  const usageSegmentCount = 20;
  const confidenceSegmentCount = 10;

  const getUsageColorClass = (usagePercent: number) =>
    usagePercent > 80 ? 'bg-orange-500' : 'bg-green-600';

  const getConfidenceColorClass = (confidence: number) =>
    confidence > 90 ? 'bg-green-500' : confidence > 70 ? 'bg-yellow-500' : 'bg-red-500';

  // Mock fingerprint assignments
  const [assignments] = useState([
    { 
      id: 1, 
      employeeName: 'Jean Dupont', 
      email: 'jean.dupont@company.fr',
      fingerprintId: 'FP001', 
      deviceId: 2,
      deviceName: 'Boîtier #002',
      enrolledDate: '2026-01-15',
      lastUsed: '2026-02-06 08:30'
    },
    { 
      id: 2, 
      employeeName: 'Marie Martin', 
      email: 'marie.martin@company.fr',
      fingerprintId: 'FP002', 
      deviceId: 2,
      deviceName: 'Boîtier #002',
      enrolledDate: '2026-01-16',
      lastUsed: '2026-02-06 09:15'
    },
    { 
      id: 3, 
      employeeName: 'Pierre Durand', 
      email: 'pierre.durand@company.fr',
      fingerprintId: 'FP003', 
      deviceId: 2,
      deviceName: 'Boîtier #002',
      enrolledDate: '2026-01-20',
      lastUsed: '2026-02-05 17:45'
    },
  ]);

  // Mock access history
  const [history] = useState([
    { 
      id: 1, 
      timestamp: '2026-02-06 08:30:15', 
      employeeName: 'Jean Dupont',
      fingerprintId: 'FP001',
      deviceName: 'Boîtier #002',
      location: 'Bureau RH',
      status: 'success',
      confidence: 98
    },
    { 
      id: 2, 
      timestamp: '2026-02-06 09:15:42', 
      employeeName: 'Marie Martin',
      fingerprintId: 'FP002',
      deviceName: 'Boîtier #002',
      location: 'Bureau RH',
      status: 'success',
      confidence: 95
    },
    { 
      id: 3, 
      timestamp: '2026-02-06 10:05:12', 
      employeeName: 'Inconnu',
      fingerprintId: '-',
      deviceName: 'Boîtier #002',
      location: 'Bureau RH',
      status: 'failed',
      confidence: 42
    },
    { 
      id: 4, 
      timestamp: '2026-02-06 11:30:18', 
      employeeName: 'Pierre Durand',
      fingerprintId: 'FP003',
      deviceName: 'Boîtier #002',
      location: 'Bureau RH',
      status: 'success',
      confidence: 97
    },
  ]);

  const DeviceCard = ({ device }: any) => {
    const usagePercent = (device.used / device.capacity) * 100;
    
    return (
      <div 
        onClick={() => setSelectedDevice(device.id)}
        className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${
          selectedDevice === device.id 
            ? 'border-green-500 shadow-lg' 
            : 'border-gray-200 hover:border-green-300'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FingerprintIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{device.name}</h3>
              <p className="text-sm text-gray-500">{device.location}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Capacité totale</p>
            <p className="text-2xl font-bold text-gray-900">{device.capacity}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Utilisées</p>
            <p className="text-2xl font-bold text-green-600">{device.used}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Disponibles</span>
            <span className="font-semibold text-green-600">{device.capacity - device.used}</span>
          </div>
          <div className="flex w-full gap-0.5">
            {Array.from({ length: usageSegmentCount }).map((_, index) => {
              const isFilled = index < Math.round(usagePercent / (100 / usageSegmentCount));

              return (
                <span
                  key={index}
                  className={`h-2 flex-1 rounded-sm ${
                    isFilled ? getUsageColorClass(usagePercent) : 'bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Empreinte Digitale</h2>
          <p className="text-gray-600 mt-1">Gérez les empreintes digitales et contrôlez les accès biométriques</p>
        </div>
        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Enregistrer une empreinte
        </button>
      </div>

      {/* Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fingerprintDevices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {/* Enrolled Fingerprints */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Empreintes Enregistrées</h3>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rechercher un employé..."
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  Empreinte ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boîtier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date d'enregistrement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dernière utilisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignments.map(assignment => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{assignment.employeeName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {assignment.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono font-medium text-green-600">{assignment.fingerprintId}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {assignment.deviceName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {assignment.enrolledDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {assignment.lastUsed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-green-600 hover:text-green-700 font-medium mr-3">
                      Modifier
                    </button>
                    <button className="text-red-600 hover:text-red-700 font-medium">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Taux de réussite</h3>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FingerprintIcon className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">96.5%</div>
          <p className="text-sm text-gray-500">Sur les 7 derniers jours</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Temps moyen de reconnaissance</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">0.8s</div>
          <p className="text-sm text-gray-500">Très rapide</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Tentatives refusées</h3>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FingerprintIcon className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">12</div>
          <p className="text-sm text-gray-500">Ce mois-ci</p>
        </div>
      </div>

      {/* Access History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-green-600" />
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
                  Empreinte ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boîtier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Localisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confiance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-green-600">
                    {record.fingerprintId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {record.deviceName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {record.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex w-16 gap-0.5">
                        {Array.from({ length: confidenceSegmentCount }).map((_, index) => {
                          const isFilled =
                            index < Math.round(record.confidence / (100 / confidenceSegmentCount));

                          return (
                            <span
                              key={`${record.id}-${index}`}
                              className={`h-2 flex-1 rounded-sm ${
                                isFilled ? getConfidenceColorClass(record.confidence) : 'bg-gray-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-xs font-medium text-gray-600">{record.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      record.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {record.status === 'success' ? 'Réussi' : 'Échoué'}
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
