import {
  toGroupRef,
  toIso,
  toIsoOrNull,
  toUserRef,
  type GroupRefDTO,
  type UserRefDTO,
  type UserRefSource,
} from './common.dto.js';

export interface InvitationDTO {
  id: string;
  status: string;
  /** Hanya dikirim ke pengirim / pengelola grup. */
  email?: string | null;
  expires_at: string | null;
  created_at: string;
  group: GroupRefDTO & { member_count: number };
  inviter: UserRefDTO;
  invitee: UserRefDTO | null;
}

type InvitationSource = {
  id: string;
  status: string;
  email: string | null;
  expires_at: Date | null;
  created_at: Date;
  groups: {
    id: string;
    name: string;
    currency: string;
    avatar_url: string | null;
    _count: { group_members: number };
  };
  users_invitations_inviter_idTousers: UserRefSource;
  users_invitations_invitee_idTousers: UserRefSource | null;
};

export const toInvitationDTO = (
  invitation: InvitationSource,
  options: { includeEmail: boolean },
): InvitationDTO => ({
  id: invitation.id,
  status: invitation.status,
  ...(options.includeEmail ? { email: invitation.email } : {}),
  expires_at: toIsoOrNull(invitation.expires_at),
  created_at: toIso(invitation.created_at),
  group: {
    ...toGroupRef(invitation.groups),
    member_count: invitation.groups._count.group_members,
  },
  inviter: toUserRef(invitation.users_invitations_inviter_idTousers),
  invitee: invitation.users_invitations_invitee_idTousers
    ? toUserRef(invitation.users_invitations_invitee_idTousers)
    : null,
});
