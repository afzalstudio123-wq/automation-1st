/**
 * Parses raw WhatsApp message string into structured inventory data.
 * Expected format:
 * Title: [value]
 * Desc: [value]
 * VPrice: [value]
 * IPrice: [value]
 * SKU: [value]
 * Cat: [value]
 * SubCat: [value]
 * 
 * @param {string} text 
 * @returns {object} Parsed inventory data
 * @throws {Error} specific error details for missing or invalid fields
 */
export function parseWhatsAppMessage(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('Input text is empty or invalid.');
  }

  const lines = text.split(/\r?\n/);
  const errors = [];
  const result = {};

  const fields = [
    { key: 'title', label: 'Title', required: true },
    { key: 'description', label: 'Desc', required: true },
    { key: 'v_price', label: 'VPrice', required: true, isNumeric: true },
    { key: 'i_price', label: 'IPrice', required: true, isNumeric: true },
    { key: 'sku', label: 'SKU', required: true },
    { key: 'category', label: 'Cat', required: true },
    { key: 'sub_category', label: 'SubCat', required: true }
  ];

  for (const field of fields) {
    // Look for lines that start with the field label followed by colon
    const regex = new RegExp(`^\\s*${field.label}\\s*:\\s*(.*)$`, 'i');
    let foundValue = null;

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        foundValue = match[1].trim();
        break; // Stop at first match for this label
      }
    }

    if (foundValue === null || foundValue === '') {
      errors.push(`Missing "${field.label}"`);
    } else {
      if (field.isNumeric) {
        // Clean numeric values (strip potential currency symbols like $, ₹ etc.)
        const cleanVal = foundValue.replace(/[^0-9.-]+/g, '');
        const num = parseFloat(cleanVal);
        if (isNaN(num) || cleanVal === '') {
          errors.push(`"${field.label}" must be a valid number`);
        } else {
          result[field.key] = num;
        }
      } else {
        result[field.key] = foundValue;
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid format. ${errors.join(', ')}`);
  }

  return result;
}
