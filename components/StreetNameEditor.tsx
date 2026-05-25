import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import streetAppellations from '@/data/street_appellations.json';
import {
  validateStreetName,
  detectNamingMode,
  getModeBadge,
  type StreetNamingMode,
} from '@/lib/streetValidation';

interface StreetNameEditorProps {
  streetName: string;
  streetType: string;
  isFromApi: boolean;
  onSave: (name: string, type: string) => void;
  onCancel: () => void;
}

type AppellationEntry = {
  English: string;
  'Abbr (EN)': string;
  French: string;
  'Abbr (FR)': string;
  Portuguese: string;
  'Abbr (PT)': string;
};

const ALL_STREET_TYPES: { full: string; variations: string[] }[] = (
  streetAppellations as AppellationEntry[]
).map(item => ({
  full: item.English,
  variations: [
    item.English?.toLowerCase(),
    item['Abbr (EN)']?.toLowerCase(),
    item.French?.toLowerCase(),
    item['Abbr (FR)']?.toLowerCase(),
    item.Portuguese?.toLowerCase(),
    item['Abbr (PT)']?.toLowerCase(),
  ].filter(Boolean) as string[],
}));

const STREET_TYPE_LIST = (streetAppellations as AppellationEntry[]).map(
  item => item.English,
);

function extractStreetType(input: string): {
  cleanName: string;
  detectedType: string;
} {
  let name = input.trim();

  const typeNumberPattern =
    /^(Street|Avenue|Road|Lane|Drive|Boulevard|Way|Court|Place|Terrace|Circle|Crescent|Square|Parkway|Trail|Alley|Highway|Bypass|Quay|Mews|Esplanade|Walk|Rue|Route|Chemin|Rua|Estrada|Via)(\d+[A-Za-z]?)$/i;
  const typeNumberMatch = name.match(typeNumberPattern);

  if (typeNumberMatch) {
    const typeWord = typeNumberMatch[1];
    const numberPart = typeNumberMatch[2];
    const foundType = ALL_STREET_TYPES.find(
      t =>
        t.variations.includes(typeWord.toLowerCase()) ||
        t.full.toLowerCase() === typeWord.toLowerCase(),
    );
    return {
      cleanName: `${foundType?.full || typeWord} ${numberPart}`,
      detectedType: foundType?.full || typeWord,
    };
  }

  for (const streetType of ALL_STREET_TYPES) {
    for (const variation of streetType.variations) {
      if (!variation) continue;
      const regexWithSpace = new RegExp(`\\s${variation}$`, 'i');
      if (regexWithSpace.test(name)) {
        const cleanName = name.replace(regexWithSpace, '').trim();
        return { cleanName, detectedType: streetType.full };
      }
      const regexNoSpace = new RegExp(`([a-z])${variation}$`, 'i');
      const noSpaceMatch = name.match(regexNoSpace);
      if (noSpaceMatch) {
        const cleanName = name
          .replace(regexNoSpace, noSpaceMatch[1])
          .trim();
        return { cleanName, detectedType: streetType.full };
      }
      const typeFirstRegex = new RegExp(
        `^${variation}\\s+\\d+[A-Za-z]?$`,
        'i',
      );
      if (typeFirstRegex.test(name)) {
        return { cleanName: name, detectedType: streetType.full };
      }
    }
  }

  return { cleanName: name, detectedType: '' };
}

const MODE_COLORS: Record<StreetNamingMode, string> = {
  Standard: '#22C55E',
  Numeric: '#3B82F6',
  Landmark: '#F59E0B',
  Custom: '#6B7280',
};

export const StreetNameEditor: React.FC<StreetNameEditorProps> = ({
  streetName,
  streetType,
  isFromApi,
  onSave,
  onCancel,
}) => {
  const [tempName, setTempName] = useState(streetName);
  const [tempType, setTempType] = useState(streetType);
  const [inputValue, setInputValue] = useState(streetName);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showTypeWarning, setShowTypeWarning] = useState(false);
  const [userHasEdited, setUserHasEdited] = useState(false);

  const namingMode = useMemo(
    () => detectNamingMode(tempName),
    [tempName],
  );
  const modeBadge = useMemo(() => getModeBadge(namingMode), [namingMode]);
  const validation = useMemo(
    () => (userHasEdited ? validateStreetName(tempName, isFromApi) : null),
    [tempName, isFromApi, userHasEdited],
  );

  const handleNameChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (!userHasEdited && value !== streetName) {
        setUserHasEdited(true);
      }
      if (!value.trim()) {
        setTempName('');
        setTempType('');
        return;
      }
      setTempName(value);
    },
    [userHasEdited, streetName],
  );

  const handleFinishTyping = useCallback(() => {
    if (!inputValue.trim()) return;
    const { cleanName, detectedType } = extractStreetType(inputValue);
    if (detectedType) {
      setTempType(detectedType);
      setTempName(cleanName);
      setInputValue(cleanName);
    }
  }, [inputValue]);

  const handleSave = useCallback(() => {
    if (!tempName.trim()) return;
    if (!tempType) {
      setShowTypeWarning(true);
      return;
    }
    if (validation && !validation.isValid) return;
    onSave(tempName.trim(), tempType);
  }, [tempName, tempType, validation, onSave]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Street Name</Text>
        {isFromApi && (
          <View style={styles.apiBadge}>
            <Text style={styles.apiBadgeText}>From OSM</Text>
          </View>
        )}
      </View>

      {/* Naming Mode Badge */}
      {tempName.trim().length > 0 && (
        <View
          style={[
            styles.modeBadge,
            { backgroundColor: MODE_COLORS[namingMode] + '20' },
          ]}
        >
          <View
            style={[
              styles.modeDot,
              { backgroundColor: MODE_COLORS[namingMode] },
            ]}
          />
          <Text
            style={[styles.modeBadgeText, { color: MODE_COLORS[namingMode] }]}
          >
            {modeBadge.label}
          </Text>
        </View>
      )}

      {/* Name Input */}
      <Text style={styles.label}>Street Name</Text>
      <TextInput
        style={[
          styles.input,
          validation && !validation.isValid && styles.inputError,
        ]}
        value={inputValue}
        onChangeText={handleNameChange}
        onBlur={handleFinishTyping}
        placeholder="Enter street name"
        placeholderTextColor={Colors.grey}
        autoFocus
      />
      {validation && !validation.isValid && (
        <Text style={styles.errorText}>{validation.message}</Text>
      )}

      {/* Street Type Selector */}
      <Text style={styles.label}>Street Type</Text>
      <TouchableOpacity
        style={[
          styles.typeSelector,
          showTypeWarning && !tempType && styles.inputError,
        ]}
        onPress={() => setShowTypePicker(true)}
      >
        <Text
          style={[
            styles.typeSelectorText,
            !tempType && styles.typeSelectorPlaceholder,
          ]}
        >
          {tempType || 'Select street type'}
        </Text>
        <Icon source="chevron-down" size={18} color={Colors.grey} />
      </TouchableOpacity>
      {showTypeWarning && !tempType && (
        <Text style={styles.errorText}>Please select a street type</Text>
      )}

      {/* Preview */}
      {tempName.trim() && tempType && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Preview:</Text>
          <Text style={styles.previewText}>
            {tempName} {tempType}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!tempName.trim() || (validation && !validation.isValid)) &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!tempName.trim() || (validation != null && !validation.isValid)}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Type Picker Modal */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTypePicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Street Type</Text>
            <ScrollView style={styles.modalList}>
              {STREET_TYPE_LIST.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.modalOption,
                    tempType === type && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setTempType(type);
                    setShowTypeWarning(false);
                    setShowTypePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      tempType === type && styles.modalOptionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                  {tempType === type && (
                    <Icon
                      source="check"
                      size={18}
                      color={Colors.primary[500]}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  apiBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  apiBadgeText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark[10],
    marginBottom: 4,
    fontFamily: 'gentium-bold',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors['grey-93'],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
    marginBottom: 12,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: -8,
    marginBottom: 8,
    fontFamily: 'gentium',
  },
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors['grey-93'],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  typeSelectorText: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  typeSelectorPlaceholder: {
    color: Colors.grey,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    color: Colors.grey,
    fontFamily: 'gentium',
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors['grey-93'],
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary[500],
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'gentium-bold',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  modalList: {
    paddingHorizontal: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  modalOptionText: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  modalOptionTextSelected: {
    fontWeight: '600',
    color: Colors.primary[500],
  },
});

export default StreetNameEditor;
