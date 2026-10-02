'use server';

export {
  provisionSchoolManager,
  removeSchoolManager,
  getSchoolManagers,
  generateManagerInvite,
  getSchoolManagerInvites,
  revokeManagerInvite,
  type ProvisionSchoolManagerParams,
  type ProvisionSchoolManagerResult,
  type RemoveSchoolManagerParams,
  type RemoveSchoolManagerResult,
  type GenerateManagerInviteParams,
  type GenerateManagerInviteResult,
} from './actions';
