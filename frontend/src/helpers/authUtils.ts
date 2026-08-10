// @ts-nocheck
import { store } from '../store';
import { LOCAL_STORAGE_PARAMETERS } from './constants';
import { getItemFromLocalstorage } from './utils';

/**
 * Checks if the currently authenticated user has the specified privilege.
 * 
 * @param privilege - The name of the privilege to check (e.g., "Create User")
 * @returns boolean indicating if the user has the privilege
 */
export const hasPrivilege = (privilege: string): boolean => {
    const state = store.getState();
    const userPrivileges = state.auth.privileges || [];
    const userRole = state.auth.role;
    
    const isSuperUser = state.auth.isSuperuser || 
        getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER) === true || 
        getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER) === 'true' ||
        userRole === 'Super Admin' ||
        (Array.isArray(userRole) && userRole.includes('Super Admin'));

    if (isSuperUser) return true;

    return userPrivileges.includes(privilege);
};

/**
 * Checks if the currently authenticated user has at least one of the specified privileges.
 * 
 * @param privileges - An array of privilege names to check
 * @returns boolean indicating if the user has any of the privileges
 */
export const hasAnyPrivilege = (privileges: string[]): boolean => {
    const state = store.getState();
    const userPrivileges = state.auth.privileges || [];
    const userRole = state.auth.role;
  
    const isSuperUser = state.auth.isSuperuser || 
        getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER) === true || 
        getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER) === 'true' ||
        userRole === 'Super Admin' ||
        (Array.isArray(userRole) && userRole.includes('Super Admin'));

    if (isSuperUser) return true;
    
    return privileges.some(p => userPrivileges.includes(p));
};

/**
 * Checks if the currently authenticated user has ALL of the specified privileges.
 * 
 * @param privileges - An array of privilege names to check
 * @returns boolean indicating if the user has all of the privileges
 */
export const hasAllPrivileges = (privileges: string[]): boolean => {
    const state = store.getState();
    const userPrivileges = state.auth.privileges || [];
    const userRole = state.auth.role;

    const isSuperUser = state.auth.isSuperuser || 
        getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER) === true || 
        getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER) === 'true' ||
        userRole === 'Super Admin' ||
        (Array.isArray(userRole) && userRole.includes('Super Admin'));

    if (isSuperUser) return true;

    return privileges.every(p => userPrivileges.includes(p));
};
