import { createContext, useState, useEffect } from 'react';
import { socket } from './SocketContext';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    socket.on('user-id', (userId) => {
      setCurrentUser(userId);
    });

    return () => {
      socket.off('user-id');
    };
  }, []);

  return (
    <UserContext.Provider value={currentUser}>
      {children}
    </UserContext.Provider>
  );
};