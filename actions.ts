'use server';

import { supabase } from '@/lib/supabase';
import { parseWhatsAppMessage } from '@/lib/parser';
import { revalidatePath } from 'next/cache';

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
};

export async function addProduct(rawData: string) {
  try {
    if (!rawData || rawData.trim() === '') {
      return { success: false, error: 'Input data cannot be empty.' };
    }

    // Parse the pasted raw content
    const parsedProduct = parseWhatsAppMessage(rawData) as ParsedProductInput;

    // Insert into Supabase
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

    // Revalidate the main route to update server-side page data
    revalidatePath('/');

    return { success: true, product: data[0] as Product };
  } catch (err: any) {
    console.error('Action execution failed:', err);
    return { success: false, error: err.message || 'Failed to parse or insert inventory item.' };
  }
}

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
