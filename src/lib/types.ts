export interface Company {
  id: number;
  name: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: number;
  company_id: number;
  date: string;
  created_at: string;
}

export interface PurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  item_number: string;
  quantity_boxes: number;
  price: number | null;
  created_at: string;
}

export interface Receipt {
  id: number;
  company_id: number;
  date: string;
  created_at: string;
}

export interface ReceiptLine {
  id: number;
  receipt_id: number;
  item_number: string;
  quantity_boxes: number;
  lot_number: string;
  expiration_date: string | null;
  created_at: string;
}

export interface Usage {
  id: number;
  item_number: string;
  lot_number: string;
  parts_used: number;
  date: string;
  created_at: string;
}

export interface ItemMaster {
  id: number;
  internal_name: string;
  parts_per_box: number | null;
  tests_per_box: number | null;
  default_shelf_life: number | null;
  created_at: string;
}

export interface SupplierCode {
  id: number;
  item_master_id: number;
  company_id: number;
  their_item_number: string;
  created_at: string;
}
