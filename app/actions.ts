'use server';

import { supabase } from '@/lib/supabase';
import { parseWhatsAppMessage } from '@/lib/parser';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type Product = {
  id: string;
  serial_number: number;
  title: string;
  description: string;
  v_price: number;
  i_price: number;
  sku: string;
  category: string;
  sub_category: string;
  image_url?: string;
  hsn_code?: string;
  sku_prefix?: string;
  created_by?: string;
  created_at: string;
};

export type ParsedProductInput = {
  title: string;
  description: string;
  v_price: number;
  i_price: number;
  sku: string;
  category: string;
  sub_category: string;
  image_url?: string;
  hsn_code?: string;
  sku_prefix?: string;
  created_by?: string;
};

export type AuditLog = {
  id: string;
  record_id: string;
  user_name: string;
  user_role: string;
  action: string;
  previous_value: any;
  updated_value: any;
  ip_address: string;
  created_at: string;
};

// Local helper to fetch client IP from headers
async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return headersList.get('x-real-ip') || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

// Local helper to record audit logs in database
async function writeAuditLog(params: {
  recordId: string;
  action: string;
  prevVal: any;
  newVal: any;
  userRole: string;
  userName: string;
}) {
  try {
    const ip = await getClientIp();
    await supabase.from('audit_logs').insert([
      {
        record_id: params.recordId,
        user_name: params.userName,
        user_role: params.userRole,
        action: params.action,
        previous_value: params.prevVal,
        updated_value: params.newVal,
        ip_address: ip,
      },
    ]);
  } catch (err) {
    console.error('Audit logger failure:', err);
  }
}

// Local helper to synchronize a row to Google Sheets via Webhook
async function syncToGoogleSheets(product: Product, action: 'INSERT' | 'UPDATE' | 'DELETE') {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, warning: 'Webhook not configured' };
  }

  try {
    const createdAt = new Date(product.created_at);
    const dateStr = createdAt.toLocaleDateString('en-IN');
    const timeStr = createdAt.toLocaleTimeString('en-IN');

    const payload = {
      action,
      serial_number: product.serial_number,
      title: product.title,
      description: product.description,
      v_price: product.v_price,
      i_price: product.i_price,
      sku: product.sku,
      hsn: product.hsn_code || '',
      category: product.category,
      sub_category: product.sub_category,
      image_url: product.image_url || '',
      created_date: dateStr,
      created_time: timeStr,
      created_by: product.created_by || 'Operator',
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Google Sheets sync failed:', err);
    return { success: false, error: err.message };
  }
}

// Check if a product's edits are locked based on date and role
function isProductLocked(createdAt: string, userRole: string): boolean {
  if (userRole === 'Admin') {
    return false; // Admins can always edit/delete
  }
  const today = new Date().toDateString();
  const created = new Date(createdAt).toDateString();
  return today !== created; // Locked if not created today
}

// SERVER ACTION: Add product (handles single raw text parse or standard payload)
export async function addProduct(rawData: string, userRole = 'Operator', userName = 'Operator') {
  try {
    if (!rawData || rawData.trim() === '') {
      return { success: false, error: 'Input data cannot be empty.' };
    }

    const parsedProduct = parseWhatsAppMessage(rawData) as ParsedProductInput;
    parsedProduct.created_by = userName;

    const { data, error } = await supabase
      .from('products')
      .insert([parsedProduct])
      .select();

    if (error) {
      console.error('Supabase DB error:', error);
      if (error.code === '23505') {
        return { success: false, error: `SKU "${parsedProduct.sku}" already exists. SKU must be unique.` };
      }
      return { success: false, error: error.message };
    }

    const newProduct = data[0] as Product;

    // Log the insert event
    await writeAuditLog({
      recordId: newProduct.id,
      action: 'INSERT',
      prevVal: null,
      newVal: newProduct,
      userRole,
      userName,
    });

    // Synchronize to Google Sheets
    await syncToGoogleSheets(newProduct, 'INSERT');

    revalidatePath('/');
    return { success: true, product: newProduct };
  } catch (err: any) {
    console.error('Action execution failed:', err);
    return { success: false, error: err.message || 'Failed to parse or insert inventory item.' };
  }
}

// SERVER ACTION: Insert a single bulk product (called during queue uploads)
export async function addBulkProduct(productData: Partial<Product>, userRole = 'Operator', userName = 'Operator') {
  try {
    productData.created_by = userName;

    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select();

    if (error) {
      console.error('Bulk record insert error:', error);
      return { success: false, error: error.message };
    }

    const newProduct = data[0] as Product;

    // Audit Log
    await writeAuditLog({
      recordId: newProduct.id,
      action: 'INSERT_BULK',
      prevVal: null,
      newVal: newProduct,
      userRole,
      userName,
    });

    // Google Sheets
    await syncToGoogleSheets(newProduct, 'INSERT');

    revalidatePath('/');
    return { success: true, product: newProduct };
  } catch (err: any) {
    console.error('addBulkProduct Server Action error:', err);
    return { success: false, error: err.message || 'Failed to insert bulk record.' };
  }
}

// SERVER ACTION: Update an existing product
export async function updateProduct(
  productId: string, 
  updatedData: Partial<Product>, 
  userRole = 'Operator', 
  userName = 'Operator'
) {
  try {
    // 1. Fetch current product to check date lock and for audit log
    const { data: currentList, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId);

    if (fetchErr || !currentList || currentList.length === 0) {
      return { success: false, error: 'Product not found.' };
    }

    const previousProduct = currentList[0] as Product;

    // 2. Check Date Lock Security
    if (isProductLocked(previousProduct.created_at, userRole)) {
      return { success: false, error: 'Previous inventory is locked. Please request Admin approval.' };
    }

    // 3. Update in Database
    const { data, error } = await supabase
      .from('products')
      .update(updatedData)
      .eq('id', productId)
      .select();

    if (error) {
      console.error('Update product error:', error);
      return { success: false, error: error.message };
    }

    const updatedProduct = data[0] as Product;

    // 4. Audit Log
    await writeAuditLog({
      recordId: productId,
      action: 'UPDATE',
      prevVal: previousProduct,
      newVal: updatedProduct,
      userRole,
      userName,
    });

    // 5. Google Sheets Sync
    await syncToGoogleSheets(updatedProduct, 'UPDATE');

    revalidatePath('/');
    return { success: true, product: updatedProduct };
  } catch (err: any) {
    console.error('updateProduct Server Action error:', err);
    return { success: false, error: err.message };
  }
}

// SERVER ACTION: Delete a product
export async function deleteProduct(productId: string, userRole = 'Operator', userName = 'Operator') {
  try {
    // 1. Fetch current product to check date lock and for audit log
    const { data: currentList, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId);

    if (fetchErr || !currentList || currentList.length === 0) {
      return { success: false, error: 'Product not found.' };
    }

    const previousProduct = currentList[0] as Product;

    // 2. Check Date Lock Security
    if (isProductLocked(previousProduct.created_at, userRole)) {
      return { success: false, error: 'Previous inventory is locked. Please request Admin approval.' };
    }

    // 3. Delete from Database
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Delete product error:', error);
      return { success: false, error: error.message };
    }

    // 4. Audit Log
    await writeAuditLog({
      recordId: productId,
      action: 'DELETE',
      prevVal: previousProduct,
      newVal: null,
      userRole,
      userName,
    });

    // 5. Sync to Sheets (as deletion action)
    await syncToGoogleSheets(previousProduct, 'DELETE');

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error('deleteProduct Server Action error:', err);
    return { success: false, error: err.message };
  }
}

// SERVER ACTION: Fetch all products (ordered by newest first)
export async function getProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch products error:', error);
      throw new Error(error.message);
    }

    return (data || []) as Product[];
  } catch (err: any) {
    console.error('getProducts failed:', err);
    return [];
  }
}

// SERVER ACTION: Fetch all audit logs (for Admins only)
export async function getAuditLogs(userRole = 'Operator'): Promise<AuditLog[]> {
  try {
    if (userRole !== 'Admin') {
      throw new Error('Access denied: Admin privileges required.');
    }
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return (data || []) as AuditLog[];
  } catch (err: any) {
    console.error('getAuditLogs failed:', err);
    return [];
  }
}
