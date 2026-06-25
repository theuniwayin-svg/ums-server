import { Types } from 'mongoose';

export interface LeadAccessUser {
  _id?: string | Types.ObjectId;
  role?: string;
}

export function isPrivilegedUser(user?: LeadAccessUser) {
  return ['admin', 'superadmin'].includes(user?.role || '');
}

export function buildLeadAccessQuery(user?: LeadAccessUser) {
  if (!user || isPrivilegedUser(user)) {
    return {};
  }

  const userId = user._id?.toString();
  if (!userId) {
    return {};
  }

  return {
    assignedTo: new Types.ObjectId(userId),
  };
}