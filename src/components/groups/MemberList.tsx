'use client';

import React from 'react';
import { GroupMember } from '@/types/database';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Phone, Shield, User } from 'lucide-react';

export const MemberList: React.FC<{ members: GroupMember[] }> = ({ members }) => {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {members.map((member) => (
        <div key={member.id} className="py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar profile={member.profile} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {member.profile?.full_name || 'Usuario'}
                </span>
                {member.role === 'admin' ? (
                  <Badge variant="amber" size="sm">
                    <Shield className="w-2.5 h-2.5" />
                    Admin
                  </Badge>
                ) : null}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {member.profile?.email || 'Sin email'}
              </span>
            </div>
          </div>

          {/* Bizum phone badge if available */}
          {member.profile?.bizum_phone && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <Phone className="w-3 h-3" />
              <span>{member.profile.bizum_phone}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
