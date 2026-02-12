import { useState } from 'react';
import { CreditCard, DoorOpen, Fingerprint, MessageSquare, Plus, Minus, ShoppingCart, Check } from 'lucide-react';

interface MarketplaceProps {
  onPurchase: (items: any[]) => void;
}

export function Marketplace({ onPurchase }: MarketplaceProps) {
  const [cart, setCart] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const devices = [
    {
      id: 'rfid-badge-device',
      name: 'Boîtier RFID Badge',
      type: 'device',
      category: 'rfid-badge',
      icon: CreditCard,
      color: 'blue',
      price: 21000,
      description: 'Système de gestion de présence et badges RFID',
      features: [
        '50 badges RFID inclus',
        'Lecteur haute fréquence',
        'Connexion réseau',
        'Interface web',
      ]
    },
    {
      id: 'rfid-door-device',
      name: 'Boîtier RFID Porte',
      type: 'device',
      category: 'rfid-door',
      icon: DoorOpen,
      color: 'purple',
      price: 20000,
      description: 'Contrôle d\'accès intelligent pour portes',
      features: [
        '3 portes incluses',
        'Gestion des autorisations',
        'Historique des accès',
        'Alertes en temps réel',
      ]
    },
    {
      id: 'fingerprint-device',
      name: 'Boîtier Empreinte Digitale',
      type: 'device',
      category: 'fingerprint',
      icon: Fingerprint,
      color: 'green',
      price: 20000,
      description: 'Reconnaissance biométrique avancée',
      features: [
        '100 empreintes incluses',
        'Capteur haute précision',
        'Temps de réponse < 1s',
        'Anti-falsification',
      ]
    },
    {
      id: 'feedback-device',
      name: 'Boîtier Feedback',
      type: 'device',
      category: 'feedback',
      icon: MessageSquare,
      color: 'orange',
      price: 15000,
      description: 'Collecte de satisfaction client',
      features: [
        '4 boutons personnalisables',
        'Statistiques en temps réel',
        'Écran LED',
        'Batterie autonome',
      ]
    },
  ];

  const extensions = [
    {
      id: 'badge-extension-50',
      name: 'Extension Badges RFID',
      type: 'extension',
      category: 'rfid-badge',
      icon: CreditCard,
      color: 'blue',
      price: 1000,
      description: '50 badges RFID supplémentaires',
      features: ['50 badges RFID', 'Compatibles tous boîtiers', 'Durée de vie 5 ans']
    },
    {
      id: 'door-extension',
      name: 'Extension Portes',
      type: 'extension',
      category: 'rfid-door',
      icon: DoorOpen,
      color: 'purple',
      price: 1000,
      description: '2 portes supplémentaires par boîtier',
      features: ['2 portes additionnelles', 'Installation rapide', 'Configuration à distance']
    },
    {
      id: 'fingerprint-extension-50',
      name: 'Extension Empreintes',
      type: 'extension',
      category: 'fingerprint',
      icon: Fingerprint,
      color: 'green',
      price: 100,
      description: '50 empreintes supplémentaires',
      features: ['50 empreintes', 'Mise à jour automatique', 'Sauvegarde cloud']
    },
  ];

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => 
        c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    const existing = cart.find(c => c.id === itemId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(c => 
        c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
      ));
    } else {
      setCart(cart.filter(c => c.id !== itemId));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    onPurchase(cart);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setCart([]);
    }, 3000);
  };

  const ProductCard = ({ product }: any) => {
    const Icon = product.icon;
    const inCart = cart.find(c => c.id === product.id);
    
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
        <div className={`bg-${product.color}-50 p-6 border-b border-${product.color}-100`}>
          <div className={`w-16 h-16 bg-${product.color}-100 rounded-xl flex items-center justify-center mb-4`}>
            <Icon className={`w-8 h-8 text-${product.color}-600`} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.name}</h3>
          <p className="text-sm text-gray-600">{product.description}</p>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {product.price} FCFA
              <span className="text-sm font-normal text-gray-500 ml-2"></span>
            </div>
            {product.type === 'device' && (
              <span className="text-xs text-gray-500">Configuration et installation incluses</span>
            )}
          </div>

          <ul className="space-y-2 mb-6">
            {product.features.map((feature: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {inCart ? (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => removeFromCart(product.id)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-lg font-semibold px-4">{inCart.quantity}</span>
              <button
                onClick={() => addToCart(product)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => addToCart(product)}
              className={`w-full px-4 py-3 bg-${product.color}-600 hover:bg-${product.color}-700 text-white rounded-lg transition-colors font-medium`}
            >
              Ajouter au panier
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-green-800 font-medium">Achat effectué avec succès ! Vos nouveaux équipements seront livrés sous 48h.</p>
        </div>
      )}

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Panier ({cart.reduce((sum, item) => sum + item.quantity, 0)} article{cart.length > 1 ? 's' : ''})
              </h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {getTotalPrice()}€ <span className="text-sm font-normal text-gray-500">HT</span>
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="font-semibold text-gray-900">{item.price * item.quantity}€</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Valider la commande
          </button>
        </div>
      )}

      {/* Devices Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Boîtiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {devices.map(device => (
            <ProductCard key={device.id} product={device} />
          ))}
        </div>
      </div>

      {/* Extensions Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Extensions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {extensions.map(extension => (
            <ProductCard key={extension.id} product={extension} />
          ))}
        </div>
      </div>
    </div>
  );
}
