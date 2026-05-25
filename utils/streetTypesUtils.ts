// streetTypeUtils.ts

import {
  StreetType,
  DropdownOption,
  LocalizedStreetTypeOptions,
} from '@/interfaces';

export function buildStreetTypeOptions(
  types: StreetType[],
): LocalizedStreetTypeOptions {
  const en: DropdownOption[] = [];
  const fr: DropdownOption[] = [];
  const pt: DropdownOption[] = [];

  types.forEach(type => {
    en.push({ label: type.English, value: type.English });
    fr.push({ label: type.French, value: type.English });
    pt.push({ label: type.Portuguese, value: type.English });
  });

  return { en, fr, pt };
}
