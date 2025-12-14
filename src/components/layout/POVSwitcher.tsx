import { usePOV, MOCK_USERS, ExtendedAppRole } from '@/contexts/POVContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';

const roleColors: Record<ExtendedAppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  editor: 'bg-primary text-primary-foreground',
  moderator: 'bg-primary text-primary-foreground',
  auditor: 'bg-amber-500 text-white',
  user: 'bg-secondary text-secondary-foreground',
  viewer: 'bg-muted text-muted-foreground',
  support: 'bg-green-500 text-white',
};

export function POVSwitcher() {
  const { currentUser, setCurrentUser, allUsers } = usePOV();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card/50 border-b border-border">
      <User className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Viewing as:</span>
      <Select
        value={currentUser.id}
        onValueChange={(id) => {
          const user = allUsers.find((u) => u.id === id);
          if (user) setCurrentUser(user);
        }}
      >
        <SelectTrigger className="w-[200px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MOCK_USERS.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <div className="flex items-center gap-2">
                <span>{user.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge className={roleColors[currentUser.role]}>
        {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
      </Badge>
    </div>
  );
}
