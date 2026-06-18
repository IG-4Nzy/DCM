export interface InventoryHistory {
  date: string;
  action: string;
  quantityChange: number;
  remainingQuantity: number;
  givenTo?: string;
  user: string;
}

export interface HolderData {
  id: string;
  givenTo: string;
  givenDate: string;
  givenBy: string;
}

export interface InventoryData {
  id?: string;
  _id?: string;
  itemName: string;
  quantity: number;
  description?: string;
  lastUpdatedDate: string;
  lastUpdatedBy: string;
  history: InventoryHistory[];
  isReturnable?: boolean;
  currentHolders?: HolderData[];
  almiraNumber?: string;
  rackNumber?: string;
}
