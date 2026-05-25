// formatStreetName.ts

import { StreetType, Language } from '@/interfaces';

interface ReverseResult {
  name: string;
  type: string | null;
}

/**
 * Build "street name + street type" for display without duplicating the type.
 * e.g. ("Borstal Street", "Street") -> "Borstal Street"; ("Main", "Street") -> "Main Street".
 */
export function formatStreetLine(streetName: string, streetType?: string | null): string {
  const name = (streetName ?? '').trim();
  const type = (streetType ?? '').trim();
  if (!type) return name;
  const nameLower = name.toLowerCase();
  const typeLower = type.toLowerCase();
  if (nameLower.endsWith(typeLower)) return name;
  return `${name} ${type}`.trim();
}

export function formatStreetName(
  rawInput: string,
  selectedType: string,
  lang: Language,
  streetTypes: StreetType[],
  useAbbreviation = false,
): string {
  const normalized = rawInput.trim().toLowerCase();
  const words = normalized.split(/\s+/).map(word => word.replace(/\.$/, '')); // remove trailing dots

  const typesInLang = getTypesByLang(lang, streetTypes).map(type =>
    type.toLowerCase(),
  );

  // ✅ If any type (full or abbr) is in the input (ignore trailing .), assume it's correct
  if (words.some(word => typesInLang.includes(word))) {
    return capitalizeWords(stripTrailingDot(rawInput));
  }

  // ✅ Check if the selected type is already contained within the input (e.g., "Street3" with type "Street")
  const selectedTypeLower = selectedType.toLowerCase();
  const selectedTypeInLang = getTypeTranslation(
    selectedType,
    lang,
    streetTypes,
    false,
  ).toLowerCase();
  const selectedTypeAbbrInLang = getTypeTranslation(
    selectedType,
    lang,
    streetTypes,
    true,
  ).toLowerCase();

  if (
    normalized.includes(selectedTypeLower) ||
    normalized.includes(selectedTypeInLang) ||
    normalized.includes(selectedTypeAbbrInLang)
  ) {
    return capitalizeWords(stripTrailingDot(rawInput));
  }

  const cleanedName = capitalizeWords(words.join(' '));
  const outputType = getTypeTranslation(
    selectedType,
    lang,
    streetTypes,
    useAbbreviation,
  );

  switch (lang) {
    case 'en':
      return `${cleanedName} ${outputType}`;
    case 'fr': {
      const prep = inferFrenchPreposition(cleanedName);
      return `${outputType} ${prep}${cleanedName}`;
    }
    case 'pt': {
      const prep = inferPortuguesePreposition(cleanedName);
      return `${outputType} ${prep}${cleanedName}`;
    }
    default:
      return capitalizeWords(stripTrailingDot(rawInput));
  }
}

function stripTrailingDot(str: string): string {
  return str.trim().replace(/\.\s*$/, '');
}

export function reverseFormatStreetName(
  full: string,
  lang: Language,
  streetTypes: StreetType[],
): ReverseResult {
  const lower = full.trim().toLowerCase();

  // Build mapping of language-specific street types
  const typesMap = streetTypes.flatMap(type => {
    const entries = [];

    switch (lang) {
      case 'en':
        entries.push({
          match: type.English.toLowerCase(),
          english: type.English,
        });
        entries.push({
          match: type['Abbr (EN)'].toLowerCase(),
          english: type.English,
        });
        break;
      case 'fr':
        entries.push({
          match: type.French.toLowerCase(),
          english: type.English,
        });
        entries.push({
          match: type['Abbr (FR)'].toLowerCase(),
          english: type.English,
        });
        break;
      case 'pt':
        entries.push({
          match: type.Portuguese.toLowerCase(),
          english: type.English,
        });
        entries.push({
          match: type['Abbr (PT)'].toLowerCase(),
          english: type.English,
        });
        break;
    }

    return entries;
  });

  for (const { match, english } of typesMap) {
    if (lang === 'fr') {
      // Match French patterns: e.g. "Rue du Lycée", "Avenue de l'Opéra"
      const pattern = new RegExp(`^${match} (du|de la|de l'|des)? ?(.+)$`, 'i');
      const frMatch = lower.match(pattern);
      if (frMatch) {
        return {
          name: capitalizeWords(frMatch[2].trim()),
          type: english,
        };
      }
    } else {
      // Match non-French formats: name first or type last
      if (lower.endsWith(match)) {
        const namePart = lower.replace(new RegExp(`${match}$`, 'i'), '').trim();
        return {
          name: capitalizeWords(namePart),
          type: english,
        };
      }
    }
  }

  // No known type found
  return { name: capitalizeWords(full), type: null };
}

// Helpers

function getTypesByLang(lang: Language, types: StreetType[]): string[] {
  return types.flatMap(type => {
    switch (lang) {
      case 'en':
        return [type.English.toLowerCase(), type['Abbr (EN)'].toLowerCase()];
      case 'fr':
        return [type.French.toLowerCase(), type['Abbr (FR)'].toLowerCase()];
      case 'pt':
        return [type.Portuguese.toLowerCase(), type['Abbr (PT)'].toLowerCase()];
    }
  });
}

function getTypeTranslation(
  type: string,
  lang: Language,
  types: StreetType[],
  useAbbreviation = false,
): string {
  const found = types.find(
    t =>
      t.English === type ||
      t['Abbr (EN)'] === type ||
      t['Abbr (FR)'] === type ||
      t['Abbr (PT)'] === type,
  );
  if (!found) return type;

  switch (lang) {
    case 'en':
      return useAbbreviation ? found['Abbr (EN)'] : found.English;
    case 'fr':
      return useAbbreviation ? found['Abbr (FR)'] : found.French;
    case 'pt':
      return useAbbreviation ? found['Abbr (PT)'] : found.Portuguese;
  }
}

// function inferFrenchPreposition(name: string): string {
//   const first = name.charAt(0).toLowerCase();
//   if ('aeiouh'.includes(first)) return "de l'";
//   if (name.endsWith('s')) return 'des';
//   return 'du';
// }

function inferFrenchPreposition(streetName: string) {
  // Normalize input
  streetName = streetName.trim();
  const lowerName = streetName.toLowerCase();
  // Gender detection rules
  const isMasculine =
    /(age|eau|ment|isme|ier|é|er|ou|at|in)$/.test(lowerName) &&
    !/(tion|té|esse|ière|ence|ique)$/.test(lowerName);
  const isFeminine = /(tion|té|esse|ière|ence|ique|ie|ade|asse)$/.test(
    lowerName,
  );
  // Handle vowel-start (elision)
  const startsWithVowel = /^[aeiouh]/i.test(streetName);
  // Assign article
  if (isMasculine) return startsWithVowel ? "de l'" : 'du ';
  if (isFeminine) return startsWithVowel ? "de l'" : 'de la ';
  if (streetName.endsWith('s')) return 'des ';
  return '';
}

function inferPortuguesePreposition(streetName: string) {
  // Normalize input
  streetName = streetName.trim();
  const lowerName = streetName.toLowerCase();

  // Gender detection rules
  const isMasculine =
    /(o|ão|or|ente|el|al|ol|um)$/.test(lowerName) &&
    !/(a|ção|dade|agem|ice|ez)$/.test(lowerName);

  const isFeminine = /(a|ção|dade|agem|ice|ez)$/.test(lowerName);

  // Handle vowel-start (not used for elision, but may be relevant stylistically)
  // const startsWithVowel = /^[aeiouáéíóúâêôãõ]/i.test(streetName);

  // Assign article
  if (isMasculine) return 'do ';
  if (isFeminine) return 'da ';
  if (streetName.endsWith('s')) return 'dos ';
  return '';
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

export function formatNeighborhood(
  name: string,
  streetTypes: StreetType[],
  lang: Language,
): string {
  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();
  const suffixes = getTypesByLang(lang, streetTypes);

  const neighborhoodLabels = {
    en: 'Quarter',
    fr: 'Quartier',
    pt: 'Bairro',
  };

  const appendWord = neighborhoodLabels[lang];

  // Check if the name starts or ends with any known street type
  const isPrefixMatch = suffixes.some(suffix =>
    lowerName.startsWith(`${suffix.toLowerCase()} `),
  );
  const isSuffixMatch = suffixes.some(suffix =>
    lowerName.endsWith(` ${suffix.toLowerCase()}`),
  );
  const alreadyFormatted =
    lang === 'fr'
      ? lowerName.startsWith('quartier ')
      : lowerName.endsWith(` ${appendWord.toLowerCase()}`);

  if ((isPrefixMatch || isSuffixMatch) && !alreadyFormatted) {
    if (lang === 'fr') {
      return `Quartier ${trimmedName}`;
    } else {
      return `${trimmedName} ${appendWord}`;
    }
  }

  return trimmedName;
}
