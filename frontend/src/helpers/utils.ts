import { LOCAL_STORAGE_PARAMETERS } from "./constants";

export const setItemToLocalstorage = (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
};

export const getItemFromLocalstorage = (key: string) => {
    const item = localStorage.getItem(key);

    try {
        return item ? JSON.parse(item) : null;
    } catch {
        return item;
    }
};

export const removeItemFromLocalstorage = (key: string) => {
    localStorage.removeItem(key);
};

export const clearLocalstorage = () => {
    localStorage.clear();
};

export const isAuthenticated = () => {
    return !!getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN);
};