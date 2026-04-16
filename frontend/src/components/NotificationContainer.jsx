// Notification Container Component
import React from 'react';
import { useNotification } from '../context/NotificationContext';
import Notification from './Notification';

const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[60] p-2 sm:p-4 space-y-3 max-w-[calc(100vw-2rem)] flex flex-col items-end pointer-events-none">
      <div className="space-y-3 flex flex-col items-stretch w-full sm:max-w-sm pointer-events-auto">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onClose={() => removeNotification(notification.id)}
            autoClose={notification.autoClose}
            duration={notification.duration}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationContainer;