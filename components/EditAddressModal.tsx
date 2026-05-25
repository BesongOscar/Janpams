import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors, UNIT_TYPES, CONNECTIONS } from '@/constants';
import { updateAddress } from '@/lib/db/addresses';
import { upsertAddressItem } from '@/lib/search/searchIndex';
import { snackbarToast } from '@/utils/toastHelpter';
import type { Address } from '@/lib/db/schemas';

interface EditAddressModalProps {
  visible: boolean;
  address: Address | null;
  onClose: () => void;
  onSaved: (updated: Address) => void;
}

export const EditAddressModal: React.FC<EditAddressModalProps> = ({
  visible,
  address,
  onClose,
  onSaved,
}) => {
  const [streetName, setStreetName] = useState(address?.street_name ?? '');
  const [businessName, setBusinessName] = useState(address?.business_name ?? '');
  const [neighborhood, setNeighborhood] = useState(address?.neighborhood ?? '');
  const [propertyType, setPropertyType] = useState(address?.property_type ?? '');
  const [connectionType, setConnectionType] = useState(address?.connection_type ?? '');
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [showConnectionPicker, setShowConnectionPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!address) return;
    if (!streetName.trim()) {
      snackbarToast('Street name is required', 'error', Colors.error);
      return;
    }
    setSaving(true);
    try {
      const updates: Partial<Address> = {
        street_name: streetName.trim(),
        business_name: businessName.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        property_type: propertyType,
        connection_type: connectionType || undefined,
        updated_at: new Date().toISOString(),
      };
      await updateAddress(address.id, updates);

      const updated = { ...address, ...updates } as Address;
      try {
        await upsertAddressItem(updated);
      } catch (e) {
        console.warn('[EditAddressModal] Failed to update search index:', e);
      }

      snackbarToast('Address updated', 'success', Colors.success);
      onSaved(updated);
    } catch (err) {
      console.log('[EditAddressModal] Save failed:', err);
      snackbarToast('Failed to save changes', 'error', Colors.error);
    } finally {
      setSaving(false);
    }
  }, [address, streetName, businessName, neighborhood, propertyType, connectionType, onSaved]);

  const propertyTypes = UNIT_TYPES.map((u: { name: string }) => u.name);
  const connectionTypes = CONNECTIONS.map((c: { name: string }) => c.name);

  if (!address) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Icon source="close" size={24} color={Colors.dark[10]} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Address</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          {/* House number (read-only) */}
          <Text style={styles.label}>House Number</Text>
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>
              {address.house_number}{address.extension ? address.extension : ''}
            </Text>
          </View>

          {/* Street Name */}
          <Text style={styles.label}>Street Name</Text>
          <TextInput
            style={styles.input}
            value={streetName}
            onChangeText={setStreetName}
            placeholder="Street name"
            placeholderTextColor={Colors.grey}
          />

          {/* Business Name */}
          <Text style={styles.label}>Business Name (optional)</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Joe's Barber Shop"
            placeholderTextColor={Colors.grey}
          />

          {/* Neighborhood */}
          <Text style={styles.label}>Neighborhood</Text>
          <TextInput
            style={styles.input}
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Neighborhood"
            placeholderTextColor={Colors.grey}
          />

          {/* Property Type */}
          <Text style={styles.label}>Property Type</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowPropertyPicker(true)}
          >
            <Text style={styles.pickerText}>{propertyType || 'Select'}</Text>
            <Icon source="chevron-down" size={18} color={Colors.grey} />
          </TouchableOpacity>

          {/* Connection Type */}
          <Text style={styles.label}>Connection</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowConnectionPicker(true)}
          >
            <Text style={styles.pickerText}>{connectionType || 'Select'}</Text>
            <Icon source="chevron-down" size={18} color={Colors.grey} />
          </TouchableOpacity>

          {/* Plus Code (read-only) */}
          <Text style={styles.label}>Plus Code</Text>
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{address.plus_code}</Text>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Property Type Picker */}
      <Modal visible={showPropertyPicker} transparent animationType="slide" onRequestClose={() => setShowPropertyPicker(false)}>
        <Pressable style={styles.overlayPicker} onPress={() => setShowPropertyPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>Property Type</Text>
            <ScrollView>
              {propertyTypes.map((type: string) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.pickerOption, propertyType === type && styles.pickerOptionSel]}
                  onPress={() => { setPropertyType(type); setShowPropertyPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, propertyType === type && styles.pickerOptionTextSel]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Connection Type Picker */}
      <Modal visible={showConnectionPicker} transparent animationType="slide" onRequestClose={() => setShowConnectionPicker(false)}>
        <Pressable style={styles.overlayPicker} onPress={() => setShowConnectionPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>Connection</Text>
            <ScrollView>
              {connectionTypes.map((type: string) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.pickerOption, connectionType === type && styles.pickerOptionSel]}
                  onPress={() => { setConnectionType(type); setShowConnectionPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, connectionType === type && styles.pickerOptionTextSel]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors['grey-93'],
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary[500],
  },
  form: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark[10],
    marginBottom: 4,
    marginTop: 12,
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
  },
  readOnly: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyText: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.grey,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors['grey-93'],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerText: { fontSize: 14, fontFamily: 'gentium', color: Colors.dark[10] },
  overlayPicker: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '50%',
    paddingHorizontal: 16,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    marginBottom: 12,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pickerOptionSel: { backgroundColor: '#E3F2FD' },
  pickerOptionText: { fontSize: 14, fontFamily: 'gentium', color: Colors.dark[10] },
  pickerOptionTextSel: { fontWeight: '600', color: Colors.primary[500] },
});

export default EditAddressModal;
