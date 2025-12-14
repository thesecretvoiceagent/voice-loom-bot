import React, { createContext, useContext, useState, useEffect } from 'react';

export type ExtendedAppRole = 'admin' | 'editor' | 'auditor' | 'user' | 'viewer' | 'support' | 'moderator';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: ExtendedAppRole;
}

// 10 Estonian seed users
export const MOCK_USERS: MockUser[] = [
  { id: '1', name: 'Maarja Tamm', email: 'maarja@example.com', role: 'admin' },
  { id: '2', name: 'Kaur Kask', email: 'kaur@example.com', role: 'editor' },
  { id: '3', name: 'Liis Saar', email: 'liis@example.com', role: 'editor' },
  { id: '4', name: 'Rasmus Õun', email: 'rasmus@example.com', role: 'auditor' },
  { id: '5', name: 'Anu Pärn', email: 'anu@example.com', role: 'auditor' },
  { id: '6', name: 'Siim Lepp', email: 'siim@example.com', role: 'user' },
  { id: '7', name: 'Grete Vaher', email: 'grete@example.com', role: 'user' },
  { id: '8', name: 'Taavi Ilves', email: 'taavi@example.com', role: 'viewer' },
  { id: '9', name: 'Kristi Kuusk', email: 'kristi@example.com', role: 'viewer' },
  { id: '10', name: 'Joonas Sepp', email: 'joonas@example.com', role: 'support' },
];

// Role permissions
export interface RolePermissions {
  canView: boolean;
  canViewDeleted: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canEditOwn: boolean;
  canSoftDelete: boolean;
  canHardDelete: boolean;
  canRestore: boolean;
  canViewAuditLog: boolean;
}

export const ROLE_PERMISSIONS: Record<ExtendedAppRole, RolePermissions> = {
  admin: {
    canView: true,
    canViewDeleted: true,
    canAdd: true,
    canEdit: true,
    canEditOwn: true,
    canSoftDelete: true,
    canHardDelete: true,
    canRestore: true,
    canViewAuditLog: true,
  },
  editor: {
    canView: true,
    canViewDeleted: false,
    canAdd: true,
    canEdit: true,
    canEditOwn: true,
    canSoftDelete: true,
    canHardDelete: false,
    canRestore: true,
    canViewAuditLog: false,
  },
  moderator: {
    canView: true,
    canViewDeleted: false,
    canAdd: true,
    canEdit: true,
    canEditOwn: true,
    canSoftDelete: true,
    canHardDelete: false,
    canRestore: true,
    canViewAuditLog: false,
  },
  auditor: {
    canView: true,
    canViewDeleted: true,
    canAdd: false,
    canEdit: false,
    canEditOwn: false,
    canSoftDelete: false,
    canHardDelete: false,
    canRestore: false,
    canViewAuditLog: true,
  },
  user: {
    canView: true,
    canViewDeleted: false,
    canAdd: true,
    canEdit: false,
    canEditOwn: true,
    canSoftDelete: false,
    canHardDelete: false,
    canRestore: false,
    canViewAuditLog: false,
  },
  viewer: {
    canView: true,
    canViewDeleted: false,
    canAdd: false,
    canEdit: false,
    canEditOwn: false,
    canSoftDelete: false,
    canHardDelete: false,
    canRestore: false,
    canViewAuditLog: false,
  },
  support: {
    canView: true,
    canViewDeleted: true,
    canAdd: false,
    canEdit: false,
    canEditOwn: false,
    canSoftDelete: false,
    canHardDelete: false,
    canRestore: true,
    canViewAuditLog: false,
  },
};

interface POVContextType {
  currentUser: MockUser;
  setCurrentUser: (user: MockUser) => void;
  permissions: RolePermissions;
  allUsers: MockUser[];
}

const POVContext = createContext<POVContextType | undefined>(undefined);

export const usePOV = () => {
  const context = useContext(POVContext);
  if (context === undefined) {
    throw new Error('usePOV must be used within a POVProvider');
  }
  return context;
};

export const POVProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<MockUser>(MOCK_USERS[0]); // Default to admin

  const permissions = ROLE_PERMISSIONS[currentUser.role];

  return (
    <POVContext.Provider value={{ currentUser, setCurrentUser, permissions, allUsers: MOCK_USERS }}>
      {children}
    </POVContext.Provider>
  );
};
