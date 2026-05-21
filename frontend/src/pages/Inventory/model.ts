export interface InventoryHistory {
  date: string;
  action: string;
  quantityChange: number;
  remainingQuantity: number;
  givenTo?: string;
  user: string;
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
}
