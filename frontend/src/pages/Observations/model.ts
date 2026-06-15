export interface ObservationData {
  id?: string;
  _id?: string;
  observationId: string;
  observedDate: string;
  observedTime: string;
  category: string;
  description: string;
  amc: string;
  informedTo: string;
  informedToOther?: string;
  loggedBy: string;
  status: string;
  remarks?: string;
  comments?: { text: string; user: string; timestamp: string }[];
  isRepeated?: boolean;
  repeatedFromId?: string;
  repeatCount?: number;
  repeatedDetails?: {
    parent: { id: string; observationId: string; description: string; observedDate: string };
    children: { id: string; observationId: string; description: string; observedDate: string }[];
  };
}

export interface ObservationCategoryData {
  id?: string;
  _id?: string;
  name: string;
  status: boolean;
  reportsTo?: string;
  remarks?: string;
}

export interface FetchObservationsResponse {
  data: ObservationData[];
  total: number;
}

export interface FetchObservationCategoriesResponse {
  data: ObservationCategoryData[];
  total: number;
}

export interface ObservationsState {
  observations: ObservationData[];
  categories: ObservationCategoryData[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
