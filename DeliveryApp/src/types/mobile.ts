export type Driver = {
  user_id: string;
  name: string;
  license_plate: string;
  vehicle_type: string;
  max_weight_kg: number;
  max_volume_m3: number;
  current_shift_status: 'OFFLINE' | 'ONLINE_READY' | 'BUSY';
};

export type Shift = {
  id: string;
  driver_id: string;
  start_time: string; // ISO String
  end_time: string | null; // ISO String or null if active
  status: 'OPEN' | 'PENDING_SETTLEMENT' | 'CLOSED';
  cod_collected: number;
  cod_submitted: number;
};

export type Route = {
  id: string;
  driver_id: string;
  route_date: string;
  total_distance_km: number;
  total_estimated_time_min: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  polyline: string; // Mocked for now
};

export type Order = {
  id: string;
  code: string;
  receiver_name: string;
  receiver_phone: string;
  delivery_address: string;
  lat: number;
  lng: number;
  cod_amount: number;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RESCHEDULED';
};

export type Stop = {
  id: string;
  route_id: string;
  order_id: string;
  sequence_no: number;
  arrived_at: string | null; // ISO String
  status: 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  order: Order; // Populated for convenience in mock state
};

export type ProofOfDelivery = {
  stop_id: string;
  photo_url: string | null;
  cod_collected: number;
  failure_reason: string | null;
  rescheduled_date: string | null;
  confirmed_at: string;
};
