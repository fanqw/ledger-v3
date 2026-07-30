export interface ApiResult<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T = unknown> = ApiResult<T> | ApiError;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PageData<T> {
  items: T[];
  meta: PageMeta;
}

export interface SessionUser {
  id: string;
  username: string;
  role: string;
}
