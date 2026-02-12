import type { LucideIcon } from 'lucide-react';
import type { PageId } from '@/app/shared/types';

export interface SidebarItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  menuItems: SidebarItem[];
}

export function Sidebar({ activePage, onPageChange, menuItems }: SidebarProps) {
  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold">AccessControl Pro</h1>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
