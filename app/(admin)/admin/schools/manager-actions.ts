'use server';

export {
  provisionSchoolManager,
  removeSchoolManager,
  getSchoolManagers,
  generateManagerInvite,
  getSchoolManagerInvites,
  revokeManagerInvite,
  getRegisteredManagers,
  assignExistingManager,
  type ProvisionSchoolManagerParams,
  type ProvisionSchoolManagerResult,
  type RemoveSchoolManagerParams,
  type RemoveSchoolManagerResult,
  type GenerateManagerInviteParams,
  type GenerateManagerInviteResult,
  type RegisteredManagerAccount,
  type AssignExistingManagerParams,
  type AssignExistingManagerResult,
} from './actions';

