import { STREET_TYPES } from '@/constants';

function parseFormattedAddress(formattedAddress: string) {
  // Split the address by commas and trim whitespace
  const parts = formattedAddress.split(',').map(part => part.trim());

  // Create a dynamic result object based on the number of parts
  const result: { [key: string]: string } = {};

  // If there are 2 or more parts, join the last 2 parts with a dash
  if (parts.length >= 2) {
    const lastTwoParts = parts.slice(-2).join(',');
    const remainingParts = parts.slice(0, -2);
    
    // Add remaining parts as line1, line2, etc.
    remainingParts.forEach((part, index) => {
      const lineKey = `line${index + 1}`;
      result[lineKey] = part;
    });
    
    // Add the joined last two parts
    const lastLineKey = `line${remainingParts.length + 1}`;
    result[lastLineKey] = lastTwoParts;
  } else {
    // If there are no commas, treat the entire string as line1
    result.line1 = parts[0] || '';
  }

  return result;
}

 // Extract all possible street type strings from STREET_TYPES (all languages and abbreviations)
 const getAllStreetTypeStrings = (streetTypes: typeof STREET_TYPES): string[] => {
  const streetTypeStrings: string[] = [];
  
  streetTypes.forEach(streetType => {
    // Helper to split and add values (handles " \/ " separators)
    const addValue = (value: string) => {
      if (!value) return;
      // Split by " \/ " to handle multiple values like "Boulevard \/ Alameda"
      const parts = value.split(' \/ ').map(part => part.trim()).filter(part => part);
      streetTypeStrings.push(...parts);
    };
    
    // Add all English values
    addValue(streetType.English);
    addValue(streetType['Abbr (EN)']);
    
    // Add all French values
    addValue(streetType.French);
    addValue(streetType['Abbr (FR)']);
    
    // Add all Portuguese values
    addValue(streetType.Portuguese);
    addValue(streetType['Abbr (PT)']);
  });
  
  return streetTypeStrings;
};
export { parseFormattedAddress, getAllStreetTypeStrings };
