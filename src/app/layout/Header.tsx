import { AlertCircle, Bell, User } from 'lucide-react';
import type { Notifications } from '@/app/shared/types';

interface HeaderProps {
  companyName: string;
  notifications: Notifications;
}

export function Header({ companyName, notifications }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{companyName}</h2>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            {notifications.badgesToAssign > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {notifications.badgesToAssign} badge
                  {notifications.badgesToAssign > 1 ? 's' : ''} a assigner
                </span>
              </div>
            )}

            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              {(notifications.badgesToAssign > 0 || notifications.remainingCapacity < 10) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>

          <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Admin</span>
          </button>
        </div>
      </div>
    </header>
  );
}
