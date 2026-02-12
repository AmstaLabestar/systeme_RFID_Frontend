import { useState } from 'react';
import { MessageSquare, TrendingUp, ThumbsUp, ThumbsDown, Meh, Smile, Frown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FeedbackViewProps {
  devices: any[];
}

export function FeedbackView({ devices }: FeedbackViewProps) {
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  const feedbackDevices = devices.filter(d => d.type === 'feedback');

  // Mock feedback data
  const weeklyData = [
    { day: 'Lun', excellent: 45, bien: 32, neutre: 12, mauvais: 5 },
    { day: 'Mar', excellent: 52, bien: 28, neutre: 8, mauvais: 3 },
    { day: 'Mer', excellent: 48, bien: 35, neutre: 10, mauvais: 4 },
    { day: 'Jeu', excellent: 55, bien: 30, neutre: 9, mauvais: 2 },
    { day: 'Ven', excellent: 62, bien: 25, neutre: 7, mauvais: 4 },
    { day: 'Sam', excellent: 38, bien: 22, neutre: 15, mauvais: 8 },
    { day: 'Dim', excellent: 35, bien: 20, neutre: 18, mauvais: 10 },
  ];

  const satisfactionDistribution = [
    { name: 'Excellent', value: 335, color: '#10b981' },
    { name: 'Bien', value: 192, color: '#3b82f6' },
    { name: 'Neutre', value: 79, color: '#f59e0b' },
    { name: 'Mauvais', value: 36, color: '#ef4444' },
  ];

  const trendData = [
    { week: 'S1', score: 78 },
    { week: 'S2', score: 82 },
    { week: 'S3', score: 79 },
    { week: 'S4', score: 85 },
    { week: 'S5', score: 87 },
    { week: 'S6', score: 84 },
  ];

  const totalFeedbacks = satisfactionDistribution.reduce((sum, item) => sum + item.value, 0);
  const positiveRate = ((satisfactionDistribution[0].value + satisfactionDistribution[1].value) / totalFeedbacks * 100).toFixed(1);
  const avgScore = 84;

  const DeviceCard = ({ device }: any) => {
    return (
      <div 
        onClick={() => setSelectedDevice(device.id)}
        className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${
          selectedDevice === device.id 
            ? 'border-orange-500 shadow-lg' 
            : 'border-gray-200 hover:border-orange-300'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{device.name}</h3>
              <p className="text-sm text-gray-500">{device.location}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Retours aujourd'hui</p>
            <p className="text-2xl font-bold text-orange-600">142</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Score moyen</p>
            <p className="text-2xl font-bold text-green-600">{avgScore}%</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Feedback Client</h2>
          <p className="text-gray-600 mt-1">Analysez la satisfaction de vos clients en temps réel</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTimeRange('today')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              timeRange === 'today' 
                ? 'bg-orange-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Aujourd'hui
          </button>
          <button 
            onClick={() => setTimeRange('week')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              timeRange === 'week' 
                ? 'bg-orange-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            7 jours
          </button>
          <button 
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              timeRange === 'month' 
                ? 'bg-orange-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            30 jours
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Total Feedbacks</h3>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{totalFeedbacks}</div>
          <div className="flex items-center gap-1 text-sm text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span>+12% vs semaine dernière</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Taux de satisfaction</h3>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{positiveRate}%</div>
          <div className="flex items-center gap-1 text-sm text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span>+3.2% ce mois-ci</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Score moyen</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Smile className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{avgScore}/100</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${avgScore}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Feedbacks négatifs</h3>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ThumbsDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{satisfactionDistribution[3].value}</div>
          <p className="text-sm text-gray-500">{(satisfactionDistribution[3].value / totalFeedbacks * 100).toFixed(1)}% du total</p>
        </div>
      </div>

      {/* Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {feedbackDevices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Feedbacks par jour</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="excellent" stackId="a" fill="#10b981" name="Excellent" />
              <Bar dataKey="bien" stackId="a" fill="#3b82f6" name="Bien" />
              <Bar dataKey="neutre" stackId="a" fill="#f59e0b" name="Neutre" />
              <Bar dataKey="mauvais" stackId="a" fill="#ef4444" name="Mauvais" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribution des feedbacks</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={satisfactionDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {satisfactionDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Analysis */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution du score de satisfaction</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" stroke="#666" />
            <YAxis stroke="#666" domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="#f97316" 
              strokeWidth={3}
              dot={{ fill: '#f97316', r: 5 }}
              activeDot={{ r: 7 }}
              name="Score de satisfaction"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Ratings */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Détail des évaluations</h3>
        <div className="space-y-4">
          {satisfactionDistribution.map((item) => {
            const percentage = (item.value / totalFeedbacks * 100).toFixed(1);
            const Icon = 
              item.name === 'Excellent' ? Smile :
              item.name === 'Bien' ? ThumbsUp :
              item.name === 'Neutre' ? Meh :
              Frown;
            
            return (
              <div key={item.name} className="flex items-center gap-4">
                <div className="w-32 flex items-center gap-2">
                  <Icon className="w-5 h-5" style={{ color: item.color }} />
                  <span className="font-medium text-gray-900">{item.name}</span>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="h-3 rounded-full transition-all"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
                <div className="w-24 text-right">
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  <span className="text-sm text-gray-500 ml-2">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Feedbacks récents</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { time: 'Il y a 2 min', device: 'Boîtier #004', rating: 'Excellent', emoji: '😊', color: 'green' },
            { time: 'Il y a 8 min', device: 'Boîtier #004', rating: 'Bien', emoji: '👍', color: 'blue' },
            { time: 'Il y a 15 min', device: 'Boîtier #004', rating: 'Excellent', emoji: '😊', color: 'green' },
            { time: 'Il y a 23 min', device: 'Boîtier #004', rating: 'Neutre', emoji: '😐', color: 'orange' },
            { time: 'Il y a 31 min', device: 'Boîtier #004', rating: 'Bien', emoji: '👍', color: 'blue' },
            { time: 'Il y a 45 min', device: 'Boîtier #004', rating: 'Mauvais', emoji: '😞', color: 'red' },
          ].map((feedback, idx) => (
            <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-4">
                <span className="text-2xl">{feedback.emoji}</span>
                <div>
                  <p className={`font-medium text-${feedback.color}-600`}>{feedback.rating}</p>
                  <p className="text-sm text-gray-500">{feedback.device}</p>
                </div>
              </div>
              <span className="text-sm text-gray-500">{feedback.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
