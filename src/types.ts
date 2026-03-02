export interface User {
  id: number;
  name: string;
  role: 'admin' | 'worker';
  pin: string;
}

export interface Schedule {
  id: number;
  user_id: number;
  day_of_week: number; // 1-5
  start_time: string | null;
  end_time: string | null;
  start_time_2: string | null;
  end_time_2: string | null;
}

export interface TimeEntry {
  id: number;
  user_id: number;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  type: 'manual' | 'auto';
  user_name?: string;
}
